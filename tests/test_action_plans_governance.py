"""Unit and integration tests for Milestone 4B.4: Action Plans and Governed Response Workflow.

Tests verify:
1. Data-driven plan generation from graph traversal and gap detection.
2. Human-in-the-loop governance gates, requiring real human signatures.
3. Clear status transitions: PROPOSED, PENDING_REVIEW, APPROVED, REJECTED, COMPLETED.
4. Rejection of unauthorized transitions and invalid statuses.
5. FalkorDB persistence of action items and audit trail.
6. Idempotent execution and retry safety.
7. Export dossier generation.
"""

import pytest
from fastapi.testclient import TestClient
from src.recallmesh.api.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_action_plan_data_driven_evidence_grounding(client):
    """Verify GET /api/actions/plan returns structured, evidence-grounded containment actions."""
    res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    assert res.status_code == 200
    data = res.json()

    assert data["suspect_raw_lot"] == "LOT-CUM-2026-088"
    assert data["requires_authorization"] is True
    assert len(data["proposed_actions"]) >= 4

    # Verify evidence citations
    assert len(data["evidence_cited"]) >= 1
    assert data["evidence_cited"][0]["evidence_id"] == "EVID-LAB-904"

    # Verify that actions differentiate confirmed affected paths from evidence gaps
    confirmed_actions = [a for a in data["proposed_actions"] if a.get("path_classification") == "CONFIRMED_AFFECTED"]
    gap_actions = [a for a in data["proposed_actions"] if a.get("path_classification") == "EVIDENCE_GAP"]

    assert len(confirmed_actions) >= 3
    assert len(gap_actions) >= 1

    # Check that gap action targets FL-SALSA-103
    assert any(a["target_id"] == "FL-SALSA-103" for a in gap_actions)

    # Check origin facility and source contaminant are populated
    first_act = confirmed_actions[0]
    assert first_act["origin_facility"] is not None
    assert first_act["source_contaminant"] == "LOT-CUM-2026-088"
    assert len(first_act["current_state"]) >= 2
    assert len(first_act["simulation_impact"]) >= 2


def test_action_item_status_transition_to_approved(client):
    """Verify human governance gate: transition action to APPROVED with signature and rationale."""
    payload = {
        "action_id": "ACT-QUARANTINE-01",
        "new_status": "APPROVED",
        "actor": "Dr. Elena Vance (QA Lead)",
        "rationale": "Verified Salmonella screen on raw lot; approving digital twin hold.",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["action_id"] == "ACT-QUARANTINE-01"
    assert data["status"] == "APPROVED"
    assert data["actor"] == "Dr. Elena Vance (QA Lead)"
    assert data["audit_event_id"].startswith("AUD-")


def test_action_item_status_transition_to_pending_review(client):
    """Verify transition to PENDING_REVIEW (request changes) with rationale."""
    payload = {
        "action_id": "ACT-STOP-SHIP-02",
        "new_status": "PENDING_REVIEW",
        "actor": "Marcus Brody (Logistics Coordinator)",
        "rationale": "Need carrier route confirmation before simulating stop-ship order.",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["action_id"] == "ACT-STOP-SHIP-02"
    assert data["status"] == "PENDING_REVIEW"
    assert data["actor"] == "Marcus Brody (Logistics Coordinator)"


def test_action_item_status_transition_to_rejected(client):
    """Verify transition to REJECTED (block action) with rationale."""
    payload = {
        "action_id": "ACT-CONSIGNEE-03",
        "new_status": "REJECTED",
        "actor": "Sarah Connor (Legal & Compliance)",
        "rationale": "Consignee already consumed product; replace with customer advisory memo.",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["action_id"] == "ACT-CONSIGNEE-03"
    assert data["status"] == "REJECTED"


def test_action_item_status_transition_to_completed(client):
    """Verify transition to COMPLETED (run simulated execution)."""
    payload = {
        "action_id": "ACT-AUDIT-04",
        "new_status": "COMPLETED",
        "actor": "Morgan Bailey (QA Director)",
        "rationale": "Executed digital twin simulation: evidence request dispatched to Apex Spice Co.",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["action_id"] == "ACT-AUDIT-04"
    assert data["status"] == "COMPLETED"


def test_action_item_status_unauthorized_missing_actor(client):
    """Verify governance gate blocks status transition if actor signature is missing."""
    payload = {
        "action_id": "ACT-QUARANTINE-01",
        "new_status": "APPROVED",
        "actor": "",
        "rationale": "Attempting anonymous approval",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code in [400, 403, 422]


def test_action_item_status_invalid_status_rejection(client):
    """Verify rejection when an unsupported or invalid status is requested."""
    payload = {
        "action_id": "ACT-QUARANTINE-01",
        "new_status": "NONEXISTENT_STATUS",
        "actor": "QA Specialist",
        "rationale": "Testing validation",
    }
    res = client.post("/api/actions/item/status", json=payload)
    assert res.status_code == 400
    assert "invalid status" in res.json()["detail"].lower()


def test_action_plan_falkordb_persistence_across_sessions(client):
    """Verify that updated action item statuses persist in FalkorDB and are reflected in future plan queries."""
    # 1. Update status of ACT-QUARANTINE-01 to APPROVED
    client.post(
        "/api/actions/item/status",
        json={
            "action_id": "ACT-QUARANTINE-01",
            "new_status": "APPROVED",
            "actor": "Persist Test Auditor",
            "rationale": "Checking FalkorDB node persistence",
        },
    )

    # 2. Query plan anew
    plan_res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    assert plan_res.status_code == 200
    plan = plan_res.json()

    act1 = next((a for a in plan["proposed_actions"] if a["action_id"] == "ACT-QUARANTINE-01"), None)
    assert act1 is not None
    assert act1["status"] == "APPROVED"
    assert act1["authorized_by"] == "Persist Test Auditor"


def test_action_execution_idempotency_and_retry(client):
    """Verify executing an action plan multiple times does not crash or corrupt FalkorDB records."""
    plan_res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    plan = plan_res.json()

    exec_payload = {
        "action_plan": plan,
        "authorized_by": "Dr. Elena Vance (QA Lead)",
        "rationale": "Idempotency retry validation test",
    }

    # Execute first time
    res1 = client.post("/api/actions/execute", json=exec_payload)
    assert res1.status_code == 200

    # Execute second time (simulating user retry)
    res2 = client.post("/api/actions/execute", json=exec_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "APPROVED_SIMULATED"
    assert data2["total_executed"] == len(plan["proposed_actions"])


def test_action_plan_export_dossier(client):
    """Verify GET /api/actions/export returns structured markdown containment dossier."""
    res = client.get("/api/actions/export?raw_lot_code=LOT-CUM-2026-088")
    assert res.status_code == 200
    data = res.json()

    assert data["export_format"] == "markdown"
    assert "FSMA 204 CONTAINMENT ACTION PLAN DOSSIER" in data["content"]
    assert "ACT-QUARANTINE-01" in data["content"]
    assert "LOT-CUM-2026-088" in data["content"]
    assert data["structured_plan"]["total_actions"] >= 4
