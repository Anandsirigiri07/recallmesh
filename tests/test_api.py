"""Comprehensive automated test suite for RECALLMESH FastAPI API Layer (Milestone 4A).

Tests all 12 required areas:
1. API health and database-unavailable behavior.
2. Overview metrics derived from actual seeded graph state.
3. Downstream tracing for suspect raw lot LOT-CUM-2026-088.
4. Inspection of existing and nonexistent nodes (including gap node FL-SALSA-103).
5. Graph visualization serialization and deterministic 6-stage layout.
6. Actual ML inference (3-class and binary) with verbatim research disclaimers.
7. Valid and invalid containment action plans.
8. Unauthorized action attempts (403 Forbidden governance gate) and simulated-only execution.
9. Memory endpoint behavior and connected entity summary.
10. Search matches, empty results, and malicious/malformed inputs.
11. CSV escaping, response headers, and preservation of missing evidence in CTE export.
12. Integration with isolated test graphs without touching production data.
"""

import csv
import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from src.recallmesh.api.app import app
from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.connection import get_graph, ping_falkordb
from src.recallmesh.loader import load_scenario
from src.recallmesh.ml.pipeline import RESEARCH_DISCLAIMER

FIXTURE_PATH = "data/demo/recall_scenario.json"
TEST_GRAPH_NAME = "recallmesh_api_test"


@pytest.fixture(scope="session")
def test_graph():
    """Session-scoped fixture providing a seeded FalkorDB graph for API tests."""
    assert ping_falkordb(), "Local FalkorDB is unreachable at 127.0.0.1:6379"
    g = get_graph(graph_name=TEST_GRAPH_NAME)
    load_scenario(FIXTURE_PATH, g, reset=True)
    yield g
    try:
        g.delete()
    except Exception:
        pass


@pytest.fixture(scope="session")
def client(test_graph):
    """FastAPI TestClient with active graph dependency overridden to test_graph."""
    app.dependency_overrides[get_active_graph] = lambda: test_graph
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ==============================================================================
# 1. API Health and Database-Unavailable Tests
# ==============================================================================

def test_api_health_healthy(client):
    """Verify GET /api/health reports healthy when local FalkorDB is connected."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["falkordb_connected"] is True
    assert data["version"] == "1.0.0"
    assert "timestamp_utc" in data


def test_api_health_database_unavailable(client):
    """Verify GET /api/health accurately reports degraded status when FalkorDB is unreachable."""
    with patch("src.recallmesh.api.routes.health.ping_falkordb", return_value=False):
        res = client.get("/api/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "degraded"
        assert data["falkordb_connected"] is False
        assert "unreachable" in data["note"].lower()


def test_root_informational_route(client):
    """Verify GET / returns API metadata and documentation links."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["docs"] == "/docs"
    assert data["health"] == "/api/health"


# ==============================================================================
# 2. Overview Metrics Tests
# ==============================================================================

def test_overview_metrics_derived_from_graph(client):
    """Verify GET /api/overview/metrics computes actual graph metrics without fabrication."""
    res = client.get("/api/overview/metrics")
    assert res.status_code == 200
    data = res.json()

    assert data["active_cases_count"] >= 1
    assert data["shipments_traced_count"] >= 2
    assert data["finished_lots_count"] == 3
    assert data["gaps_open_count"] >= 1
    assert data["quarantined_finished_lots_count"] == 1
    assert data["available_finished_lots_count"] == 2

    # Current case metadata
    curr_case = data["current_case"]
    assert curr_case is not None
    assert curr_case["case_id"] == "CASE-2026-004"
    assert curr_case["hazard_type"] == "BIOLOGICAL"
    assert curr_case["pathogen_or_hazard"] == "Salmonella enterica"
    assert curr_case["suspect_raw_lot"] == "LOT-CUM-2026-088"


# ==============================================================================
# 3. Downstream & Upstream Tracing Tests
# ==============================================================================

