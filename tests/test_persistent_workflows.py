"""Integration tests for persistent audit trails, evidence uploads, supplier requests,
and live Critical Tracking Events (CTEs) endpoints.
"""

import io
from fastapi.testclient import TestClient
import pytest
from falkordb import Graph

from src.recallmesh.api.app import create_app
from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.connection import get_graph, ping_falkordb
from src.recallmesh.loader import load_scenario

FIXTURE_PATH = "data/demo/recall_scenario.json"
TEST_GRAPH_NAME = "recallmesh_persist_test"


@pytest.fixture(scope="module")
def persistent_test_graph() -> Graph:
    """Fixture initializing an isolated test graph for persistent workflows."""
    assert ping_falkordb(), "Local FalkorDB is unreachable at 127.0.0.1:6379"
    g = get_graph(graph_name=TEST_GRAPH_NAME)
    load_scenario(FIXTURE_PATH, g, reset=True)
    yield g
    try:
        g.delete()
    except Exception:
        pass


@pytest.fixture(scope="module")
def client(persistent_test_graph: Graph) -> TestClient:
    """FastAPI TestClient with isolated graph dependency override."""
    app = create_app()
    app.dependency_overrides[get_active_graph] = lambda: persistent_test_graph
    return TestClient(app)


def test_cte_records_live_graph_extraction(client: TestClient):
    """Verifies GET /api/cte/records derives actual CTEs from the live graph."""
    response = client.get("/api/cte/records")
    assert response.status_code == 200
    data = response.json()
    assert "records" in data
    assert data["total_records"] > 0

    event_types = {r["event_type"] for r in data["records"]}
    assert "Receiving" in event_types
    assert "Transformation" in event_types
    assert "Shipping" in event_types

    # Verify FL-SALSA-103 is present as an unlinked/gap transformation
    orphan_lots = [r for r in data["records"] if r["tlc"] == "FL-SALSA-103"]
    assert len(orphan_lots) >= 1
    assert "GAP" in orphan_lots[0]["traceability_status"] or orphan_lots[0]["traceability_status"] == "UNKNOWN"


