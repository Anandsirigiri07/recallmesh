"""Deterministic, idempotent seed data loader for RECALLMESH graph.

Loads structured scenario fixtures into FalkorDB using Cypher MERGE statements.
Destructive graph resets are strictly explicit and require reset=True.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from falkordb import Graph

from src.recallmesh.schema import setup_schema

logger = logging.getLogger(__name__)


def load_scenario(
    fixture_path: str,
    graph: Graph,
    reset: bool = False,
) -> Dict[str, Any]:
    """Loads a scenario JSON fixture into FalkorDB idempotently.

    Args:
        fixture_path: Path to the JSON fixture file.
        graph: FalkorDB Graph instance.
        reset: If True, explicitly deletes existing graph data before loading.
               Defaults to False to prevent accidental data loss.

    Returns:
        Summary dict containing counts of entities loaded.
    """
    path = Path(fixture_path)
    if not path.is_file():
        raise FileNotFoundError(f"Fixture not found at: {fixture_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if reset:
        logger.info(f"Explicit graph reset requested for '{graph.name}'. Deleting existing graph.")
        try:
            graph.delete()
        except Exception as e:
            logger.info(f"Graph deletion notice (may not exist yet): {e}")

    # Ensure schema indices exist
    setup_schema(graph)

    counts = {
        "suppliers": 0,
        "ingredients": 0,
        "raw_lots": 0,
        "production_events": 0,
        "finished_lots": 0,
        "locations": 0,
        "shipments": 0,
        "evidence": 0,
        "recall_cases": 0,
        "org_units": 0,
    }

    # 1. Suppliers
    for s in data.get("suppliers", []):
        graph.query(
            """
            MERGE (sup:Supplier {supplier_id: $supplier_id})
            SET sup.name = $name,
                sup.gln = $gln,
                sup.risk_rating = $risk_rating,
                sup.active = $active
            """,
            s,
        )
        counts["suppliers"] += 1

    # 2. Ingredients
    for ing in data.get("ingredients", []):
        graph.query(
            """
            MERGE (i:Ingredient {ingredient_id: $ingredient_id})
            SET i.common_name = $common_name,
                i.allergen_flags = $allergen_flags,
                i.ftl_category = $ftl_category
            """,
            ing,
        )
        counts["ingredients"] += 1

    # 3. Raw Lots
    for rl in data.get("raw_lots", []):
        graph.query(
            """
            MERGE (r:RawLot {lot_code: $lot_code})
            SET r.received_at = $received_at,
                r.quantity_kg = $quantity_kg,
                r.disposition = $disposition,
                r.traceability_status = $traceability_status,
                r.notes = $notes
            WITH r
            MATCH (sup:Supplier {supplier_id: $supplier_id})
            MATCH (ing:Ingredient {ingredient_id: $ingredient_id})
            MERGE (sup)-[:SUPPLIES]->(ing)
            MERGE (sup)-[:ORIGINATED]->(r)
            MERGE (r)-[:INSTANCE_OF]->(ing)
            """,
            rl,
        )
        counts["raw_lots"] += 1

    # 4. Production Events
    for pe in data.get("production_events", []):
        graph.query(
            """
            MERGE (p:ProductionEvent {event_id: $event_id})
            SET p.facility_id = $facility_id,
                p.line_id = $line_id,
                p.started_at = $started_at,
                p.completed_at = $completed_at,
                p.operator_id = $operator_id
            """,
            {
                "event_id": pe["event_id"],
                "facility_id": pe["facility_id"],
                "line_id": pe["line_id"],
                "started_at": pe["started_at"],
                "completed_at": pe["completed_at"],
                "operator_id": pe["operator_id"],
            },
        )
        for raw_lot_code in pe.get("consumed_raw_lots", []):
            graph.query(
                """
                MATCH (r:RawLot {lot_code: $raw_lot_code})
                MATCH (p:ProductionEvent {event_id: $event_id})
                MERGE (r)-[:CONSUMED_IN]->(p)
                """,
                {"raw_lot_code": raw_lot_code, "event_id": pe["event_id"]},
            )
        counts["production_events"] += 1

    # 5. Finished Lots
    for fl in data.get("finished_lots", []):
        graph.query(
            """
            MERGE (f:FinishedLot {lot_code: $lot_code})
            SET f.product_name = $product_name,
                f.sku = $sku,
                f.units_produced = $units_produced,
                f.best_by_date = $best_by_date,
                f.disposition = $disposition,
                f.traceability_status = $traceability_status,
                f.notes = $notes
            """,
            {
                "lot_code": fl["lot_code"],
                "product_name": fl["product_name"],
                "sku": fl["sku"],
                "units_produced": fl["units_produced"],
                "best_by_date": fl["best_by_date"],
                "disposition": fl["disposition"],
                "traceability_status": fl["traceability_status"],
                "notes": fl.get("notes", ""),
            },
        )
        # Link to production event if recorded (intentionally absent for gap test case)
        pe_id = fl.get("production_event_id")
        if pe_id:
            graph.query(
                """
                MATCH (p:ProductionEvent {event_id: $event_id})
                MATCH (f:FinishedLot {lot_code: $lot_code})
                MERGE (p)-[:PRODUCED]->(f)
                """,
                {"event_id": pe_id, "lot_code": fl["lot_code"]},
            )
        counts["finished_lots"] += 1

    # 6. Locations
    for loc in data.get("locations", []):
        graph.query(
            """
            MERGE (l:Location {location_id: $location_id})
            SET l.name = $name,
                l.gln = $gln,
                l.contact_email = $contact_email,
                l.state_code = $state_code
            """,
            loc,
        )
        counts["locations"] += 1

    # 7. Shipments
    for sh in data.get("shipments", []):
        graph.query(
            """
            MERGE (s:Shipment {shipment_id: $shipment_id})
            SET s.carrier_name = $carrier_name,
                s.dispatched_at = $dispatched_at,
                s.units_shipped = $units_shipped,
                s.shipping_disposition = $shipping_disposition,
                s.traceability_status = $traceability_status
            WITH s
            MATCH (f:FinishedLot {lot_code: $finished_lot_code})
            MATCH (l:Location {location_id: $destination_location_id})
            MERGE (f)-[:PACKAGED_INTO]->(s)
            MERGE (s)-[:SHIPPED_TO]->(l)
            """,
            sh,
        )
        counts["shipments"] += 1

    # 8. Evidence
    for ev in data.get("evidence", []):
        graph.query(
            """
            MERGE (e:Evidence {evidence_id: $evidence_id})
            SET e.evidence_type = $evidence_type,
                e.title = $title,
                e.source_uri = $source_uri,
                e.hash_sha256 = $hash_sha256,
                e.recorded_at = $recorded_at,
                e.confidence_score = $confidence_score
            """,
            {
                "evidence_id": ev["evidence_id"],
                "evidence_type": ev["evidence_type"],
                "title": ev["title"],
                "source_uri": ev["source_uri"],
                "hash_sha256": ev["hash_sha256"],
                "recorded_at": ev["recorded_at"],
                "confidence_score": ev["confidence_score"],
            },
        )
        target_lot = ev.get("target_lot_code")
        if target_lot:
            graph.query(
                """
                MATCH (e:Evidence {evidence_id: $evidence_id})
                MATCH (r:RawLot {lot_code: $target_lot_code})
                MERGE (e)-[:SUPPORTS]->(r)
                """,
                {"evidence_id": ev["evidence_id"], "target_lot_code": target_lot},
            )
        counts["evidence"] += 1

    # 9. Org Units
    for org in data.get("org_units", []):
        graph.query(
            """
            MERGE (o:OrgUnit {unit_id: $unit_id})
            SET o.name = $name,
                o.lead_contact = $lead_contact,
                o.escalation_level = $escalation_level
            """,
            org,
        )
        counts["org_units"] += 1

    # 10. Recall Cases
    for rc in data.get("recall_cases", []):
        graph.query(
            """
            MERGE (c:RecallCase {case_id: $case_id})
            SET c.opened_at = $opened_at,
                c.hazard_type = $hazard_type,
                c.pathogen_or_hazard = $pathogen_or_hazard,
                c.provisional_class = $provisional_class,
                c.lifecycle_status = $lifecycle_status
            """,
            {
                "case_id": rc["case_id"],
                "opened_at": rc["opened_at"],
                "hazard_type": rc["hazard_type"],
                "pathogen_or_hazard": rc["pathogen_or_hazard"],
                "provisional_class": rc["provisional_class"],
                "lifecycle_status": rc["lifecycle_status"],
            },
        )
        target_raw_lot = rc.get("target_raw_lot")
        if target_raw_lot:
            graph.query(
                """
                MATCH (c:RecallCase {case_id: $case_id})
                MATCH (r:RawLot {lot_code: $target_raw_lot})
                MERGE (c)-[:INVESTIGATES]->(r)
                """,
                {"case_id": rc["case_id"], "target_raw_lot": target_raw_lot},
            )
        for ev_id in rc.get("evidence_ids", []):
            graph.query(
                """
                MATCH (c:RecallCase {case_id: $case_id})
                MATCH (e:Evidence {evidence_id: $evidence_id})
                MERGE (e)-[:SUPPORTS]->(c)
                """,
                {"case_id": rc["case_id"], "evidence_id": ev_id},
            )
        owning_unit = rc.get("owning_unit_id")
        if owning_unit:
            graph.query(
                """
                MATCH (c:RecallCase {case_id: $case_id})
                MATCH (o:OrgUnit {unit_id: $owning_unit_id})
                MERGE (o)-[:OWNS]->(c)
                """,
                {"case_id": rc["case_id"], "owning_unit_id": owning_unit},
            )
        counts["recall_cases"] += 1

    return counts
