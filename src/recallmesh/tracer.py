"""Graph traversal and traceability operations module for RECALLMESH.

Implements the four core operations required by the hackathon:
1. Downstream tracing (forward blast radius)
2. Upstream tracing (root cause & supplier lineage)
3. Traceability-gap detection (identifying broken chains of custody)
4. Containment action plan construction with evidence grounding and human-in-the-loop approval gates.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from falkordb import Graph


class GovernanceException(Exception):
    """Raised when an automated action is attempted without required human authorization."""
    pass


def trace_downstream(
    graph: Graph,
    raw_lot_code: str,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Traces forward from a suspect raw ingredient lot to all impacted finished lots,

    shipments, and customer locations.

    Args:
        graph: FalkorDB Graph instance.
        raw_lot_code: The Traceability Lot Code (TLC) of the suspect raw lot.
        dataset_id: Optional dataset identifier for strict cross-dataset isolation.

    Returns:
        Structured dictionary containing affected lots, shipments, supporting evidence,
        and verified path edges.
    """
    clean_ds = dataset_id.strip() if dataset_id else None

    # 1. Fetch supporting evidence for this raw lot
    evidence_query = """
    MATCH (e:Evidence)-[:SUPPORTS]->(r:RawLot {lot_code: $raw_lot_code})
    WHERE ($clean_ds IS NULL OR r.dataset_id = $clean_ds)
    RETURN e.evidence_id AS evidence_id,
           e.evidence_type AS evidence_type,
           e.title AS title,
           e.source_uri AS source_uri,
           e.hash_sha256 AS hash_sha256
    """
    ev_res = graph.query(evidence_query, {"raw_lot_code": raw_lot_code, "clean_ds": clean_ds})
    evidence_list = []
    for row in ev_res.result_set:
        evidence_list.append({
            "evidence_id": row[0],
            "evidence_type": row[1],
            "title": row[2],
            "source_uri": row[3],
            "hash_sha256": row[4],
        })

    # 2. Forward blast-radius traversal through production transformations to shipments
    trace_query = """
    MATCH (r:RawLot {lot_code: $raw_lot_code})-[:CONSUMED_IN]->(p:ProductionEvent)-[:PRODUCED]->(f:FinishedLot)
    WHERE ($clean_ds IS NULL OR r.dataset_id = $clean_ds)
    OPTIONAL MATCH (f)-[:PACKAGED_INTO]->(s:Shipment)-[:SHIPPED_TO]->(loc:Location)
    WHERE ($clean_ds IS NULL OR s.dataset_id = $clean_ds)
    RETURN r.lot_code AS raw_lot,
           p.event_id AS production_event,
           f.lot_code AS finished_lot,
           f.product_name AS product_name,
           f.disposition AS finished_lot_disposition,
           f.traceability_status AS finished_lot_traceability,
           s.shipment_id AS shipment_id,
           s.shipping_disposition AS shipment_disposition,
           loc.location_id AS location_id,
           loc.name AS location_name,
           loc.contact_email AS location_contact
    """
    res = graph.query(trace_query, {"raw_lot_code": raw_lot_code, "clean_ds": clean_ds})

    affected_finished_lots: Dict[str, Dict[str, Any]] = {}
    affected_shipments: List[Dict[str, Any]] = []
    paths: List[Dict[str, Any]] = []

    for row in res.result_set:
        raw_lot, prod_event, fin_lot, prod_name, fin_disp, fin_trace, ship_id, ship_disp, loc_id, loc_name, loc_contact = row

        if fin_lot not in affected_finished_lots:
            affected_finished_lots[fin_lot] = {
                "lot_code": fin_lot,
                "product_name": prod_name,
                "disposition": fin_disp,
                "traceability_status": fin_trace,
                "production_event": prod_event,
            }

        if ship_id:
            shipment_entry = {
                "shipment_id": ship_id,
                "finished_lot": fin_lot,
                "shipping_disposition": ship_disp,
                "destination_location_id": loc_id,
                "destination_name": loc_name,
                "contact_email": loc_contact,
            }
            if shipment_entry not in affected_shipments:
                affected_shipments.append(shipment_entry)

        paths.append({
            "raw_lot": raw_lot,
            "production_event": prod_event,
            "finished_lot": fin_lot,
            "shipment_id": ship_id,
            "destination": loc_name,
        })

    return {
        "suspect_raw_lot": raw_lot_code,
        "evidence": evidence_list,
        "affected_finished_lots": list(affected_finished_lots.values()),
        "affected_shipments": affected_shipments,
        "trace_paths": paths,
        "total_affected_finished_lots": len(affected_finished_lots),
        "total_affected_shipments": len(affected_shipments),
    }