def test_new_investigation_docket_creation(client: TestClient):
    """Verifies POST /api/cases creates persistent RecallCase node and audit record."""
    payload = {
        "title": "Suspected Salmonella Contamination in Salsa Mix Batch",
        "suspect_raw_lot": "LOT-CUM-2026-088",
        "hazard_description": "Positive presumptive PCR screen for Salmonella enterica",
        "source_facility": "Facility TX-4 (El Paso Milling)",
        "lead_investigator": "Dr. Elena Vance (QA Food Safety Lead)",
    }
    response = client.post("/api/cases", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"].startswith("INC-")
    assert data["status"] == "ACTIVE_INVESTIGATION"

    # Verify discoverable via GET /api/cases
    list_res = client.get("/api/cases")
    assert list_res.status_code == 200
    cases = list_res.json()
    assert any(c["case_id"] == data["case_id"] for c in cases)


def test_evidence_upload_valid_pdf_and_retrieval(client: TestClient):
    """Verifies POST /api/evidence/upload validates, stores, and allows safe download."""
    # Create valid dummy PDF header
    valid_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    file_tuple = ("lab_coa_cumin_lot088.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")

    form_data = {
        "lot_code": "FL-SALSA-103",
        "document_type": "Certificate of Analysis",
        "uploaded_by": "QA Specialist Morgan",
    }
    upload_res = client.post(
        "/api/evidence/upload",
        data=form_data,
        files={"file": file_tuple},
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["document_id"].startswith("DOC-")
    assert "verification pending" in doc_data["status"]
    assert "does not verify" in doc_data["verification_disclaimer"]

    # Verify safe download endpoint returns exact original binary bytes
    doc_id = doc_data["document_id"]
    dl_res = client.get(f"/api/evidence/{doc_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == valid_pdf_bytes


def test_evidence_upload_disallowed_extension_rejected(client: TestClient):
    """Verifies executables or unsupported extensions are rejected with 400."""
    bad_bytes = b"echo 'malicious script'"
    file_tuple = ("exploit.exe", io.BytesIO(bad_bytes), "application/octet-stream")

    res = client.post(
        "/api/evidence/upload",
        data={"lot_code": "FL-SALSA-103"},
        files={"file": file_tuple},
    )
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]


def test_evidence_upload_spoofed_magic_bytes_rejected(client: TestClient):
    """Verifies a text file named .pdf is caught by magic bytes verification."""
    spoofed_bytes = b"This is just plain text, not a real PDF document!"
    file_tuple = ("fake.pdf", io.BytesIO(spoofed_bytes), "application/pdf")

    res = client.post(
        "/api/evidence/upload",
        data={"lot_code": "FL-SALSA-103"},
        files={"file": file_tuple},
    )
    assert res.status_code == 400
    assert "Spoofed or corrupted file rejected" in res.json()["detail"]


def test_evidence_upload_size_limit_enforced(client: TestClient):
    """Verifies files exceeding 10 MB are rejected with 413."""
    # 10MB + 1 byte
    oversized = b"%PDF" + b"0" * (10 * 1024 * 1024 + 1)
    file_tuple = ("large.pdf", io.BytesIO(oversized), "application/pdf")

    res = client.post(
        "/api/evidence/upload",
        data={"lot_code": "FL-SALSA-103"},
        files={"file": file_tuple},
    )
    assert res.status_code == 413
    assert "exceeds maximum allowed size" in res.json()["detail"]


def test_supplier_request_simulation_persistence(client: TestClient):
    """Verifies POST /api/evidence/request creates local simulation record in graph."""
    payload = {
        "target_lot": "FL-SALSA-103",
        "supplier_name": "Sunrise Spice Co. (Supplier TX-4)",
        "document_type": "Certificate of Analysis (CoA)",
        "requested_by": "Dr. Elena Vance (QA Food Safety Lead)",
        "instructions": "Need lot certificate for raw lot 2026-088.",
    }
    res = client.post("/api/evidence/request", json=payload)
    assert res.status_code == 200
    data = res.json()
    req_id = data["request_id"]
    assert req_id.startswith("REQ-SUP-")
    assert data["status"] == "SIMULATED_REQUEST_CREATED"
    assert "no real-world external email" in data["simulation_disclaimer"]

    # Verify retrieval by ID
    get_res = client.get(f"/api/evidence/requests/{req_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["request_id"] == req_id
    assert retrieved["target_lot"] == "FL-SALSA-103"
    assert retrieved["status"] == "SIMULATED_REQUEST_CREATED"
    assert retrieved["supplier"] == "Sunrise Spice Co. (Supplier TX-4)"

    # Verify listing
    list_res = client.get("/api/evidence/requests")
    assert list_res.status_code == 200
    assert any(r["request_id"] == req_id for r in list_res.json())

    # Verify 404 for invalid request ID
    not_found = client.get("/api/evidence/requests/REQ-INVALID-999")
    assert not_found.status_code == 404



def test_audit_timeline_recording_and_retrieval(client: TestClient):
    """Verifies all persistent operations appear chronologically in the audit timeline."""
    res = client.get("/api/audit/timeline")
    assert res.status_code == 200
    timeline = res.json()
    assert timeline["total_events"] >= 3

    action_types = [e["action_type"] for e in timeline["events"]]
    assert "INVESTIGATION_CREATED" in action_types
    assert "EVIDENCE_UPLOADED" in action_types
    assert "SUPPLIER_REQUEST_SIMULATED" in action_types

    # Verify no passwords or confidential secrets exist in details
    for e in timeline["events"]:
        assert "password" not in e["details"].lower()
        assert e["timestamp"] is not None


def test_containment_action_audit_logging(client: TestClient):
    """Verifies containment execution records an audit event upon approval."""
    # Fetch plan
    plan_res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    assert plan_res.status_code == 200
    plan = plan_res.json()

    # Execute with valid signature
    exec_res = client.post(
        "/api/actions/execute",
        json={
            "action_plan": plan,
            "authorized_by": "Dr. Elena Vance (QA Food Safety Lead)",
            "rationale": "Audit containment test",
        },
    )
    assert exec_res.status_code == 200

    # Verify audit event recorded
    timeline_res = client.get("/api/audit/timeline")
    events = timeline_res.json()["events"]
    assert any(e["action_type"] == "CONTAINMENT_SIMULATED" for e in events)
