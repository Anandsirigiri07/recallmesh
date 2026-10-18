"""Graph schema definition and index management for RECALLMESH.

Ensures fast, indexed lookups on all critical tracking keys across:
- Suppliers
- Ingredients
- Raw lots
- Production events
- Finished lots
- Shipments
- Locations
- Evidence & Cases
- Governance units & Actions
"""

import logging
from typing import List, Tuple
from falkordb import Graph

logger = logging.getLogger(__name__)

# List of (Label, property_name) to index
SCHEMA_INDICES: List[Tuple[str, str]] = [
    ("Supplier", "supplier_id"),
    ("Ingredient", "ingredient_id"),
    ("RawLot", "lot_code"),
    ("ProductionEvent", "event_id"),
    ("FinishedLot", "lot_code"),
    ("Shipment", "shipment_id"),
    ("Location", "location_id"),
    ("RecallCase", "case_id"),
    ("Evidence", "evidence_id"),
    ("OrgUnit", "unit_id"),
    ("Decision", "decision_id"),
    ("Action", "action_id"),
    ("AgentMemory", "memory_id"),
    ("Dataset", "dataset_id"),
]


def setup_schema(graph: Graph) -> List[str]:
    """Idempotently sets up property-graph indices in FalkorDB.

    Returns the list of indices created or verified.
    """
    created = []
    for label, prop in SCHEMA_INDICES:
        query = f"CREATE INDEX FOR (n:{label}) ON (n.{prop})"
        try:
            graph.query(query)
            created.append(f"{label}.{prop} (created)")
        except Exception as e:
            err_msg = str(e).lower()
            if "already indexed" in err_msg or "already exists" in err_msg:
                created.append(f"{label}.{prop} (existing)")
            else:
                logger.warning(f"Could not create index for {label}.{prop}: {e}")
                created.append(f"{label}.{prop} (skipped: {e})")
    return created