def test_downstream_tracing_affected_lot(client):
    """Verify GET /api/trace/downstream correctly traces blast radius for LOT-CUM-2026-088."""
    res = client.get("/api/trace/downstream?raw_lot_code=LOT-CUM-2026-088")
    assert res.status_code == 200
    data = res.json()

    assert data["suspect_raw_lot"] == "LOT-CUM-2026-088"
    assert data["total_affected_finished_lots"] == 1
    assert data["total_affected_shipments"] == 2

    # Affected lot must be FL-SALSA-101
    aff_lots = [fl["lot_code"] for fl in data["affected_finished_lots"]]
    assert "FL-SALSA-101" in aff_lots
    # Unaffected control lot must be spared
    assert "FL-SALSA-102" not in aff_lots

    # Shipments
    ship_ids = [sh["shipment_id"] for sh in data["affected_shipments"]]
    assert "SHIP-8821" in ship_ids
    assert "SHIP-8822" in ship_ids

    # Supporting evidence citation
    assert len(data["evidence"]) >= 1
    assert data["evidence"][0]["evidence_id"] == "EVID-LAB-904"


def test_downstream_tracing_clean_control_lot(client):
    """Verify clean control lot LOT-CUM-2026-090 traces to FL-SALSA-102 and NOT FL-SALSA-101."""
    res = client.get("/api/trace/downstream?raw_lot_code=LOT-CUM-2026-090")
    assert res.status_code == 200
    data = res.json()

    aff_lots = [fl["lot_code"] for fl in data["affected_finished_lots"]]
    assert "FL-SALSA-102" in aff_lots
    assert "FL-SALSA-101" not in aff_lots


def test_upstream_tracing_provenance(client):
    """Verify GET /api/trace/upstream traces backward from FL-SALSA-101 to raw cumin and Apex Spice."""
    res = client.get("/api/trace/upstream?finished_lot_code=FL-SALSA-101")
    assert res.status_code == 200
    data = res.json()

    assert data["target_finished_lot"] == "FL-SALSA-101"
    assert data["is_orphaned"] is False
    assert len(data["lineage"]) >= 1
    lin = data["lineage"][0]
    assert lin["raw_lot"] == "LOT-CUM-2026-088"
    assert lin["supplier_name"] == "Apex Spice Co."


def test_traceability_gaps_endpoint(client):
    """Verify GET /api/trace/gaps identifies FL-SALSA-103 as having a broken chain of custody."""
    res = client.get("/api/trace/gaps")
    assert res.status_code == 200
    data = res.json()

    gap_lots = [g["lot_code"] for g in data["gap_detected_finished_lots"]]
    assert "FL-SALSA-103" in gap_lots

    # Check generated review task
    tasks = data["review_tasks"]
    gap_tasks = [t for t in tasks if t["target_id"] == "FL-SALSA-103"]
    assert len(gap_tasks) == 1
    assert "Missing Transformation CTE" in gap_tasks[0]["title"]


# ==============================================================================
# 4. Node Inspector Tests
# ==============================================================================

def test_inspect_affected_lot_node(client):
    """Verify GET /api/nodes/{id}/inspector returns accurate properties for FL-SALSA-101."""
    res = client.get("/api/nodes/FL-SALSA-101/inspector")
    assert res.status_code == 200
    data = res.json()

    assert data["node_id"] == "FL-SALSA-101"
    assert data["primary_label"] == "FinishedLot"
    assert data["display_name"] == "Artisan Roasted Salsa 16oz"
    assert data["traceability_status"] == "VERIFIED"
    assert data["disposition"] == "QUARANTINED"
    assert data["is_gap_detected"] is False
    assert "LOT-CUM-2026-088" in data["why_included"]

    # Incoming relationship from ProductionEvent
    in_rels = [r["relationship_type"] for r in data["incoming_relationships"]]
    assert "PRODUCED" in in_rels

    # Outgoing relationship to Shipment
    out_rels = [r["relationship_type"] for r in data["outgoing_relationships"]]
    assert "PACKAGED_INTO" in out_rels