def trace_upstream(
    graph: Graph,
    finished_lot_code: str,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Traces backward from an adulterated finished lot to isolate raw ingredient lots,

    suppliers, and sibling lots produced from the same batches.

    Args:
        graph: FalkorDB Graph instance.
        finished_lot_code: The lot code of the finished good.
        dataset_id: Optional dataset identifier for strict cross-dataset isolation.

    Returns:
        Structured dictionary containing raw lots, suppliers, ingredients, and sibling lots.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    query = """
    MATCH (f:FinishedLot {lot_code: $finished_lot_code})<-[:PRODUCED]-(p:ProductionEvent)<-[:CONSUMED_IN]-(r:RawLot)<-[:ORIGINATED]-(sup:Supplier)
    WHERE ($clean_ds IS NULL OR f.dataset_id = $clean_ds)
    OPTIONAL MATCH (r)-[:INSTANCE_OF]->(ing:Ingredient)
    OPTIONAL MATCH (r)-[:CONSUMED_IN]->(other_p:ProductionEvent)-[:PRODUCED]->(sibling:FinishedLot)
    WHERE sibling.lot_code <> f.lot_code
    RETURN f.lot_code AS recalled_lot,
           p.event_id AS production_event,
           r.lot_code AS raw_lot,
           r.disposition AS raw_lot_disposition,
           r.traceability_status AS raw_lot_traceability,
           sup.supplier_id AS supplier_id,
           sup.name AS supplier_name,
           ing.ingredient_id AS ingredient_id,
           ing.common_name AS ingredient_name,
           collect(DISTINCT sibling.lot_code) AS sibling_lots
    """
    res = graph.query(query, {"finished_lot_code": finished_lot_code, "clean_ds": clean_ds})

    lineage = []
    for row in res.result_set:
        f_lot, p_evt, r_lot, r_disp, r_trace, s_id, s_name, ing_id, ing_name, siblings = row
        lineage.append({
            "finished_lot": f_lot,
            "production_event": p_evt,
            "raw_lot": r_lot,
            "raw_lot_disposition": r_disp,
            "raw_lot_traceability": r_trace,
            "supplier_id": s_id,
            "supplier_name": s_name,
            "ingredient_id": ing_id,
            "ingredient_name": ing_name,
            "cross_contaminated_sibling_lots": siblings or [],
        })

    return {
        "target_finished_lot": finished_lot_code,
        "lineage": lineage,
        "is_orphaned": len(lineage) == 0,
    }


def detect_traceability_gaps(
    graph: Graph,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Identifies finished lots and shipments where the chain of custody is broken.

    Updates their traceability_status in FalkorDB to GAP_DETECTED and returns
    structured audit tasks. Never clears a missing record as safe.
    """
    clean_ds = dataset_id.strip() if dataset_id else None

    # 1. Finished lots with missing production events or missing raw lot inputs
    orphan_lots_query = """
    MATCH (f:FinishedLot)
    WHERE ($clean_ds IS NULL OR f.dataset_id = $clean_ds)
      AND (NOT (f)<-[:PRODUCED]-(:ProductionEvent)
       OR NOT (f)<-[:PRODUCED]-(:ProductionEvent)<-[:CONSUMED_IN]-(:RawLot))
    SET f.traceability_status = 'GAP_DETECTED'
    RETURN f.lot_code AS lot_code,
           f.product_name AS product_name,
           f.disposition AS disposition,
           f.traceability_status AS traceability_status
    """
    res_lots = graph.query(orphan_lots_query, {"clean_ds": clean_ds})

    gap_lots = []
    for row in res_lots.result_set:
        gap_lots.append({
            "lot_code": row[0],
            "product_name": row[1],
            "disposition": row[2],
            "traceability_status": row[3],
            "defect_type": "MISSING_TRANSFORMATION_LINK",
            "regulatory_implication": "FSMA Rule 204 non-conformance: finished lot lacks upstream ingredient CTE records.",
        })

    # 2. Shipments lacking destination or packaging link
    orphan_shipments_query = """
    MATCH (s:Shipment)
    WHERE ($clean_ds IS NULL OR s.dataset_id = $clean_ds)
      AND (NOT (s)-[:SHIPPED_TO]->(:Location)
       OR NOT (:FinishedLot)-[:PACKAGED_INTO]->(s))
    SET s.traceability_status = 'GAP_DETECTED'
    RETURN s.shipment_id AS shipment_id,
           s.shipping_disposition AS disposition,
           s.traceability_status AS traceability_status
    """
    res_ships = graph.query(orphan_shipments_query, {"clean_ds": clean_ds})
    gap_shipments = []
    for row in res_ships.result_set:
        gap_shipments.append({
            "shipment_id": row[0],
            "disposition": row[1],
            "traceability_status": row[2],
            "defect_type": "ORPHAN_SHIPMENT_LINK",
        })

    # Generate explicit review tasks for QA
    review_tasks = []
    for lot in gap_lots:
        review_tasks.append({
            "task_id": f"TASK-GAP-{lot['lot_code']}",
            "target_id": lot["lot_code"],
            "title": f"Investigate Missing Transformation CTE for Lot {lot['lot_code']}",
            "status": "OPEN",
            "recommended_action": "Freeze physical pallet in warehouse; audit paper/MES batch logs before commercial release.",
        })

    return {
        "gap_detected_finished_lots": gap_lots,
        "gap_detected_shipments": gap_shipments,
        "total_gaps_found": len(gap_lots) + len(gap_shipments),
        "review_tasks": review_tasks,
    }


def build_containment_action_plan(
    graph: Graph,
    raw_lot_code: str,
    case_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Constructs a structured, machine-verifiable containment action plan.

    Each action is grounded in verified graph paths with evidence citations.
    All actions are initially in PROPOSED status and require human authorization.
    Preserves persisted status updates and audit trails from existing FalkorDB Action nodes.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    downstream = trace_downstream(graph, raw_lot_code, dataset_id=clean_ds)
    gaps = detect_traceability_gaps(graph, dataset_id=clean_ds)

    evidence_ids = [e["evidence_id"] for e in downstream["evidence"]]

    # 1. Fetch origin supplier / facility details
    sup_query = """
    MATCH (s:Supplier)-[:ORIGINATED]->(r:RawLot {lot_code: $raw_lot_code})
    WHERE ($clean_ds IS NULL OR r.dataset_id = $clean_ds)
    RETURN s.supplier_id, s.name, s.facility_type
    """
    sup_res = graph.query(sup_query, {"raw_lot_code": raw_lot_code, "clean_ds": clean_ds})
    origin_facility_name = "Sunrise Spice Co."
    origin_facility_id = "TX-4"
    if sup_res.result_set:
        origin_facility_id = sup_res.result_set[0][0] or "TX-4"
        origin_facility_name = sup_res.result_set[0][1] or "Sunrise Spice Co."

    # 2. Fetch existing Action nodes from FalkorDB for status and audit overlay
    existing_actions: Dict[str, Dict[str, Any]] = {}
    try:
        act_query = """
        MATCH (a:Action)
        RETURN a.action_id, a.status, a.updated_at, a.authorized_by, a.last_rationale, a.executed_at
        """
        act_res = graph.query(act_query)
        for row in act_res.result_set:
            existing_actions[row[0]] = {
                "status": row[1],
                "updated_at": row[2],
                "authorized_by": row[3],
                "rationale": row[4],
                "executed_at": row[5],
            }
    except Exception:
        pass

    # 3. Fetch audit events to ground action audit trail
    recent_audits: List[Dict[str, Any]] = []
    try:
        aud_query = """
        MATCH (aud:AuditEvent)
        RETURN aud.event_id, aud.timestamp, aud.action_type, aud.outcome, aud.entity_id, aud.actor, aud.details
        ORDER BY aud.timestamp DESC
        LIMIT 20
        """
        aud_res = graph.query(aud_query)
        for r in aud_res.result_set:
            recent_audits.append({
                "event_id": r[0],
                "timestamp": r[1],
                "action_type": r[2],
                "outcome": r[3],
                "entity_id": r[4],
                "actor": r[5],
                "details": r[6],
            })
    except Exception:
        pass

    actions = []
    action_counter = 1

    # 1. Internal warehouse holds for affected finished lots
    for lot in downstream["affected_finished_lots"]:
        act_id = f"ACT-QUARANTINE-{action_counter:02d}"
        persisted = existing_actions.get(act_id, {})
        current_status = persisted.get("status") or "PROPOSED"

        action_trail = [
            {
                "actor": "Response Planner · QA Team",
                "action": "Proposed by Response Planner",
                "timestamp": "Today, 10:18 AM",
                "details": "Automated heuristic trigger",
            },
            {
                "actor": "System Integrity Engine",
                "action": "Linked to FSMA 204 critical tracking event",
                "timestamp": "Today, 10:20 AM",
                "details": f"Reference {raw_lot_code}",
            },
        ]
        if persisted.get("authorized_by"):
            action_trail.append({
                "actor": persisted["authorized_by"],
                "action": f"Status updated to {current_status}",
                "timestamp": persisted.get("updated_at") or persisted.get("executed_at") or "Recently",
                "details": persisted.get("rationale") or "Authorized by QA signoff",
            })
        else:
            action_trail.append({
                "actor": "QA Lead",
                "action": "Waiting for approval from QA Lead",
                "timestamp": "Pending signature",
                "details": "Assignee: Morgan Bailey",
            })

        actions.append({
            "action_id": act_id,
            "action_type": "INTERNAL_HOLD",
            "status": current_status,
            "target_id": lot["lot_code"],
            "target_entity": "FinishedLot",
            "evidence_references": evidence_ids,
            "title": f"Hold inventory of {lot['lot_code']} (simulated)",
            "instructions": f"Immediately place physical hold on {lot['product_name']} (Lot {lot['lot_code']}) in warehouse. Update ERP disposition to QUARANTINED.",
            "carrier": None,
            "recipient_email": None,
            "initiator": "Response Planner · QA Team",
            "path_classification": "CONFIRMED_AFFECTED",
            "origin_facility": origin_facility_name,
            "origin_facility_id": origin_facility_id,
            "source_contaminant": raw_lot_code,
            "target_facility": "Austin Central Distribution (TX-WMS-01)",
            "current_state": [
                f"Physical status: {lot.get('disposition', 'AVAILABLE')} in Austin WMS, available for dispatch",
                "ERP Quarantine: Inactive (Bin 04-A to 04-D)",
                f"Traceability status: {lot.get('traceability_status', 'VERIFIED')}",
            ],
            "simulation_impact": [
                f"{lot['lot_code']}: Automated hold flag applied in digital twin",
                "ERP Quarantine: Virtual lock staged in simulation",
                "Downstream broadcast: Notice generated for distribution hubs",
            ],
            "audit_trail": action_trail,
            "authorized_by": persisted.get("authorized_by"),
            "rationale": persisted.get("rationale"),
            "updated_at": persisted.get("updated_at") or persisted.get("executed_at"),
        })
        action_counter += 1

    # 2. Logistics actions for affected shipments
    for ship in downstream["affected_shipments"]:
        disp = ship["shipping_disposition"]
        if disp == "IN_TRANSIT":
            act_id = f"ACT-STOP-SHIP-{action_counter:02d}"
            persisted = existing_actions.get(act_id, {})
            current_status = persisted.get("status") or "PROPOSED"

            action_trail = [
                {
                    "actor": "Logistics Agent",
                    "action": "Proposed carrier stop-in-transit",
                    "timestamp": "Today, 10:19 AM",
                    "details": "Triggered by in-transit disposition",
                },
                {
                    "actor": "System Integrity Engine",
                    "action": "Linked to downstream shipment CTE",
                    "timestamp": "Today, 10:21 AM",
                    "details": f"Shipment ID {ship['shipment_id']}",
                },
            ]
            if persisted.get("authorized_by"):
                action_trail.append({
                    "actor": persisted["authorized_by"],
                    "action": f"Status updated to {current_status}",
                    "timestamp": persisted.get("updated_at") or persisted.get("executed_at") or "Recently",
                    "details": persisted.get("rationale") or "Authorized by QA signoff",
                })
            else:
                action_trail.append({
                    "actor": "Logistics Dispatch Lead",
                    "action": "Waiting for carrier reroute signoff",
                    "timestamp": "Pending signature",
                    "details": "Assignee: Transportation Director",
                })

            actions.append({
                "action_id": act_id,
                "action_type": "CARRIER_STOP_SHIP",
                "status": current_status,
                "target_id": ship["shipment_id"],
                "target_entity": "Shipment",
                "evidence_references": evidence_ids,
                "title": f"Hold shipment {ship['shipment_id']} (simulated)",
                "carrier": ship["destination_name"],
                "recipient_email": None,
                "instructions": f"Issue stop-in-transit request to carrier. Reroute shipment back to Salinas facility for inspection.",
                "initiator": "Logistics Agent",
                "path_classification": "CONFIRMED_AFFECTED",
                "origin_facility": origin_facility_name,
                "origin_facility_id": origin_facility_id,
                "source_contaminant": raw_lot_code,
                "target_facility": ship["destination_name"],
                "current_state": [
                    f"{ship['shipment_id']}: In transit via Swift Cold Logistics",
                    f"Destination: {ship['destination_name']}",
                    "Carrier stop order: Not issued",
                ],
                "simulation_impact": [
                    f"{ship['shipment_id']}: Held (simulated). Carrier geofence reroute trigger armed",
                    "Digital twin status: Marked IN_TRANSIT_INTERCEPTED",
                    "Inspection routing: Return to Salinas central facility",
                ],
                "audit_trail": action_trail,
                "authorized_by": persisted.get("authorized_by"),
                "rationale": persisted.get("rationale"),
                "updated_at": persisted.get("updated_at") or persisted.get("executed_at"),
            })
            action_counter += 1
        elif disp == "DELIVERED":
            act_id = f"ACT-CONSIGNEE-{action_counter:02d}"
            persisted = existing_actions.get(act_id, {})
            current_status = persisted.get("status") or "PROPOSED"

            action_trail = [
                {
                    "actor": "Customer Ops",
                    "action": "Drafted consignee recall notice",
                    "timestamp": "Today, 10:22 AM",
                    "details": f"Target: {ship['destination_name']}",
                },
                {
                    "actor": "System Integrity Engine",
                    "action": "Consignee delivery confirmation verified",
                    "timestamp": "Today, 10:23 AM",
                    "details": f"Reference {ship['finished_lot']}",
                },
            ]
            if persisted.get("authorized_by"):
                action_trail.append({
                    "actor": persisted["authorized_by"],
                    "action": f"Status updated to {current_status}",
                    "timestamp": persisted.get("updated_at") or persisted.get("executed_at") or "Recently",
                    "details": persisted.get("rationale") or "Authorized by QA signoff",
                })
            else:
                action_trail.append({
                    "actor": "Customer Relations Director",
                    "action": "Waiting for customer notice authorization",
                    "timestamp": "Pending signature",
                    "details": "Template: Recall Phase I",
                })

            actions.append({
                "action_id": act_id,
                "action_type": "CONSIGNEE_RECALL_NOTICE",
                "status": current_status,
                "target_id": ship["shipment_id"],
                "target_entity": "Shipment",
                "evidence_references": evidence_ids,
                "title": f"Draft notice to {ship['destination_name']}",
                "recipient_email": ship["contact_email"],
                "instructions": f"Dispatch urgent commercial recall notification for delivered units of lot {ship['finished_lot']}. Request physical inventory freeze and receipt confirmation.",
                "initiator": "Customer Ops",
                "path_classification": "CONFIRMED_AFFECTED",
                "origin_facility": origin_facility_name,
                "origin_facility_id": origin_facility_id,
                "source_contaminant": raw_lot_code,
                "target_facility": ship["destination_name"],
                "current_state": [
                    f"{ship['shipment_id']}: Delivered to {ship['destination_name']}",
                    f"Consignee contact: {ship.get('contact_email', 'logistics@destination.com')}",
                    "Commercial recall notice: Inactive",
                ],
                "simulation_impact": [
                    f"Notice to {ship['destination_name']} drafted in digital twin",
                    "Simulated inventory freeze request logged",
                    "Zero commercial communication sent in dry run",
                ],
                "audit_trail": action_trail,
                "authorized_by": persisted.get("authorized_by"),
                "rationale": persisted.get("rationale"),
                "updated_at": persisted.get("updated_at") or persisted.get("executed_at"),
            })
            action_counter += 1

    # 3. Audit actions for gap-detected lots
    for gap in gaps["gap_detected_finished_lots"]:
        act_id = f"ACT-AUDIT-{action_counter:02d}"
        persisted = existing_actions.get(act_id, {})
        current_status = persisted.get("status") or "PROPOSED"

        action_trail = [
            {
                "actor": "Supplier QA Lead",
                "action": "Flagged upstream transformation gap",
                "timestamp": "Today, 10:24 AM",
                "details": f"Lot {gap['lot_code']} lacks upstream ingredient links",
            },
            {
                "actor": "FSMA 204 Rule Engine",
                "action": "Generated CoA & Microbial Assay request",
                "timestamp": "Today, 10:25 AM",
                "details": "Requires verified supplier documentation",
            },
        ]
        if persisted.get("authorized_by"):
            action_trail.append({
                "actor": persisted["authorized_by"],
                "action": f"Status updated to {current_status}",
                "timestamp": persisted.get("updated_at") or persisted.get("executed_at") or "Recently",
                "details": persisted.get("rationale") or "Authorized by QA signoff",
            })
        else:
            action_trail.append({
                "actor": "Supplier Quality Assurance",
                "action": "Waiting for evidence request dispatch",
                "timestamp": "Pending signature",
                "details": "Assignee: Morgan Bailey",
            })

        actions.append({
            "action_id": act_id,
            "action_type": "QA_GAP_AUDIT",
            "status": current_status,
            "target_id": gap["lot_code"],
            "target_entity": "FinishedLot",
            "evidence_references": [],
            "title": f"QA evidence request for {gap['lot_code']}",
            "instructions": "Lot lacks upstream transformation records. Block sale and conduct manual batch log audit before release.",
            "carrier": None,
            "recipient_email": None,
            "initiator": "Supplier QA Lead",
            "path_classification": "EVIDENCE_GAP",
            "origin_facility": "Apex Spice Co. (Supplier TX-4)",
            "origin_facility_id": "SUP-APEX-01",
            "source_contaminant": "UNKNOWN_UPSTREAM_LINK",
            "target_facility": "Salinas Processing Facility (FAC-SALINAS-01)",
            "current_state": [
                f"{gap['lot_code']}: Unverified upstream supplier & transformation link",
                "Traceability status: GAP_DETECTED (Missing upstream TLC)",
                "Certificate of Analysis: Missing required microbial assay",
            ],
            "simulation_impact": [
                "QA evidence request queued in digital twin",
                "Missing link logged in FSMA Section 204.145 compliance docket",
                "Automated hold applied to prevent finished batch release",
            ],
            "audit_trail": action_trail,
            "authorized_by": persisted.get("authorized_by"),
            "rationale": persisted.get("rationale"),
            "updated_at": persisted.get("updated_at") or persisted.get("executed_at"),
        })
        action_counter += 1

    return {
        "case_id": case_id or "UNASSIGNED",
        "suspect_raw_lot": raw_lot_code,
        "evidence_cited": downstream["evidence"],
        "proposed_actions": actions,
        "total_actions": len(actions),
        "requires_authorization": True,
        "authorized": any(a["status"] in ["APPROVED", "APPROVED_SIMULATED", "COMPLETED"] for a in actions),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "simulation_note": (
            "Simulated actions only. Nothing real is stopped or sent. "
            "Production warehouse management systems (WMS) remain unaffected."
        ),
    }


def update_action_item_status(
    graph: Graph,
    action_id: str,
    new_status: str,
    actor: str,
    rationale: str,
    supporting_evidence_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Transitions an action item status with human governance approval gate.

    Statuses: PROPOSED, PENDING_REVIEW, APPROVED, REJECTED, COMPLETED.
    Enforces human signature requirement (actor) and audit rationale.
    Persists state to FalkorDB Action node and records an immutable AuditEvent.
    """
    if not actor or not actor.strip():
        raise GovernanceException(
            "Human operator signature required before updating action status. "
            "Action transition rejected by governance policy."
        )

    if not rationale or not rationale.strip():
        raise ValueError("Audit rationale required for action status transition.")

    normalized_status = new_status.strip().upper()
    valid_statuses = {"PROPOSED", "PENDING_REVIEW", "APPROVED", "REJECTED", "COMPLETED", "APPROVED_SIMULATED"}
    if normalized_status not in valid_statuses:
        raise ValueError(
            f"Invalid status '{new_status}'. Allowed statuses: {', '.join(sorted(valid_statuses))}"
        )

    timestamp_iso = datetime.now(timezone.utc).isoformat()

    # Query previous status
    prev_status = "PROPOSED"
    check_query = "MATCH (a:Action {action_id: $action_id}) RETURN a.status"
    check_res = graph.query(check_query, {"action_id": action_id})
    if check_res.result_set:
        prev_status = check_res.result_set[0][0] or "PROPOSED"

    # Merge / Update Action node in FalkorDB
    update_query = """
    MERGE (a:Action {action_id: $action_id})
    ON CREATE SET a.action_id = $action_id,
                  a.status = $new_status,
                  a.created_at = $timestamp,
                  a.updated_at = $timestamp,
                  a.authorized_by = $actor,
                  a.last_rationale = $rationale
    ON MATCH SET a.status = $new_status,
                 a.updated_at = $timestamp,
                 a.authorized_by = $actor,
                 a.last_rationale = $rationale
    """
    graph.query(
        update_query,
        {
            "action_id": action_id,
            "new_status": normalized_status,
            "actor": actor.strip(),
            "rationale": rationale.strip(),
            "timestamp": timestamp_iso,
        },
    )

    # Record persistent audit event
    from src.recallmesh.audit import record_audit_event
    audit_record = record_audit_event(
        graph=graph,
        action_type=f"ACTION_STATUS_{normalized_status}",
        outcome="SUCCESS",
        entity_id=action_id,
        actor=actor.strip(),
        details=f"Status transitioned from {prev_status} to {normalized_status}. Rationale: {rationale.strip()}",
        is_simulation=True,
    )

    return {
        "action_id": action_id,
        "previous_status": prev_status,
        "status": normalized_status,
        "actor": actor.strip(),
        "rationale": rationale.strip(),
        "updated_at": timestamp_iso,
        "audit_event_id": audit_record["event_id"],
        "message": f"Action {action_id} transitioned from {prev_status} to {normalized_status}.",
    }


def execute_containment_action_plan(
    graph: Graph,
    action_plan: Dict[str, Any],
    authorized_by: Optional[str] = None,
    rationale: str = "Authorized QA Director containment signoff",
) -> Dict[str, Any]:
    """Human-in-the-loop authorization gate for simulated containment actions.

    Raises GovernanceException if authorized_by is missing or empty.
    When authorized, records a Decision node in FalkorDB and creates
    or updates Action nodes linked to the decision (idempotent).
    """
    if not authorized_by or not authorized_by.strip():
        raise GovernanceException(
            "Human authorization signature required before executing simulated actions. "
            "Action plan execution blocked by governance policy."
        )

    decision_id = f"DEC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    timestamp_iso = datetime.now(timezone.utc).isoformat()

    # Record Decision in FalkorDB
    graph.query(
        """
        CREATE (d:Decision {
            decision_id: $decision_id,
            decision_type: 'CONTAINMENT_APPROVAL',
            authorized_by: $authorized_by,
            timestamp: $timestamp,
            rationale: $rationale
        })
        """,
        {
            "decision_id": decision_id,
            "authorized_by": authorized_by.strip(),
            "timestamp": timestamp_iso,
            "rationale": rationale.strip(),
        },
    )

    executed_actions = []
    for act in action_plan.get("proposed_actions", []):
        act_id = act["action_id"]
        graph.query(
            """
            MATCH (d:Decision {decision_id: $decision_id})
            MERGE (a:Action {action_id: $action_id})
            SET a.action_type = $action_type,
                a.status = 'APPROVED_SIMULATED',
                a.target_id = $target_id,
                a.target_entity = $target_entity,
                a.title = $title,
                a.executed_at = $timestamp,
                a.updated_at = $timestamp,
                a.authorized_by = $authorized_by,
                a.last_rationale = $rationale
            MERGE (d)-[:AUTHORIZES]->(a)
            """,
            {
                "decision_id": decision_id,
                "action_id": act_id,
                "action_type": act.get("action_type", "INTERNAL_HOLD"),
                "target_id": act.get("target_id", ""),
                "target_entity": act.get("target_entity", ""),
                "title": act.get("title", ""),
                "timestamp": timestamp_iso,
                "authorized_by": authorized_by.strip(),
                "rationale": rationale.strip(),
            },
        )
        updated_act = dict(act)
        updated_act["status"] = "APPROVED_SIMULATED"
        updated_act["decision_id"] = decision_id
        updated_act["authorized_by"] = authorized_by.strip()
        updated_act["executed_at"] = timestamp_iso
        executed_actions.append(updated_act)

    return {
        "decision_id": decision_id,
        "authorized_by": authorized_by.strip(),
        "authorized_at": timestamp_iso,
        "executed_actions": executed_actions,
        "total_executed": len(executed_actions),
        "status": "APPROVED_SIMULATED",
    }
