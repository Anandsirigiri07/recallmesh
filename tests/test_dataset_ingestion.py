"""Tests for Real-Data Ingestion, Validation, Dataset Isolation, and Independent Tracing.

Verifies:
- In-memory schema validation rejects invalid payloads with actionable errors.
- Referential integrity (unlinked suppliers, missing raw lots, etc.) blocks database mutation.
- JSON and CSV CTE ingestion populate FalkorDB idempotently.
- Dataset-aware provenance isolation (is_demo=False vs Demo).
- Tracing, gap detection, and action plans work seamlessly on independent datasets.
"""

import json
import pytest
from fastapi.testclient import TestClient

from src.recallmesh.api.app import app
from src.recallmesh.connection import get_graph
from src.recallmesh.ingestion import (
    get_sample_csv_template,
    get_sample_poultry_dataset,
    ingest_dataset,
    list_datasets,
    parse_csv_cte_dataset,
    validate_dataset,
)
from src.recallmesh.tracer import (
    build_containment_action_plan,
    detect_traceability_gaps,
    trace_downstream,
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def graph():
    return get_graph()


def test_validation_rejects_missing_metadata():
    invalid_data = {"suppliers": []}
    is_valid, errors = validate_dataset(invalid_data)
    assert not is_valid
    assert any("dataset_metadata" in err for err in errors)


def test_validation_rejects_unreferenced_supplier_and_ingredient():
    data = {
        "dataset_metadata": {
            "dataset_id": "DS-TEST-ERR",
            "name": "Error Test Dataset",
        },
        "suppliers": [
            {"supplier_id": "SUP-01", "name": "Valid Supplier"}
        ],
        "ingredients": [
            {"ingredient_id": "ING-01", "common_name": "Valid Ingredient"}
        ],
        "raw_lots": [
            {
                "lot_code": "LOT-ERR-01",
                "supplier_id": "SUP-NONEXISTENT",
                "ingredient_id": "ING-01",
            },
            {
                "lot_code": "LOT-ERR-02",
                "supplier_id": "SUP-01",
                "ingredient_id": "ING-NONEXISTENT",
            },
        ],
    }
    is_valid, errors = validate_dataset(data)
    assert not is_valid
    assert any("SUP-NONEXISTENT" in err for err in errors)
    assert any("ING-NONEXISTENT" in err for err in errors)


def test_validation_rejects_duplicate_identifiers():
    data = {
        "dataset_metadata": {
            "dataset_id": "DS-TEST-DUP",
            "name": "Duplicate Test Dataset",
        },
        "suppliers": [
            {"supplier_id": "SUP-DUP", "name": "Supplier One"},
            {"supplier_id": "SUP-DUP", "name": "Supplier Two"},
        ],
        "ingredients": [
            {"ingredient_id": "ING-DUP", "common_name": "Ing One"},
            {"ingredient_id": "ING-DUP", "common_name": "Ing Two"},
        ],
    }
    is_valid, errors = validate_dataset(data)
    assert not is_valid
    assert any("duplicate supplier_id 'SUP-DUP'" in err for err in errors)
    assert any("duplicate ingredient_id 'ING-DUP'" in err for err in errors)


def test_validation_accepts_sample_poultry_dataset():
    data = get_sample_poultry_dataset()
    is_valid, errors = validate_dataset(data)
    assert is_valid, f"Validation errors: {errors}"
    assert len(errors) == 0


def test_ingest_sample_poultry_dataset_idempotent(graph):
    data = get_sample_poultry_dataset()
    counts = ingest_dataset(graph, data, is_demo=False, actor="QA Integration Test")

    assert counts["dataset_id"] == "DS-MIDWEST-POULTRY-01"
    assert counts["raw_lots"] == 2
    assert counts["finished_lots"] == 3
    assert counts["shipments"] == 2

    # Second ingestion must be completely idempotent without creating duplicate nodes
    counts2 = ingest_dataset(graph, data, is_demo=False, actor="QA Integration Test Retry")
    assert counts2["dataset_id"] == "DS-MIDWEST-POULTRY-01"

    # Query FalkorDB directly to verify exact count of RawLot in this dataset
    res = graph.query(
        "MATCH (r:RawLot {dataset_id: 'DS-MIDWEST-POULTRY-01'}) RETURN count(r)"
    )
    assert res.result_set[0][0] == 2


def test_independent_dataset_tracing_and_gaps(graph):
    # Trace the suspect raw lot from the Midwest Poultry dataset
    downstream = trace_downstream(graph, "LOT-PLT-2026-401")
    assert downstream["suspect_raw_lot"] == "LOT-PLT-2026-401"
    
    # Must trace forward to FL-CUTLET-501 and SHIP-PLT-9001
    affected_fl_codes = [f["lot_code"] for f in downstream["affected_finished_lots"]]
    assert "FL-CUTLET-501" in affected_fl_codes
    # Clean control lot FL-CUTLET-502 must NOT be in the blast radius
    assert "FL-CUTLET-502" not in affected_fl_codes

    affected_ship_ids = [s["shipment_id"] for s in downstream["affected_shipments"]]
    assert "SHIP-PLT-9001" in affected_ship_ids
    assert "SHIP-PLT-9002" not in affected_ship_ids

    # Gap detection must flag FL-CUTLET-503 (which lacks production event link)
    gaps = detect_traceability_gaps(graph)
    gap_lot_codes = [g["lot_code"] for g in gaps["gap_detected_finished_lots"]]
    assert "FL-CUTLET-503" in gap_lot_codes


def test_independent_dataset_action_plan(graph):
    # Action plan for poultry suspect lot
    plan = build_containment_action_plan(graph, "LOT-PLT-2026-401")
    assert plan["suspect_raw_lot"] == "LOT-PLT-2026-401"
    assert len(plan["proposed_actions"]) >= 2

    # Verify action targets the poultry finished lot and shipment
    target_ids = [a["target_id"] for a in plan["proposed_actions"]]
    assert "FL-CUTLET-501" in target_ids
    assert "SHIP-PLT-9001" in target_ids


def test_csv_cte_parsing_and_ingestion(graph):
    csv_text = get_sample_csv_template()
    parsed = parse_csv_cte_dataset(
        csv_text=csv_text,
        dataset_id="DS-CSV-TEST-01",
        dataset_name="CSV Test Poultry Run",
        suspect_root_lot="LOT-PLT-2026-401",
    )
    is_valid, errors = validate_dataset(parsed)
    assert is_valid, f"Parsed CSV validation errors: {errors}"

    counts = ingest_dataset(graph, parsed, is_demo=False, actor="CSV Test Operator")
    assert counts["dataset_id"] == "DS-CSV-TEST-01"
    assert counts["raw_lots"] >= 1
    assert counts["finished_lots"] >= 1
    assert counts["shipments"] >= 1


def test_api_list_datasets(client):
    res = client.get("/api/datasets")
    assert res.status_code == 200
    datasets = res.json()
    assert isinstance(datasets, list)
    assert len(datasets) >= 1
    ds_ids = [d["dataset_id"] for d in datasets]
    assert "demo" in ds_ids or "SCENARIO-VERDANT-01" in ds_ids or any(d["is_demo"] for d in datasets)


def test_api_get_templates(client):
    res_json = client.get("/api/datasets/template?format=json")
    assert res_json.status_code == 200
    assert "dataset_metadata" in res_json.json()

    res_csv = client.get("/api/datasets/template?format=csv")
    assert res_csv.status_code == 200
    assert "RECEIVING" in res_csv.text
    assert "TRANSFORMATION" in res_csv.text
    assert "SHIPPING" in res_csv.text


def test_api_import_dataset_validation_error(client):
    invalid_payload = {
        "format": "json",
        "payload": {
            "dataset_metadata": {"dataset_id": "DS-INVALID"},
            "suppliers": [],
            "raw_lots": [{"lot_code": "LOT-X", "supplier_id": "SUP-MISSING", "ingredient_id": "ING-MISSING"}],
        },
    }
    res = client.post("/api/datasets/import", json=invalid_payload)
    assert res.status_code == 422
    data = res.json()
    assert "errors" in data["detail"]
    assert len(data["detail"]["errors"]) >= 1


def test_api_import_dataset_success(client):
    poultry_data = get_sample_poultry_dataset()
    poultry_data["dataset_metadata"]["dataset_id"] = "DS-API-POULTRY-02"
    poultry_data["dataset_metadata"]["name"] = "API Test Poultry Dataset"

    payload = {
        "format": "json",
        "payload": poultry_data,
        "ingested_by": "Dr. Sarah Lin",
    }
    res = client.post("/api/datasets/import", json=payload)
    assert res.status_code == 201
    resp_data = res.json()
    assert resp_data["dataset_id"] == "DS-API-POULTRY-02"
    assert resp_data["is_demo"] is False
    assert resp_data["entity_counts"]["raw_lots"] == 2


def test_repeated_import_does_not_duplicate_audit_events(graph):
    poultry_data = get_sample_poultry_dataset()
    poultry_data["dataset_metadata"]["dataset_id"] = "DS-DEDUP-AUDIT-01"

    # Ingest twice
    ingest_dataset(graph, poultry_data, is_demo=False, actor="Audit Test 1")
    ingest_dataset(graph, poultry_data, is_demo=False, actor="Audit Test 2")

    # Verify exactly 1 AuditEvent exists for this dataset
    res = graph.query(
        "MATCH (a:AuditEvent {entity_id: 'DS-DEDUP-AUDIT-01', action_type: 'DATASET_INGESTED'}) RETURN count(a)"
    )
    assert res.result_set[0][0] == 1


def test_ingest_failure_triggers_rollback(graph, monkeypatch):
    test_ds = get_sample_poultry_dataset()
    test_ds["dataset_metadata"]["dataset_id"] = "DS-FAIL-ROLLBACK-01"

    original_query = graph.query

    # Force a failure when inserting finished_lots
    call_count = 0
    def failing_query(q, params=None):
        nonlocal call_count
        call_count += 1
        if "MERGE (f:FinishedLot" in q:
            raise RuntimeError("Simulated transient FalkorDB socket failure during finished lot write")
        return original_query(q, params)

    monkeypatch.setattr(graph, "query", failing_query)

    with pytest.raises(RuntimeError, match="Simulated transient FalkorDB socket failure"):
        ingest_dataset(graph, test_ds, is_demo=False, actor="Rollback Tester")

    # Restore original query to inspect graph
    monkeypatch.undo()

    # Verify rollback deleted any partially written nodes for this dataset
    res = graph.query(
        "MATCH (n {dataset_id: 'DS-FAIL-ROLLBACK-01'}) RETURN count(n)"
    )
    assert res.result_set[0][0] == 0


def test_dataset_isolation_with_matching_lot_code(graph):
    # Create two datasets that use the same raw lot code 'LOT-SHARED-99'
    ds_alpha = {
        "dataset_metadata": {"dataset_id": "DS-ALPHA", "name": "Alpha Stream", "suspect_root_lot": "LOT-SHARED-99"},
        "suppliers": [{"supplier_id": "SUP-ALPHA", "name": "Alpha Farm"}],
        "ingredients": [{"ingredient_id": "ING-A", "common_name": "Wheat A"}],
        "raw_lots": [{"lot_code": "LOT-SHARED-99", "supplier_id": "SUP-ALPHA", "ingredient_id": "ING-A"}],
        "production_events": [{"event_id": "PE-ALPHA", "consumed_raw_lots": ["LOT-SHARED-99"]}],
        "finished_lots": [{"lot_code": "FL-ALPHA-01", "product_name": "Alpha Bread", "production_event_id": "PE-ALPHA"}],
        "locations": [{"location_id": "LOC-ALPHA", "name": "Alpha Hub"}],
        "shipments": [{"shipment_id": "SHIP-ALPHA-01", "finished_lot_code": "FL-ALPHA-01", "destination_location_id": "LOC-ALPHA"}],
    }

    ds_beta = {
        "dataset_metadata": {"dataset_id": "DS-BETA", "name": "Beta Stream", "suspect_root_lot": "LOT-SHARED-99"},
        "suppliers": [{"supplier_id": "SUP-BETA", "name": "Beta Farm"}],
        "ingredients": [{"ingredient_id": "ING-B", "common_name": "Corn B"}],
        "raw_lots": [{"lot_code": "LOT-SHARED-99", "supplier_id": "SUP-BETA", "ingredient_id": "ING-B"}],
        "production_events": [{"event_id": "PE-BETA", "consumed_raw_lots": ["LOT-SHARED-99"]}],
        "finished_lots": [{"lot_code": "FL-BETA-02", "product_name": "Beta Chips", "production_event_id": "PE-BETA"}],
        "locations": [{"location_id": "LOC-BETA", "name": "Beta Hub"}],
        "shipments": [{"shipment_id": "SHIP-BETA-02", "finished_lot_code": "FL-BETA-02", "destination_location_id": "LOC-BETA"}],
    }

    ingest_dataset(graph, ds_alpha, is_demo=False)
    ingest_dataset(graph, ds_beta, is_demo=False)

    # Downstream trace with dataset_id='DS-ALPHA' must ONLY see FL-ALPHA-01 and SHIP-ALPHA-01
    downstream_alpha = trace_downstream(graph, "LOT-SHARED-99", dataset_id="DS-ALPHA")
    alpha_fls = [fl["lot_code"] for fl in downstream_alpha["affected_finished_lots"]]
    alpha_ships = [s["shipment_id"] for s in downstream_alpha["affected_shipments"]]
    assert "FL-ALPHA-01" in alpha_fls
    assert "FL-BETA-02" not in alpha_fls
    assert "SHIP-ALPHA-01" in alpha_ships
    assert "SHIP-BETA-02" not in alpha_ships

    # Downstream trace with dataset_id='DS-BETA' must ONLY see FL-BETA-02 and SHIP-BETA-02
    downstream_beta = trace_downstream(graph, "LOT-SHARED-99", dataset_id="DS-BETA")
    beta_fls = [fl["lot_code"] for fl in downstream_beta["affected_finished_lots"]]
    beta_ships = [s["shipment_id"] for s in downstream_beta["affected_shipments"]]
    assert "FL-BETA-02" in beta_fls
    assert "FL-ALPHA-01" not in beta_fls
    assert "SHIP-BETA-02" in beta_ships
    assert "SHIP-ALPHA-01" not in beta_ships