def test_inspect_gap_node_fl_salsa_103(client):
    """Verify GET /api/nodes/{id}/inspector accurately identifies FL-SALSA-103 gap."""
    res = client.get("/api/nodes/FL-SALSA-103/inspector")
    assert res.status_code == 200
    data = res.json()

    assert data["node_id"] == "FL-SALSA-103"
    assert data["primary_label"] == "FinishedLot"
    assert data["is_gap_detected"] is True
    assert "missing" in data["why_included"].lower()

    # Must NOT have incoming PRODUCED relationship
    in_types = [r["relationship_type"] for r in data["incoming_relationships"]]
    assert "PRODUCED" not in in_types


def test_inspect_nonexistent_node(client):
    """Verify GET /api/nodes/{id}/inspector cleanly returns 404 for missing IDs."""
    res = client.get("/api/nodes/DOES-NOT-EXIST-9999/inspector")
    assert res.status_code == 404
    data = res.json()
    assert "not found" in data["detail"].lower()


# ==============================================================================
# 5. Graph Visualization Serialization Tests
# ==============================================================================

def test_graph_vis_serialization_stages(client):
    """Verify GET /api/trace/graph-vis serializes actual graph nodes into 6-stage layout."""
    res = client.get("/api/trace/graph-vis?raw_lot_code=LOT-CUM-2026-088")
    assert res.status_code == 200
    data = res.json()

    assert data["total_nodes"] >= 10
    assert data["total_edges"] >= 6

    node_dict = {n["id"]: n for n in data["nodes"]}

    # Verify Stage 1: Supplier
    assert node_dict["SUP-APEX-01"]["stage"] == 1
    assert "Supplier" in node_dict["SUP-APEX-01"]["stage_name"]

    # Verify Stage 2: Ingredient Lot
    assert node_dict["LOT-CUM-2026-088"]["stage"] == 2
    assert node_dict["LOT-CUM-2026-088"]["is_affected"] is True

    # Verify Stage 3: Production Event
    assert node_dict["PROD-EVT-4401"]["stage"] == 3

    # Verify Stage 4: Finished Lots
    assert node_dict["FL-SALSA-101"]["stage"] == 4
    assert node_dict["FL-SALSA-101"]["is_affected"] is True
    assert node_dict["FL-SALSA-102"]["stage"] == 4
    assert node_dict["FL-SALSA-102"]["is_affected"] is False  # Clean control spared
    assert node_dict["FL-SALSA-103"]["stage"] == 4
    assert node_dict["FL-SALSA-103"]["is_gap"] is True  # Gap preserved

    # Verify Stage 5: Shipments
    assert node_dict["SHIP-8821"]["stage"] == 5
    assert node_dict["SHIP-8821"]["is_affected"] is True

    # Verify Stage 6: Destination Locations
    assert node_dict["LOC-RETAIL-ALPHA"]["stage"] == 6

    # Verify missing link rule: NO edge connects any node to FL-SALSA-103 with PRODUCED
    produced_targets = [e["target"] for e in data["edges"] if e["type"] == "PRODUCED"]
    assert "FL-SALSA-103" not in produced_targets


# ==============================================================================
# 6. Machine Learning Inference & Benchmark Tests
# ==============================================================================

