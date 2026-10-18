"""Critical Tracking Events (CTEs) extractor for FDA FSMA 204 ledger.

Extracts genuine Receiving, Transformation, and Shipping CTEs stored in FalkorDB.
"""

from typing import Any, Dict, List, Optional
from falkordb import Graph

SYNTHETIC_NOTICE = "100% Synthetic Demo Data (Graph Hacks 2026); Not for real-world regulatory submission."


def fetch_cte_records(graph: Graph, raw_lot_code: Optional[str] = None) -> List[Dict[str, Any]]:
    """Extracts actual CTE records stored in FalkorDB property graph.
    
    Includes:
    1. Receiving CTEs (Raw lots received from suppliers)
    2. Transformation CTEs (Production batch blending & packaging into finished lots)
    3. Shipping CTEs (Finished lot shipments to distribution centers and retailers)
    """
    records: List[Dict[str, Any]] = []

    # 1. Receiving CTEs
    rcv_query = """
    MATCH (r:RawLot)<-[:ORIGINATED]-(s:Supplier)
    OPTIONAL MATCH (r)-[:INSTANCE_OF]->(i:Ingredient)
    RETURN r.lot_code AS tlc,
           'Receiving' AS event_type,
           'CTE-RCV-' + r.lot_code AS event_id,
           r.received_at AS dt,
           'FAC-SALINAS-01' AS fac_id,
           s.name AS fac_name,
           coalesce(i.common_name, 'Raw Ingredient') AS prod_desc,
           r.quantity_kg AS qty,
           r.traceability_status AS t_status,
           r.disposition AS disp
    ORDER BY r.received_at ASC
    """
    res_rcv = graph.query(rcv_query)
    for row in res_rcv.result_set:
        records.append({
            "tlc": row[0] or "",
            "event_type": row[1] or "Receiving",
            "event_id": row[2] or "",
            "timestamp": row[3] or "",
            "facility_id": row[4] or "",
            "facility_name": row[5] or "",
            "product_or_sku": row[6] or "",
            "quantity": f"{row[7]} kg" if row[7] is not None else "",
            "traceability_status": row[8] or "VERIFIED",
            "physical_disposition": row[9] or "AVAILABLE",
            "regulatory_notice": SYNTHETIC_NOTICE,
        })

    # 2. Transformation CTEs
    trans_query = """
    MATCH (p:ProductionEvent)
    OPTIONAL MATCH (r:RawLot)-[:CONSUMED_IN]->(p)
    OPTIONAL MATCH (p)-[:PRODUCED]->(f:FinishedLot)
    RETURN coalesce(f.lot_code, p.event_id) AS tlc,
           'Transformation' AS event_type,
           p.event_id AS event_id,
           p.started_at AS dt,
           p.facility_id AS fac_id,
           'Verdant Harvest Salinas Plant' AS fac_name,
           coalesce(f.product_name, 'Batch ' + p.event_id) AS prod_desc,
           p.yield_units AS qty,
           coalesce(f.traceability_status, 'VERIFIED') AS t_status,
           coalesce(f.disposition, 'AVAILABLE') AS disp
    ORDER BY p.started_at ASC
    """
    res_trans = graph.query(trans_query)
    for row in res_trans.result_set:
        records.append({
            "tlc": row[0] or "",
            "event_type": row[1] or "Transformation",
            "event_id": row[2] or "",
            "timestamp": row[3] or "",
            "facility_id": row[4] or "",
            "facility_name": row[5] or "",
            "product_or_sku": row[6] or "",
            "quantity": f"{row[7]} units" if row[7] is not None else "",
            "traceability_status": row[8] or "VERIFIED",
            "physical_disposition": row[9] or "AVAILABLE",
            "regulatory_notice": SYNTHETIC_NOTICE,
        })

    # Also capture orphan lots that lack production link (like FL-SALSA-103)
    orphan_trans_query = """
    MATCH (f:FinishedLot)
    WHERE NOT (:ProductionEvent)-[:PRODUCED]->(f)
    RETURN f.lot_code AS tlc,
           'Transformation (Unlinked)' AS event_type,
           'CTE-TRANS-GAP-' + f.lot_code AS event_id,
           '' AS dt,
           'UNKNOWN_FACILITY' AS fac_id,
           'Unlinked Facility' AS fac_name,
           f.product_name AS prod_desc,
           '' AS qty,
           f.traceability_status AS t_status,
           f.disposition AS disp
    """
    res_orphan = graph.query(orphan_trans_query)
    for row in res_orphan.result_set:
        records.append({
            "tlc": row[0] or "",
            "event_type": row[1] or "Transformation",
            "event_id": row[2] or "",
            "timestamp": row[3] or "",
            "facility_id": row[4] or "",
            "facility_name": row[5] or "",
            "product_or_sku": row[6] or "",
            "quantity": row[7] or "",
            "traceability_status": row[8] or "GAP_DETECTED",
            "physical_disposition": row[9] or "AVAILABLE",
            "regulatory_notice": SYNTHETIC_NOTICE,
        })

    # 3. Shipping CTEs
    ship_query = """
    MATCH (s:Shipment)-[:SHIPPED_TO]->(l:Location)
    OPTIONAL MATCH (f:FinishedLot)-[:PACKAGED_INTO]->(s)
    RETURN s.shipment_id AS tlc,
           'Shipping' AS event_type,
           s.shipment_id AS event_id,
           s.shipped_at AS dt,
           s.carrier AS fac_id,
           l.name AS fac_name,
           s.shipment_id + ' to ' + l.city AS prod_desc,
           s.case_count AS qty,
           s.traceability_status AS t_status,
           s.shipping_disposition AS disp
    ORDER BY s.shipped_at ASC
    """
    res_ship = graph.query(ship_query)
    for row in res_ship.result_set:
        records.append({
            "tlc": row[0] or "",
            "event_type": row[1] or "Shipping",
            "event_id": row[2] or "",
            "timestamp": row[3] or "",
            "facility_id": row[4] or "",
            "facility_name": row[5] or "",
            "product_or_sku": row[6] or "",
            "quantity": f"{row[7]} cases" if row[7] is not None else "",
            "traceability_status": row[8] or "VERIFIED",
            "physical_disposition": row[9] or "IN_TRANSIT",
            "regulatory_notice": SYNTHETIC_NOTICE,
        })

    return records
