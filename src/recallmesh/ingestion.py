"""Real-data ingestion engine, schema validation, and dataset isolation for RECALLMESH.

Provides:
- Strict in-memory pre-validation of records, identifiers, and relationship references.
- Dataset-aware provenance tagging (dataset_id, is_demo) to prevent entity collisions.
- Zero partial writes: aborts safely without database modification if validation fails.
- Idempotent Cypher MERGE ingestion with immutable AuditEvent logging.
- Support for both structured JSON and tabular FSMA 204 CTE CSV formats.
- Sample templates for verifiable live demonstration.
"""

import csv
from datetime import datetime, timezone
import io
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from falkordb import Graph

from src.recallmesh.schema import setup_schema
from src.recallmesh.audit import record_audit_event

logger = logging.getLogger(__name__)


def validate_dataset(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validates records, data types, identifiers, and relationship references in-memory.

    Guarantees that an invalid dataset is rejected before any mutation of FalkorDB.

    Returns:
        (is_valid, error_list)
    """
    errors: List[str] = []

    if not isinstance(data, dict):
        return False, ["Root dataset payload must be a JSON object."]

    # 1. Validate dataset_metadata
    meta = data.get("dataset_metadata")
    if not meta or not isinstance(meta, dict):
        errors.append("Missing required 'dataset_metadata' section.")
    else:
        dataset_id = str(meta.get("dataset_id") or "").strip()
        if not dataset_id:
            errors.append("dataset_metadata.dataset_id is required and cannot be empty.")
        elif not re.match(r"^[A-Za-z0-9_\-\.]+$", dataset_id):
            errors.append(f"dataset_metadata.dataset_id '{dataset_id}' contains invalid characters (use alphanumeric, dash, underscore, dot).")

        name = str(meta.get("name") or "").strip()
        if not name:
            errors.append("dataset_metadata.name is required.")

    # Sets to track declared identifiers for referential integrity checks
    declared_suppliers: Set[str] = set()
    declared_ingredients: Set[str] = set()
    declared_raw_lots: Set[str] = set()
    declared_prod_events: Set[str] = set()
    declared_finished_lots: Set[str] = set()
    declared_locations: Set[str] = set()
    declared_shipments: Set[str] = set()
    declared_evidence: Set[str] = set()
    declared_cases: Set[str] = set()

    # 2. Suppliers
    suppliers = data.get("suppliers", [])
    if not isinstance(suppliers, list):
        errors.append("'suppliers' must be a list.")
    else:
        for idx, s in enumerate(suppliers):
            if not isinstance(s, dict):
                errors.append(f"suppliers[{idx}]: item must be a JSON object.")
                continue
            s_id = str(s.get("supplier_id") or "").strip()
            if not s_id:
                errors.append(f"suppliers[{idx}]: 'supplier_id' is required.")
            elif s_id in declared_suppliers:
                errors.append(f"suppliers[{idx}]: duplicate supplier_id '{s_id}'.")
            else:
                declared_suppliers.add(s_id)

            if not str(s.get("name") or "").strip():
                errors.append(f"suppliers[{idx}] ('{s_id}'): 'name' is required.")

    # 3. Ingredients
    ingredients = data.get("ingredients", [])
    if not isinstance(ingredients, list):
        errors.append("'ingredients' must be a list.")
    else:
        for idx, ing in enumerate(ingredients):
            if not isinstance(ing, dict):
                errors.append(f"ingredients[{idx}]: item must be a JSON object.")
                continue
            i_id = str(ing.get("ingredient_id") or "").strip()
            if not i_id:
                errors.append(f"ingredients[{idx}]: 'ingredient_id' is required.")
            elif i_id in declared_ingredients:
                errors.append(f"ingredients[{idx}]: duplicate ingredient_id '{i_id}'.")
            else:
                declared_ingredients.add(i_id)

            if not str(ing.get("common_name") or "").strip():
                errors.append(f"ingredients[{idx}] ('{i_id}'): 'common_name' is required.")

    # 4. Raw Lots
    raw_lots = data.get("raw_lots", [])
    if not isinstance(raw_lots, list):
        errors.append("'raw_lots' must be a list.")
    else:
        for idx, rl in enumerate(raw_lots):
            if not isinstance(rl, dict):
                errors.append(f"raw_lots[{idx}]: item must be a JSON object.")
                continue
            l_code = str(rl.get("lot_code") or "").strip()
            if not l_code:
                errors.append(f"raw_lots[{idx}]: 'lot_code' is required.")
            elif l_code in declared_raw_lots:
                errors.append(f"raw_lots[{idx}]: duplicate raw lot_code '{l_code}'.")
            else:
                declared_raw_lots.add(l_code)

            sup_id = str(rl.get("supplier_id") or "").strip()
            if not sup_id:
                errors.append(f"raw_lots[{idx}] ('{l_code}'): 'supplier_id' is required.")
            elif sup_id not in declared_suppliers:
                errors.append(f"raw_lots[{idx}] ('{l_code}'): references undeclared supplier_id '{sup_id}'.")

            ing_id = str(rl.get("ingredient_id") or "").strip()
            if not ing_id:
                errors.append(f"raw_lots[{idx}] ('{l_code}'): 'ingredient_id' is required.")
            elif ing_id not in declared_ingredients:
                errors.append(f"raw_lots[{idx}] ('{l_code}'): references undeclared ingredient_id '{ing_id}'.")

            qty = rl.get("quantity_kg")
            if qty is not None and not isinstance(qty, (int, float)):
                errors.append(f"raw_lots[{idx}] ('{l_code}'): 'quantity_kg' must be a numeric value.")

    # 5. Production Events
    production_events = data.get("production_events", [])
    if not isinstance(production_events, list):
        errors.append("'production_events' must be a list.")
    else:
        for idx, pe in enumerate(production_events):
            if not isinstance(pe, dict):
                errors.append(f"production_events[{idx}]: item must be a JSON object.")
                continue
            p_id = str(pe.get("event_id") or "").strip()
            if not p_id:
                errors.append(f"production_events[{idx}]: 'event_id' is required.")
            elif p_id in declared_prod_events:
                errors.append(f"production_events[{idx}]: duplicate production event_id '{p_id}'.")
            else:
                declared_prod_events.add(p_id)

            consumed = pe.get("consumed_raw_lots", [])
            if not isinstance(consumed, list):
                errors.append(f"production_events[{idx}] ('{p_id}'): 'consumed_raw_lots' must be a list.")
            else:
                for c_lot in consumed:
                    c_lot_clean = str(c_lot or "").strip()
                    if c_lot_clean not in declared_raw_lots:
                        errors.append(f"production_events[{idx}] ('{p_id}'): consumed_raw_lot '{c_lot_clean}' is not declared in raw_lots.")

    # 6. Finished Lots
    finished_lots = data.get("finished_lots", [])
    if not isinstance(finished_lots, list):
        errors.append("'finished_lots' must be a list.")
    else:
        for idx, fl in enumerate(finished_lots):
            if not isinstance(fl, dict):
                errors.append(f"finished_lots[{idx}]: item must be a JSON object.")
                continue
            fl_code = str(fl.get("lot_code") or "").strip()
            if not fl_code:
                errors.append(f"finished_lots[{idx}]: 'lot_code' is required.")
            elif fl_code in declared_finished_lots:
                errors.append(f"finished_lots[{idx}]: duplicate finished lot_code '{fl_code}'.")
            else:
                declared_finished_lots.add(fl_code)

            if not str(fl.get("product_name") or "").strip():
                errors.append(f"finished_lots[{idx}] ('{fl_code}'): 'product_name' is required.")

            pe_ref = fl.get("production_event_id")
            if pe_ref:
                pe_ref_clean = str(pe_ref).strip()
                if pe_ref_clean not in declared_prod_events:
                    errors.append(f"finished_lots[{idx}] ('{fl_code}'): references undeclared production_event_id '{pe_ref_clean}'.")

    # 7. Locations
    locations = data.get("locations", [])
    if not isinstance(locations, list):
        errors.append("'locations' must be a list.")
    else:
        for idx, loc in enumerate(locations):
            if not isinstance(loc, dict):
                errors.append(f"locations[{idx}]: item must be a JSON object.")
                continue
            loc_id = str(loc.get("location_id") or "").strip()
            if not loc_id:
                errors.append(f"locations[{idx}]: 'location_id' is required.")
            elif loc_id in declared_locations:
                errors.append(f"locations[{idx}]: duplicate location_id '{loc_id}'.")
            else:
                declared_locations.add(loc_id)

            if not str(loc.get("name") or "").strip():
                errors.append(f"locations[{idx}] ('{loc_id}'): 'name' is required.")

    # 8. Shipments
    shipments = data.get("shipments", [])
    if not isinstance(shipments, list):
        errors.append("'shipments' must be a list.")
    else:
        for idx, sh in enumerate(shipments):
            if not isinstance(sh, dict):
                errors.append(f"shipments[{idx}]: item must be a JSON object.")
                continue
            s_id = str(sh.get("shipment_id") or "").strip()
            if not s_id:
                errors.append(f"shipments[{idx}]: 'shipment_id' is required.")
            elif s_id in declared_shipments:
                errors.append(f"shipments[{idx}]: duplicate shipment_id '{s_id}'.")
            else:
                declared_shipments.add(s_id)

            fl_ref = str(sh.get("finished_lot_code") or "").strip()
            if not fl_ref:
                errors.append(f"shipments[{idx}] ('{s_id}'): 'finished_lot_code' is required.")
            elif fl_ref not in declared_finished_lots:
                errors.append(f"shipments[{idx}] ('{s_id}'): references undeclared finished_lot_code '{fl_ref}'.")

            dest_ref = str(sh.get("destination_location_id") or "").strip()
            if not dest_ref:
                errors.append(f"shipments[{idx}] ('{s_id}'): 'destination_location_id' is required.")
            elif dest_ref not in declared_locations:
                errors.append(f"shipments[{idx}] ('{s_id}'): references undeclared destination_location_id '{dest_ref}'.")

    # 9. Evidence
    evidence_list = data.get("evidence", [])
    if isinstance(evidence_list, list):
        for idx, ev in enumerate(evidence_list):
            if not isinstance(ev, dict):
                continue
            ev_id = str(ev.get("evidence_id") or "").strip()
            if not ev_id:
                errors.append(f"evidence[{idx}]: 'evidence_id' is required.")
            elif ev_id in declared_evidence:
                errors.append(f"evidence[{idx}]: duplicate evidence_id '{ev_id}'.")
            else:
                declared_evidence.add(ev_id)

            t_lot = ev.get("target_lot_code")
            if t_lot:
                t_lot_clean = str(t_lot).strip()
                if t_lot_clean not in declared_raw_lots and t_lot_clean not in declared_finished_lots:
                    errors.append(f"evidence[{idx}] ('{ev_id}'): target_lot_code '{t_lot_clean}' is not declared in raw_lots or finished_lots.")

    # 10. Recall Cases
    cases = data.get("recall_cases", [])
    if isinstance(cases, list):
        for idx, rc in enumerate(cases):
            if not isinstance(rc, dict):
                continue
            c_id = str(rc.get("case_id") or "").strip()
            if not c_id:
                errors.append(f"recall_cases[{idx}]: 'case_id' is required.")
            elif c_id in declared_cases:
                errors.append(f"recall_cases[{idx}]: duplicate case_id '{c_id}'.")
            else:
                declared_cases.add(c_id)

            t_raw = rc.get("target_raw_lot")
            if t_raw:
                t_raw_clean = str(t_raw).strip()
                if t_raw_clean not in declared_raw_lots:
                    errors.append(f"recall_cases[{idx}] ('{c_id}'): target_raw_lot '{t_raw_clean}' is not declared in raw_lots.")

    # Suspect root lot check in metadata
    if meta and meta.get("suspect_root_lot"):
        s_root = str(meta.get("suspect_root_lot")).strip()
        if s_root and s_root not in declared_raw_lots:
            errors.append(f"dataset_metadata.suspect_root_lot '{s_root}' is not declared in raw_lots.")

    return len(errors) == 0, errors


def parse_csv_cte_dataset(
    csv_text: str,
    dataset_id: str,
    dataset_name: str,
    suspect_root_lot: Optional[str] = None,
    facility_id: str = "FAC-DEFAULT-01",
    ingested_by: str = "QA Data Ingestion Specialist",
) -> Dict[str, Any]:
    """Parses standard FSMA 204 Critical Tracking Event (CTE) tabular CSV into structured dataset.

    Supports columns:
    event_type,event_id,timestamp,lot_code,ingredient_id,ingredient_name,supplier_id,supplier_name,product_name,units,destination_id,destination_name,carrier_name,disposition,notes
    """
    f = io.StringIO(csv_text.strip())
    reader = csv.DictReader(f)

    suppliers: Dict[str, Dict[str, Any]] = {}
    ingredients: Dict[str, Dict[str, Any]] = {}
    raw_lots: Dict[str, Dict[str, Any]] = {}
    production_events: Dict[str, Dict[str, Any]] = {}
    finished_lots: Dict[str, Dict[str, Any]] = {}
    locations: Dict[str, Dict[str, Any]] = {}
    shipments: Dict[str, Dict[str, Any]] = {}

    inferred_root_lot = suspect_root_lot

    for row in reader:
        event_type = (row.get("event_type") or "").strip().upper()
        evt_id = (row.get("event_id") or "").strip()
        ts = (row.get("timestamp") or "").strip() or datetime.now(timezone.utc).isoformat()
        lot = (row.get("lot_code") or "").strip()

        if event_type == "RECEIVING":
            sup_id = (row.get("supplier_id") or "SUP-UNKNOWN").strip()
            sup_name = (row.get("supplier_name") or sup_id).strip()
            suppliers[sup_id] = {
                "supplier_id": sup_id,
                "name": sup_name,
                "gln": row.get("gln") or "0000000000000",
                "risk_rating": "LOW",
                "active": True,
            }

            ing_id = (row.get("ingredient_id") or "ING-RAW-DEFAULT").strip()
            ing_name = (row.get("ingredient_name") or ing_id).strip()
            ingredients[ing_id] = {
                "ingredient_id": ing_id,
                "common_name": ing_name,
                "allergen_flags": [],
                "ftl_category": "GENERAL",
            }

            raw_lots[lot] = {
                "lot_code": lot,
                "ingredient_id": ing_id,
                "supplier_id": sup_id,
                "received_at": ts,
                "quantity_kg": float(row.get("units") or 100.0),
                "disposition": (row.get("disposition") or "QUARANTINED").strip(),
                "traceability_status": "VERIFIED",
                "notes": row.get("notes") or "",
            }
            if not inferred_root_lot:
                inferred_root_lot = lot

        elif event_type == "TRANSFORMATION":
            consumed_lot = (row.get("consumed_lot_code") or row.get("raw_lot_code") or inferred_root_lot or "").strip()
            prod_evt_id = evt_id or f"PROD-{lot}"

            production_events[prod_evt_id] = {
                "event_id": prod_evt_id,
                "facility_id": row.get("facility_id") or facility_id,
                "line_id": row.get("line_id") or "LINE-01",
                "started_at": ts,
                "completed_at": ts,
                "operator_id": "OP-01",
                "consumed_raw_lots": [consumed_lot] if consumed_lot else [],
            }

            finished_lots[lot] = {
                "lot_code": lot,
                "product_name": (row.get("product_name") or f"Product {lot}").strip(),
                "sku": row.get("sku") or f"SKU-{lot}",
                "units_produced": int(float(row.get("units") or 100)),
                "best_by_date": row.get("best_by_date") or "2027-01-01",
                "disposition": (row.get("disposition") or "AVAILABLE").strip(),
                "traceability_status": "VERIFIED",
                "production_event_id": prod_evt_id,
                "notes": row.get("notes") or "",
            }

        elif event_type == "SHIPPING":
            loc_id = (row.get("destination_id") or row.get("location_id") or "LOC-DEST-01").strip()
            loc_name = (row.get("destination_name") or loc_id).strip()
            locations[loc_id] = {
                "location_id": loc_id,
                "name": loc_name,
                "gln": "0000000000000",
                "contact_email": "logistics@example.com",
                "state_code": "US",
            }

            ship_id = evt_id or f"SHIP-{lot}"
            shipments[ship_id] = {
                "shipment_id": ship_id,
                "finished_lot_code": lot,
                "destination_location_id": loc_id,
                "carrier_name": (row.get("carrier_name") or "Express Freight").strip(),
                "dispatched_at": ts,
                "units_shipped": int(float(row.get("units") or 50)),
                "shipping_disposition": "IN_TRANSIT",
                "traceability_status": "VERIFIED",
            }

    return {
        "dataset_metadata": {
            "dataset_id": dataset_id,
            "name": dataset_name,
            "description": f"Imported FSMA 204 tabular CTE dataset ({dataset_name})",
            "facility_id": facility_id,
            "suspect_root_lot": inferred_root_lot,
            "ingested_by": ingested_by,
        },
        "suppliers": list(suppliers.values()),
        "ingredients": list(ingredients.values()),
        "raw_lots": list(raw_lots.values()),
        "production_events": list(production_events.values()),
        "finished_lots": list(finished_lots.values()),
        "locations": list(locations.values()),
        "shipments": list(shipments.values()),
        "evidence": [],
        "recall_cases": [],
    }


def ingest_dataset(
    graph: Graph,
    data: Dict[str, Any],
    is_demo: bool = False,
    actor: str = "QA Ingestion Worker",
) -> Dict[str, Any]:
    """Ingests a verified dataset into FalkorDB with dataset provenance isolation.

    Validates everything first. If validation fails, raises ValueError and touches nothing.
    Uses Cypher MERGE on composite keys for retry idempotency.
    """
    is_valid, validation_errors = validate_dataset(data)
    if not is_valid:
        raise ValueError(f"Dataset validation failed: {'; '.join(validation_errors)}")

    setup_schema(graph)

    meta = data["dataset_metadata"]
    dataset_id = str(meta["dataset_id"]).strip()
    dataset_name = str(meta["name"]).strip()
    suspect_root_lot = str(meta.get("suspect_root_lot") or "").strip() or None
    facility_id = str(meta.get("facility_id") or "FAC-DEFAULT").strip()
    description = str(meta.get("description") or f"Dataset {dataset_name}").strip()
    ingested_at = datetime.now(timezone.utc).isoformat()

    counts = {
        "dataset_id": dataset_id,
        "name": dataset_name,
        "suppliers": 0,
        "ingredients": 0,
        "raw_lots": 0,
        "production_events": 0,
        "finished_lots": 0,
        "locations": 0,
        "shipments": 0,
        "evidence": 0,
        "recall_cases": 0,
    }

    try:
        # 1. Merge Dataset node
        graph.query(
            """
            MERGE (d:Dataset {dataset_id: $dataset_id})
            SET d.name = $name,
                d.description = $description,
                d.facility_id = $facility_id,
                d.suspect_root_lot = $suspect_root_lot,
                d.ingested_at = $ingested_at,
                d.is_demo = $is_demo,
                d.ingested_by = $actor
            """,
            {
                "dataset_id": dataset_id,
                "name": dataset_name,
                "description": description,
                "facility_id": facility_id,
                "suspect_root_lot": suspect_root_lot,
                "ingested_at": ingested_at,
                "is_demo": is_demo,
                "actor": actor,
            },
        )

        # 2. Suppliers
        for s in data.get("suppliers", []):
            graph.query(
                """
                MERGE (sup:Supplier {supplier_id: $supplier_id, dataset_id: $dataset_id})
                SET sup.name = $name,
                    sup.gln = $gln,
                    sup.risk_rating = $risk_rating,
                    sup.active = $active,
                    sup.is_demo = $is_demo
                """,
                {
                    "supplier_id": s["supplier_id"],
                    "name": s["name"],
                    "gln": s.get("gln", ""),
                    "risk_rating": s.get("risk_rating", "LOW"),
                    "active": s.get("active", True),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            counts["suppliers"] += 1

        # 3. Ingredients
        for ing in data.get("ingredients", []):
            graph.query(
                """
                MERGE (i:Ingredient {ingredient_id: $ingredient_id, dataset_id: $dataset_id})
                SET i.common_name = $common_name,
                    i.allergen_flags = $allergen_flags,
                    i.ftl_category = $ftl_category,
                    i.is_demo = $is_demo
                """,
                {
                    "ingredient_id": ing["ingredient_id"],
                    "common_name": ing["common_name"],
                    "allergen_flags": ing.get("allergen_flags", "NONE"),
                    "ftl_category": ing.get("ftl_category", "NONE"),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            counts["ingredients"] += 1

        # 4. Raw Lots
        for rl in data.get("raw_lots", []):
            graph.query(
                """
                MERGE (r:RawLot {lot_code: $lot_code, dataset_id: $dataset_id})
                SET r.received_at = $received_at,
                    r.quantity_kg = $quantity_kg,
                    r.disposition = $disposition,
                    r.traceability_status = $traceability_status,
                    r.notes = $notes,
                    r.is_demo = $is_demo
                WITH r
                MATCH (sup:Supplier {supplier_id: $supplier_id, dataset_id: $dataset_id})
                MATCH (ing:Ingredient {ingredient_id: $ingredient_id, dataset_id: $dataset_id})
                MERGE (sup)-[:SUPPLIES]->(ing)
                MERGE (sup)-[:ORIGINATED]->(r)
                MERGE (r)-[:INSTANCE_OF]->(ing)
                """,
                {
                    "lot_code": rl["lot_code"],
                    "received_at": rl.get("received_at", ingested_at),
                    "quantity_kg": rl.get("quantity_kg", 0.0),
                    "disposition": rl.get("disposition", "AVAILABLE"),
                    "traceability_status": rl.get("traceability_status", "VERIFIED"),
                    "notes": rl.get("notes", ""),
                    "supplier_id": rl["supplier_id"],
                    "ingredient_id": rl["ingredient_id"],
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            counts["raw_lots"] += 1

        # 5. Production Events
        for pe in data.get("production_events", []):
            graph.query(
                """
                MERGE (p:ProductionEvent {event_id: $event_id, dataset_id: $dataset_id})
                SET p.facility_id = $facility_id,
                    p.line_id = $line_id,
                    p.started_at = $started_at,
                    p.completed_at = $completed_at,
                    p.operator_id = $operator_id,
                    p.is_demo = $is_demo
                """,
                {
                    "event_id": pe["event_id"],
                    "facility_id": pe.get("facility_id", facility_id),
                    "line_id": pe.get("line_id", "LINE-01"),
                    "started_at": pe.get("started_at"),
                    "completed_at": pe.get("completed_at"),
                    "operator_id": pe.get("operator_id", "OP-01"),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            for raw_lot_code in pe.get("consumed_raw_lots", []):
                graph.query(
                    """
                    MATCH (r:RawLot {lot_code: $raw_lot_code, dataset_id: $dataset_id})
                    MATCH (p:ProductionEvent {event_id: $event_id, dataset_id: $dataset_id})
                    MERGE (r)-[:CONSUMED_IN]->(p)
                    """,
                    {"raw_lot_code": raw_lot_code, "event_id": pe["event_id"], "dataset_id": dataset_id},
                )
            counts["production_events"] += 1

        # 6. Finished Lots
        for fl in data.get("finished_lots", []):
            graph.query(
                """
                MERGE (f:FinishedLot {lot_code: $lot_code, dataset_id: $dataset_id})
                SET f.product_name = $product_name,
                    f.sku = $sku,
                    f.units_produced = $units_produced,
                    f.best_by_date = $best_by_date,
                    f.disposition = $disposition,
                    f.traceability_status = $traceability_status,
                    f.notes = $notes,
                    f.is_demo = $is_demo
                """,
                {
                    "lot_code": fl["lot_code"],
                    "product_name": fl["product_name"],
                    "sku": fl.get("sku", f"SKU-{fl['lot_code']}"),
                    "units_produced": fl.get("units_produced", 0),
                    "best_by_date": fl.get("best_by_date"),
                    "disposition": fl.get("disposition", "AVAILABLE"),
                    "traceability_status": fl.get("traceability_status", "VERIFIED"),
                    "notes": fl.get("notes", ""),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            pe_id = fl.get("production_event_id")
            if pe_id:
                graph.query(
                    """
                    MATCH (p:ProductionEvent {event_id: $event_id, dataset_id: $dataset_id})
                    MATCH (f:FinishedLot {lot_code: $lot_code, dataset_id: $dataset_id})
                    MERGE (p)-[:PRODUCED]->(f)
                    """,
                    {"event_id": pe_id, "lot_code": fl["lot_code"], "dataset_id": dataset_id},
                )
            counts["finished_lots"] += 1

        # 7. Locations
        for loc in data.get("locations", []):
            graph.query(
                """
                MERGE (l:Location {location_id: $location_id, dataset_id: $dataset_id})
                SET l.name = $name,
                    l.gln = $gln,
                    l.contact_email = $contact_email,
                    l.state_code = $state_code,
                    l.is_demo = $is_demo
                """,
                {
                    "location_id": loc["location_id"],
                    "name": loc["name"],
                    "gln": loc.get("gln", ""),
                    "contact_email": loc.get("contact_email", ""),
                    "state_code": loc.get("state_code", ""),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            counts["locations"] += 1

        # 8. Shipments
        for sh in data.get("shipments", []):
            graph.query(
                """
                MERGE (s:Shipment {shipment_id: $shipment_id, dataset_id: $dataset_id})
                SET s.carrier_name = $carrier_name,
                    s.dispatched_at = $dispatched_at,
                    s.units_shipped = $units_shipped,
                    s.shipping_disposition = $shipping_disposition,
                    s.traceability_status = $traceability_status,
                    s.is_demo = $is_demo
                WITH s
                MATCH (f:FinishedLot {lot_code: $finished_lot_code, dataset_id: $dataset_id})
                MATCH (l:Location {location_id: $destination_location_id, dataset_id: $dataset_id})
                MERGE (f)-[:PACKAGED_INTO]->(s)
                MERGE (s)-[:SHIPPED_TO]->(l)
                """,
                {
                    "shipment_id": sh["shipment_id"],
                    "carrier_name": sh.get("carrier_name", "Standard Freight"),
                    "dispatched_at": sh.get("dispatched_at"),
                    "units_shipped": sh.get("units_shipped", 0),
                    "shipping_disposition": sh.get("shipping_disposition", "DISPATCHED"),
                    "traceability_status": sh.get("traceability_status", "DELIVERED"),
                    "finished_lot_code": sh["finished_lot_code"],
                    "destination_location_id": sh["destination_location_id"],
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            counts["shipments"] += 1

        # 9. Evidence
        for ev in data.get("evidence", []):
            graph.query(
                """
                MERGE (e:Evidence {evidence_id: $evidence_id, dataset_id: $dataset_id})
                SET e.evidence_type = $evidence_type,
                    e.title = $title,
                    e.source_uri = $source_uri,
                    e.hash_sha256 = $hash_sha256,
                    e.recorded_at = $recorded_at,
                    e.confidence_score = $confidence_score,
                    e.is_demo = $is_demo
                """,
                {
                    "evidence_id": ev["evidence_id"],
                    "evidence_type": ev.get("evidence_type", "LABORATORY_REPORT"),
                    "title": ev.get("title", f"Evidence {ev['evidence_id']}"),
                    "source_uri": ev.get("source_uri", ""),
                    "hash_sha256": ev.get("hash_sha256", "0" * 64),
                    "recorded_at": ev.get("recorded_at", ingested_at),
                    "confidence_score": ev.get("confidence_score", 1.0),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            target_lot = ev.get("target_lot_code")
            if target_lot:
                graph.query(
                    """
                    MATCH (e:Evidence {evidence_id: $evidence_id, dataset_id: $dataset_id})
                    MATCH (r:RawLot {lot_code: $target_lot_code, dataset_id: $dataset_id})
                    MERGE (e)-[:SUPPORTS]->(r)
                    """,
                    {"evidence_id": ev["evidence_id"], "target_lot_code": target_lot, "dataset_id": dataset_id},
                )
            counts["evidence"] += 1

        # 10. Recall Cases
        for rc in data.get("recall_cases", []):
            graph.query(
                """
                MERGE (c:RecallCase {case_id: $case_id, dataset_id: $dataset_id})
                SET c.opened_at = $opened_at,
                    c.hazard_type = $hazard_type,
                    c.pathogen_or_hazard = $pathogen_or_hazard,
                    c.provisional_class = $provisional_class,
                    c.lifecycle_status = $lifecycle_status,
                    c.lead_investigator = $lead_investigator,
                    c.is_demo = $is_demo
                """,
                {
                    "case_id": rc["case_id"],
                    "opened_at": rc.get("opened_at", ingested_at),
                    "hazard_type": rc.get("hazard_type", "BIOLOGICAL"),
                    "pathogen_or_hazard": rc.get("pathogen_or_hazard", "Contaminant"),
                    "provisional_class": rc.get("provisional_class", "Class I"),
                    "lifecycle_status": rc.get("lifecycle_status", "ACTIVE_INVESTIGATION"),
                    "lead_investigator": rc.get("lead_investigator", actor),
                    "dataset_id": dataset_id,
                    "is_demo": is_demo,
                },
            )
            target_raw = rc.get("target_raw_lot")
            if target_raw:
                graph.query(
                    """
                    MATCH (c:RecallCase {case_id: $case_id, dataset_id: $dataset_id})
                    MATCH (r:RawLot {lot_code: $target_raw_lot, dataset_id: $dataset_id})
                    MERGE (c)-[:INVESTIGATES]->(r)
                    """,
                    {"case_id": rc["case_id"], "target_raw_lot": target_raw, "dataset_id": dataset_id},
                )
            counts["recall_cases"] += 1

        # 11. Immutable Audit Trail (Merged by entity_id to prevent duplicate entries on retry)
        total_entities = (
            counts["suppliers"]
            + counts["ingredients"]
            + counts["raw_lots"]
            + counts["production_events"]
            + counts["finished_lots"]
            + counts["locations"]
            + counts["shipments"]
            + counts["evidence"]
            + counts["recall_cases"]
        )

        graph.query(
            """
            MERGE (aud:AuditEvent {entity_id: $dataset_id, action_type: 'DATASET_INGESTED'})
            SET aud.event_id = $event_id,
                aud.timestamp = $timestamp,
                aud.outcome = 'SUCCESS',
                aud.actor = $actor,
                aud.details = $details,
                aud.is_simulation = $is_simulation
            """,
            {
                "dataset_id": dataset_id,
                "event_id": f"AUD-INGEST-{dataset_id}",
                "timestamp": ingested_at,
                "actor": actor,
                "details": f"Ingested dataset '{dataset_name}' ({dataset_id}): {total_entities} entities loaded (is_demo={is_demo}).",
                "is_simulation": is_demo,
            },
        )

    except Exception as e:
        logger.error(f"FalkorDB write error during ingestion of dataset '{dataset_id}': {e}. Triggering rollback cleanup.")
        try:
            graph.query("MATCH (n {dataset_id: $ds_id}) DETACH DELETE n", {"ds_id": dataset_id})
        except Exception as rb_err:
            logger.error(f"Failed to execute rollback cleanup for dataset '{dataset_id}': {rb_err}")
        raise e
    entity_counts = {
        "suppliers": counts["suppliers"],
        "ingredients": counts["ingredients"],
        "raw_lots": counts["raw_lots"],
        "production_events": counts["production_events"],
        "finished_lots": counts["finished_lots"],
        "locations": counts["locations"],
        "shipments": counts["shipments"],
        "evidence": counts["evidence"],
        "recall_cases": counts["recall_cases"],
    }

    return {
        "dataset_id": dataset_id,
        "name": dataset_name,
        "entity_counts": entity_counts,
        **entity_counts,
    }


def list_datasets(graph: Graph) -> List[Dict[str, Any]]:
    """Returns all declared datasets in FalkorDB with metadata and entity summaries."""
    # Ensure demo dataset node exists if demo nodes are present
    ensure_demo_dataset_node(graph)

    query = """
    MATCH (d:Dataset)
    OPTIONAL MATCH (r:RawLot {dataset_id: d.dataset_id})
    OPTIONAL MATCH (f:FinishedLot {dataset_id: d.dataset_id})
    RETURN d.dataset_id AS dataset_id,
           d.name AS name,
           d.description AS description,
           d.facility_id AS facility_id,
           d.suspect_root_lot AS suspect_root_lot,
           d.ingested_at AS ingested_at,
           d.is_demo AS is_demo,
           d.ingested_by AS ingested_by,
           count(DISTINCT r) AS raw_lot_count,
           count(DISTINCT f) AS finished_lot_count
    ORDER BY d.is_demo DESC, d.ingested_at DESC
    """
    res = graph.query(query)
    datasets = []
    for row in res.result_set:
        datasets.append({
            "dataset_id": row[0],
            "name": row[1] or row[0],
            "description": row[2] or "",
            "facility_id": row[3] or "",
            "suspect_root_lot": row[4] or "",
            "ingested_at": row[5] or "",
            "is_demo": bool(row[6]),
            "ingested_by": row[7] or "System",
            "raw_lot_count": row[8] or 0,
            "finished_lot_count": row[9] or 0,
        })
    return datasets


def ensure_demo_dataset_node(graph: Graph) -> None:
    """Ensures a fallback :Dataset node exists for the synthetic demo."""
    try:
        check = graph.query("MATCH (d:Dataset {dataset_id: 'demo'}) RETURN count(d)")
        if check.result_set and check.result_set[0][0] == 0:
            # Check if demo raw lot exists
            rl = graph.query("MATCH (r:RawLot {lot_code: 'LOT-CUM-2026-088'}) RETURN count(r)")
            if rl.result_set and rl.result_set[0][0] > 0:
                # Stamp existing demo nodes with dataset_id = 'demo' if not set
                graph.query(
                    """
                    MATCH (n)
                    WHERE n.dataset_id IS NULL
                    SET n.dataset_id = 'demo', n.is_demo = true
                    """
                )
                graph.query(
                    """
                    MERGE (d:Dataset {dataset_id: 'demo'})
                    SET d.name = 'Verdant Harvest Foods (Synthetic Demo)',
                        d.description = 'FSMA 204 Salmonella spice contamination and clean control benchmark',
                        d.facility_id = 'FAC-SALINAS-01',
                        d.suspect_root_lot = 'LOT-CUM-2026-088',
                        d.ingested_at = '2026-10-15T08:00:00Z',
                        d.is_demo = true,
                        d.ingested_by = 'System Demo Loader'
                    """
                )
    except Exception as e:
        logger.warning(f"Notice during ensure_demo_dataset_node: {e}")


def get_sample_poultry_dataset() -> Dict[str, Any]:
    """Returns a realistic, valid, independent supply chain dataset (Midwest Poultry Co.)."""
    return {
        "dataset_metadata": {
            "dataset_id": "DS-MIDWEST-POULTRY-01",
            "name": "Midwest Poultry Co. - Cutlet Incident Surveillance",
            "description": "Commercial poultry cutlet processing batch trace with Salmonella Enteritidis detection",
            "facility_id": "FAC-MIDWEST-09",
            "suspect_root_lot": "LOT-PLT-2026-401",
            "ingested_by": "Dr. Sarah Lin (Lead QA Epidemiologist)",
        },
        "suppliers": [
            {
                "supplier_id": "SUP-OZARK-01",
                "name": "Ozark Valley Farms",
                "gln": "0860003199001",
                "risk_rating": "LOW",
                "active": True,
            },
            {
                "supplier_id": "SUP-PRAIRIE-02",
                "name": "Prairie Grain Feeders",
                "gln": "0860003199002",
                "risk_rating": "LOW",
                "active": True,
            },
        ],
        "ingredients": [
            {
                "ingredient_id": "ING-RAW-CHICKEN",
                "common_name": "Fresh Boneless Chicken Breast",
                "allergen_flags": [],
                "ftl_category": "POULTRY",
            },
        ],
        "raw_lots": [
            {
                "lot_code": "LOT-PLT-2026-401",
                "ingredient_id": "ING-RAW-CHICKEN",
                "supplier_id": "SUP-OZARK-01",
                "received_at": "2026-10-01T08:00:00Z",
                "quantity_kg": 1200.0,
                "disposition": "QUARANTINED",
                "traceability_status": "VERIFIED",
                "notes": "Suspected positive for Salmonella Enteritidis",
            },
            {
                "lot_code": "LOT-PLT-2026-402",
                "ingredient_id": "ING-RAW-CHICKEN",
                "supplier_id": "SUP-PRAIRIE-02",
                "received_at": "2026-10-02T09:00:00Z",
                "quantity_kg": 800.0,
                "disposition": "AVAILABLE",
                "traceability_status": "VERIFIED",
                "notes": "Clean control lot from Prairie Grain Feeders",
            },
        ],
        "production_events": [
            {
                "event_id": "PROD-PLT-7701",
                "facility_id": "FAC-MIDWEST-09",
                "line_id": "LINE-01",
                "started_at": "2026-10-02T06:00:00Z",
                "completed_at": "2026-10-02T14:00:00Z",
                "operator_id": "OP-901",
                "consumed_raw_lots": ["LOT-PLT-2026-401"],
            },
            {
                "event_id": "PROD-PLT-7702",
                "facility_id": "FAC-MIDWEST-09",
                "line_id": "LINE-02",
                "started_at": "2026-10-03T07:00:00Z",
                "completed_at": "2026-10-03T15:00:00Z",
                "operator_id": "OP-902",
                "consumed_raw_lots": ["LOT-PLT-2026-402"],
            },
        ],
        "finished_lots": [
            {
                "lot_code": "FL-CUTLET-501",
                "product_name": "Seasoned Chicken Cutlets 24oz",
                "sku": "SKU-CHICK-CUTLET-24",
                "units_produced": 800,
                "best_by_date": "2026-11-15",
                "disposition": "AVAILABLE",
                "traceability_status": "VERIFIED",
                "production_event_id": "PROD-PLT-7701",
                "notes": "Packaged at Facility Line 1",
            },
            {
                "lot_code": "FL-CUTLET-502",
                "product_name": "Control Clean Cutlets 24oz",
                "sku": "SKU-CHICK-CUTLET-24",
                "units_produced": 500,
                "best_by_date": "2026-11-16",
                "disposition": "AVAILABLE",
                "traceability_status": "VERIFIED",
                "production_event_id": "PROD-PLT-7702",
                "notes": "Packaged at Facility Line 2 from control lot",
            },
            {
                "lot_code": "FL-CUTLET-503",
                "product_name": "Seasoned Chicken Cutlets 24oz (Unlinked)",
                "sku": "SKU-CHICK-CUTLET-24",
                "units_produced": 400,
                "best_by_date": "2026-11-15",
                "disposition": "AVAILABLE",
                "traceability_status": "UNKNOWN",
                "notes": "Missing upstream transformation link (evidence gap)",
            },
        ],
        "locations": [
            {
                "location_id": "LOC-CHI-HUB-01",
                "name": "Chicago Central Cold Hub",
                "gln": "0860003199099",
                "contact_email": "receiving@chicagocoldhub.example.com",
                "state_code": "IL",
            },
            {
                "location_id": "LOC-DET-HUB-02",
                "name": "Detroit Great Lakes Cold Storage",
                "gln": "0860003199098",
                "contact_email": "dock@detroitcold.example.com",
                "state_code": "MI",
            },
        ],
        "shipments": [
            {
                "shipment_id": "SHIP-PLT-9001",
                "finished_lot_code": "FL-CUTLET-501",
                "destination_location_id": "LOC-CHI-HUB-01",
                "carrier_name": "Midwest Cold Express",
                "dispatched_at": "2026-10-04T10:00:00Z",
                "units_shipped": 500,
                "shipping_disposition": "IN_TRANSIT",
                "traceability_status": "VERIFIED",
            },
            {
                "shipment_id": "SHIP-PLT-9002",
                "finished_lot_code": "FL-CUTLET-502",
                "destination_location_id": "LOC-DET-HUB-02",
                "carrier_name": "Great Lakes Logistics",
                "dispatched_at": "2026-10-05T08:00:00Z",
                "units_shipped": 300,
                "shipping_disposition": "DELIVERED",
                "traceability_status": "VERIFIED",
            },
        ],
        "evidence": [
            {
                "evidence_id": "EV-COA-PLT-401",
                "evidence_type": "CERTIFICATE_OF_ANALYSIS",
                "title": "Microbial Laboratory Screening Certificate",
                "source_uri": "s3://quality-docs/coa-plt-401.pdf",
                "hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "recorded_at": "2026-10-01T11:00:00Z",
                "confidence_score": 0.98,
                "target_lot_code": "LOT-PLT-2026-401",
            },
        ],
        "recall_cases": [
            {
                "case_id": "INC-PLT-2026-001",
                "title": "Salmonella in Midwest Poultry Cutlets",
                "opened_at": "2026-10-05T09:00:00Z",
                "hazard_type": "BIOLOGICAL",
                "pathogen_or_hazard": "Salmonella Enteritidis",
                "provisional_class": "Class I",
                "lifecycle_status": "ACTIVE_INVESTIGATION",
                "target_raw_lot": "LOT-PLT-2026-401",
                "lead_investigator": "Dr. Sarah Lin (Lead QA Epidemiologist)",
            },
        ],
    }


def get_sample_csv_template() -> str:
    """Returns sample RFC 4180 CSV representing Critical Tracking Events."""
    return """event_type,event_id,timestamp,lot_code,ingredient_id,ingredient_name,supplier_id,supplier_name,product_name,units,destination_id,destination_name,carrier_name,disposition,notes
RECEIVING,EVT-RCV-01,2026-10-01T08:00:00Z,LOT-PLT-2026-401,ING-RAW-CHICKEN,Fresh Boneless Chicken Breast,SUP-OZARK-01,Ozark Valley Farms,,1200,FAC-MIDWEST-09,Midwest Processing Line 1,,QUARANTINED,Suspected Salmonella
TRANSFORMATION,PROD-PLT-7701,2026-10-02T06:00:00Z,FL-CUTLET-501,ING-RAW-CHICKEN,Fresh Boneless Chicken Breast,SUP-OZARK-01,Ozark Valley Farms,Seasoned Chicken Cutlets 24oz,800,FAC-MIDWEST-09,Midwest Processing Line 1,,AVAILABLE,Cutlet transformation run
SHIPPING,SHIP-PLT-9001,2026-10-04T10:00:00Z,FL-CUTLET-501,,,,,,500,LOC-CHI-HUB-01,Chicago Central Cold Hub,Midwest Cold Express,IN_TRANSIT,Outbound cold shipment
"""