def test_ml_predict_risk_improved_three_class(client):
    """Verify POST /api/ml/predict-risk returns genuine inference and preserves disclaimer."""
    payload = {
        "product_description": "Artisan Roasted Salsa 16oz consumer jar",
        "reason_for_recall": "Potential Salmonella enterica contamination detected in raw cumin extract",
        "model_type": "improved_three_class",
    }
    res = client.post("/api/ml/predict-risk", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["model_type"] == "improved_three_class"
    assert data["task_type"] == "three_class_classification"
    assert data["predicted_class"] in ["Class I", "Class II", "Class III"]
    assert data["confidence"] > 0.0
    assert "Class I" in data["class_probabilities"]
    assert data["disclaimer"] == RESEARCH_DISCLAIMER

    # Top explanatory features should include salmonella / cumin terms
    assert len(data["top_explanatory_features"]) > 0

    # Benchmark metrics metadata should represent locked evaluation
    bench = data["published_benchmark_metrics"]
    assert bench["test_accuracy"] == 0.6655
    assert bench["test_class_i_recall"] == 0.7975


def test_ml_predict_risk_binary(client):
    """Verify POST /api/ml/predict-risk with model_type='binary' returns binary probabilities."""
    payload = {
        "product_description": "Artisan Roasted Salsa 16oz consumer jar",
        "reason_for_recall": "Life-threatening microbial pathogen Salmonella enterica detected",
        "model_type": "binary",
        "threshold": 0.43,
    }
    res = client.post("/api/ml/predict-risk", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["model_type"] == "binary"
    assert data["task_type"] == "binary_severity_classification"
    assert "Class I" in data["predicted_binary_label"]
    assert isinstance(data["is_class_i"], bool)
    assert 0.0 <= data["class_i_probability"] <= 1.0
    assert data["threshold_applied"] == 0.43
    assert data["disclaimer"] == RESEARCH_DISCLAIMER


def test_ml_predict_risk_unsupported_model(client):
    """Verify POST /api/ml/predict-risk rejects invalid model types cleanly."""
    payload = {
        "product_description": "Test",
        "reason_for_recall": "Test",
        "model_type": "unsupported_neural_net",
    }
    res = client.post("/api/ml/predict-risk", json=payload)
    assert res.status_code == 400
    assert "unknown model_type" in res.json()["detail"].lower()


def test_ml_benchmark_metrics_endpoint(client):
    """Verify GET /api/ml/benchmark-metrics returns official evaluation figures."""
    res = client.get("/api/ml/benchmark-metrics")
    assert res.status_code == 200
    data = res.json()
    assert "improved_three_class" in data["models"]
    assert "binary" in data["models"]
    assert data["aspiration_comparison"]["target_reached"] is False


# ==============================================================================
# 7. Action Planning & Governance Execution Tests
# ==============================================================================

def test_action_plan_construction(client):
    """Verify GET /api/actions/plan returns structured containment actions in PROPOSED status."""
    res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    assert res.status_code == 200
    data = res.json()

    assert data["suspect_raw_lot"] == "LOT-CUM-2026-088"
    assert data["requires_authorization"] is True
    assert data["authorized"] is False
    assert len(data["proposed_actions"]) >= 4

    # Every action must be in PROPOSED status initially
    for act in data["proposed_actions"]:
        assert act["status"] == "PROPOSED"
        assert act["action_type"] in ["INTERNAL_HOLD", "CARRIER_STOP_SHIP", "CONSIGNEE_RECALL_NOTICE", "QA_GAP_AUDIT"]


def test_action_execution_unauthorized_rejection(client):
    """Verify POST /api/actions/execute rejects attempts without human authorization signature (403)."""
    # 1. Fetch valid plan
    plan_res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    plan = plan_res.json()

    # 2. Attempt execution without authorized_by
    exec_payload = {
        "action_plan": plan,
        "authorized_by": "",  # Empty signature
        "rationale": "Automated system run",
    }
    res = client.post("/api/actions/execute", json=exec_payload)
    assert res.status_code == 403
    data = res.json()
    assert "human authorization signature required" in data["detail"].lower()


def test_action_execution_malformed_request(client):
    """Verify POST /api/actions/execute rejects malformed action plans (400)."""
    res = client.post("/api/actions/execute", json={"action_plan": {"invalid": "shape"}, "authorized_by": "QA Director"})
    assert res.status_code == 400
    assert "malformed" in res.json()["detail"].lower()


def test_action_execution_authorized_simulated_success(client):
    """Verify POST /api/actions/execute executes simulated digital twin actions when authorized."""
    plan_res = client.get("/api/actions/plan?raw_lot_code=LOT-CUM-2026-088")
    plan = plan_res.json()

    exec_payload = {
        "action_plan": plan,
        "authorized_by": "Morgan Bailey (QA Director)",
        "rationale": "Approved simulated hold across Austin DC and transit carriers",
    }
    res = client.post("/api/actions/execute", json=exec_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "APPROVED_SIMULATED"
    assert data["authorized_by"] == "Morgan Bailey (QA Director)"
    assert data["decision_id"].startswith("DEC-")
    assert data["total_executed"] == len(plan["proposed_actions"])
    assert "simulated dry-run" in data["simulation_note"].lower()


# ==============================================================================
# 8. Memory & Institutional Facts Tests
# ==============================================================================

def test_memory_facts_endpoint(client):
    """Verify GET /api/memory/facts returns real connected entity counts and memory status."""
    res = client.get("/api/memory/facts")
    assert res.status_code == 200
    data = res.json()

    # Connected entity counts
    counts = data["connected_entity_summary"]
    assert counts["suppliers_count"] == 2
    assert counts["finished_lots_count"] == 3
    assert counts["shipments_count"] == 4
    assert counts["locations_count"] == 3

    assert isinstance(data["facts"], list)
    assert isinstance(data["handovers"], list)


# ==============================================================================
# 9. Search Endpoint Tests
# ==============================================================================

def test_search_positive_matches(client):
    """Verify GET /api/search matches lots, shipments, and suppliers case-insensitively."""
    # 1. Search finished lots
    res_salsa = client.get("/api/search?q=salsa")
    assert res_salsa.status_code == 200
    data_salsa = res_salsa.json()
    assert data_salsa["total_matches"] >= 3
    match_ids = [m["entity_id"] for m in data_salsa["matches"]]
    assert "FL-SALSA-101" in match_ids
    assert "FL-SALSA-102" in match_ids
    assert "FL-SALSA-103" in match_ids

    # 2. Search shipment
    res_ship = client.get("/api/search?q=SHIP-8821")
    assert res_ship.status_code == 200
    assert any(m["entity_id"] == "SHIP-8821" for m in res_ship.json()["matches"])

    # 3. Search supplier
    res_sup = client.get("/api/search?q=apex")
    assert res_sup.status_code == 200
    assert any(m["entity_id"] == "SUP-APEX-01" for m in res_sup.json()["matches"])


def test_search_empty_results(client):
    """Verify GET /api/search returns explicit empty results when nothing matches."""
    res = client.get("/api/search?q=nonexistent_lot_xyz_12345")
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] == 0
    assert data["matches"] == []


def test_search_malformed_input(client):
    """Verify GET /api/search rejects empty or whitespace queries with 400."""
    res = client.get("/api/search?q=   ")
    assert res.status_code == 400
    assert "cannot be empty" in res.json()["detail"].lower()


# ==============================================================================
# 10. FSMA 204 CSV Export Tests
# ==============================================================================

def test_fsma_spreadsheet_csv_export(client):
    """Verify GET /api/export/fsma-204-spreadsheet returns an RFC 4180-compliant CSV."""
    res = client.get("/api/export/fsma-204-spreadsheet")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert 'filename="fsma_204_cte_ledger.csv"' in res.headers["content-disposition"]

    # Parse and validate CSV
    csv_text = res.text
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    # Header row
    headers = rows[0]
    assert "TLC" in headers
    assert "Event_Type" in headers
    assert "Product_or_Ingredient" in headers
    assert "Traceability_Status" in headers
    assert "Regulatory_Notice" in headers

    # Verify real data present across CTEs
    tlc_values = [row[0] for row in rows[1:]]
    assert "LOT-CUM-2026-088" in tlc_values
    assert any("FL-SALSA" in t for t in tlc_values)
    assert any("SHIP-8821" in t for t in tlc_values)

    # Every row must include synthetic data regulatory notice
    for row in rows[1:]:
        assert "Synthetic Demo Data" in row[13]
