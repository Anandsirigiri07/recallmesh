"""Automated test suite for RECALLMESH graph foundation (Milestone 1).

Covers:
- Database reachability and connection pooling
- Idempotent seed data loading
- Downstream tracing of affected lots (forward blast radius)
- Surgical exclusion of clean control lot (zero false positives)
- Upstream root-cause tracing
- Traceability-gap detection and QA review task generation (never safe on missing paths)
- Graph ablation test (verifying that removing a FalkorDB edge changes the result)
- Human authorization governance gate for simulated containment actions
"""

import pytest
from src.recallmesh.connection import get_graph, ping_falkordb
from src.recallmesh.loader import load_scenario
from src.recallmesh.tracer import (
    build_containment_action_plan,
    detect_traceability_gaps,
    execute_containment_action_plan,
    trace_downstream,
    trace_upstream,
    GovernanceException,
)

FIXTURE_PATH = "data/demo/recall_scenario.json"
TEST_GRAPH_NAME = "recallmesh_test"


@pytest.fixture(scope="session")
def graph():
    """Session-scoped fixture providing a clean FalkorDB test graph."""
    assert ping_falkordb(), "FalkorDB is unreachable at 127.0.0.1:6379"
    g = get_graph(graph_name=TEST_GRAPH_NAME)
    load_scenario(FIXTURE_PATH, g, reset=True)
    yield g
    # Clean up test graph after session
    try:
        g.delete()
    except Exception:
        pass


def test_database_ping():
    """Verify local FalkorDB is running and responsive."""
    assert ping_falkordb() is True


def test_seeding_idempotence(graph):
    """Verify that running the seed loader multiple times does not create duplicate nodes."""
    def count_nodes():
        res = graph.query("MATCH (n) RETURN count(n) AS cnt")
        return res.result_set[0][0]

    initial_count = count_nodes()
    assert initial_count > 0

    # Re-run loader without reset
    load_scenario(FIXTURE_PATH, graph, reset=False)
    subsequent_count = count_nodes()

    assert initial_count == subsequent_count, (
        f"Seeding is not idempotent: node count changed from {initial_count} to {subsequent_count}"
    )


def test_downstream_tracing_affected_lot(graph):
    """Verify forward blast radius from suspect cumin lot LOT-CUM-2026-088.

    Must find FL-SALSA-101 and its two outbound shipments SHIP-8821 and SHIP-8822.
    """
    res = trace_downstream(graph, "LOT-CUM-2026-088")

    assert res["suspect_raw_lot"] == "LOT-CUM-2026-088"
    assert res["total_affected_finished_lots"] == 1
    assert res["total_affected_shipments"] == 2

    # Check finished lot details
    fin_lot = res["affected_finished_lots"][0]
    assert fin_lot["lot_code"] == "FL-SALSA-101"
    assert fin_lot["disposition"] == "QUARANTINED"
    assert fin_lot["traceability_status"] == "VERIFIED"
    assert fin_lot["production_event"] == "PROD-EVT-4401"

    # Check shipments and destinations
    shipment_ids = {s["shipment_id"] for s in res["affected_shipments"]}
    assert shipment_ids == {"SHIP-8821", "SHIP-8822"}

    # Check evidence provenance
    assert len(res["evidence"]) >= 1
    ev_ids = [e["evidence_id"] for e in res["evidence"]]
    assert "EVID-LAB-904" in ev_ids


def test_downstream_tracing_spares_control_lot(graph):
    """Verify surgical isolation: clean control lot FL-SALSA-102 must NOT appear

    in the contaminated blast radius of LOT-CUM-2026-088.
    """
    res = trace_downstream(graph, "LOT-CUM-2026-088")
    affected_lot_codes = {lot["lot_code"] for lot in res["affected_finished_lots"]}

    assert "FL-SALSA-102" not in affected_lot_codes
    assert "FL-SALSA-103" not in affected_lot_codes


def test_clean_control_lot_traceability(graph):
    """Verify that clean control lot LOT-CUM-2026-090 traces to FL-SALSA-102 with unbroken lineage."""
    res = trace_downstream(graph, "LOT-CUM-2026-090")
    assert res["total_affected_finished_lots"] == 1
    assert res["affected_finished_lots"][0]["lot_code"] == "FL-SALSA-102"
    assert res["affected_finished_lots"][0]["disposition"] == "AVAILABLE"
    assert res["affected_finished_lots"][0]["traceability_status"] == "VERIFIED"


def test_upstream_root_cause_isolation(graph):
    """Verify backward tracing from FL-SALSA-101 to raw ingredient and supplier."""
    res = trace_upstream(graph, "FL-SALSA-101")

    assert res["target_finished_lot"] == "FL-SALSA-101"
    assert res["is_orphaned"] is False
    assert len(res["lineage"]) == 1

    entry = res["lineage"][0]
    assert entry["production_event"] == "PROD-EVT-4401"
    assert entry["raw_lot"] == "LOT-CUM-2026-088"
    assert entry["supplier_id"] == "SUP-APEX-01"
    assert entry["supplier_name"] == "Apex Spice Co."
    assert entry["ingredient_id"] == "ING-CUMIN-ORG"


def test_traceability_gap_detection_and_safety_rule(graph):
    """Verify that FL-SALSA-103 (missing transformation records) is explicitly detected as GAP_DETECTED

    and generates a review task. It must NEVER be declared safe merely because no path exists.
    """
    gaps = detect_traceability_gaps(graph)

    gap_lot_codes = [g["lot_code"] for g in gaps["gap_detected_finished_lots"]]
    assert "FL-SALSA-103" in gap_lot_codes

    # Verify review task was generated
    task_targets = [t["target_id"] for t in gaps["review_tasks"]]
    assert "FL-SALSA-103" in task_targets

    # Check updated property in FalkorDB
    chk = graph.query(
        "MATCH (f:FinishedLot {lot_code: 'FL-SALSA-103'}) RETURN f.traceability_status, f.disposition"
    )
    status, disp = chk.result_set[0]
    assert status == "GAP_DETECTED"
    # Verify disposition remains distinct from traceability status
    assert disp == "AVAILABLE"


def test_graph_ablation_proves_falkordb_indispensability(graph):
    """Ablation Test: Removing a graph relationship in FalkorDB MUST change the tracing result.

    1. Verify FL-SALSA-101 is reachable from LOT-CUM-2026-088.
    2. Delete the CONSUMED_IN relationship between LOT-088 and PROD-EVT-4401.
    3. Re-query: result MUST drop to 0 affected finished lots.
    4. Restore relationship to leave graph intact.
    """
    # 1. Baseline check
    baseline = trace_downstream(graph, "LOT-CUM-2026-088")
    assert baseline["total_affected_finished_lots"] == 1
    assert baseline["affected_finished_lots"][0]["lot_code"] == "FL-SALSA-101"

    # 2. Ablate edge in FalkorDB
    graph.query(
        """
        MATCH (r:RawLot {lot_code: 'LOT-CUM-2026-088'})-[rel:CONSUMED_IN]->(p:ProductionEvent {event_id: 'PROD-EVT-4401'})
        DELETE rel
        """
    )

    # 3. Post-ablation check
    ablated = trace_downstream(graph, "LOT-CUM-2026-088")
    assert ablated["total_affected_finished_lots"] == 0, (
        "Graph ablation failed: downstream query returned affected lots even after deleting CONSUMED_IN edge!"
    )
    assert ablated["total_affected_shipments"] == 0

    # 4. Restore relationship
    graph.query(
        """
        MATCH (r:RawLot {lot_code: 'LOT-CUM-2026-088'})
        MATCH (p:ProductionEvent {event_id: 'PROD-EVT-4401'})
        MERGE (r)-[:CONSUMED_IN]->(p)
        """
    )
    restored = trace_downstream(graph, "LOT-CUM-2026-088")
    assert restored["total_affected_finished_lots"] == 1


def test_containment_action_plan_governance_gate(graph):
    """Verify that simulated containment actions require explicit human authorization."""
    plan = build_containment_action_plan(graph, "LOT-CUM-2026-088", case_id="CASE-2026-004")

    assert plan["total_actions"] >= 3
    assert plan["requires_authorization"] is True
    assert plan["authorized"] is False

    # Attempt execution without authorization signature -> Must raise GovernanceException
    with pytest.raises(GovernanceException) as excinfo:
        execute_containment_action_plan(graph, plan, authorized_by=None)
    assert "Human authorization signature required" in str(excinfo.value)

    # Empty string signature must also be rejected
    with pytest.raises(GovernanceException):
        execute_containment_action_plan(graph, plan, authorized_by="   ")

    # Valid authorization signature -> Must succeed and record Decision in FalkorDB
    auth_email = "qa.director@verdantharvest.example.com"
    executed = execute_containment_action_plan(graph, plan, authorized_by=auth_email)

    assert executed["status"] == "APPROVED_SIMULATED"
    assert executed["authorized_by"] == auth_email
    assert executed["total_executed"] == plan["total_actions"]

    # Verify Decision node was created in FalkorDB
    dec_id = executed["decision_id"]
    dec_check = graph.query(
        "MATCH (d:Decision {decision_id: $dec_id})-[:AUTHORIZES]->(a:Action) RETURN count(a)",
        {"dec_id": dec_id},
    )
    assert dec_check.result_set[0][0] == plan["total_actions"]
