"""Persistent audit logging for RECALLMESH operations in FalkorDB.

Enforces server-generated UTC timestamps, immutable audit event records,
and clear simulation markers.
"""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional
from falkordb import Graph


def record_audit_event(
    graph: Graph,
    action_type: str,
    outcome: str = "SUCCESS",
    entity_id: Optional[str] = None,
    actor: str = "Dr. Elena Vance (QA Food Safety Lead)",
    details: str = "",
    is_simulation: bool = True,
) -> Dict[str, Any]:
    """Records an immutable audit event in FalkorDB.
    
    Generates unique server-side audit ID and UTC timestamp.
    """
    event_id = f"AUD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    timestamp_iso = datetime.now(timezone.utc).isoformat()

    query = """
    CREATE (a:AuditEvent {
        event_id: $event_id,
        timestamp: $timestamp,
        action_type: $action_type,
        outcome: $outcome,
        entity_id: $entity_id,
        actor: $actor,
        details: $details,
        is_simulation: $is_simulation
    })
    """
    params = {
        "event_id": event_id,
        "timestamp": timestamp_iso,
        "action_type": action_type,
        "outcome": outcome,
        "entity_id": entity_id or "",
        "actor": actor,
        "details": details,
        "is_simulation": is_simulation,
    }
    graph.query(query, params)

    return {
        "event_id": event_id,
        "timestamp": timestamp_iso,
        "action_type": action_type,
        "outcome": outcome,
        "entity_id": entity_id or "",
        "actor": actor,
        "details": details,
        "is_simulation": is_simulation,
    }


def get_audit_events(graph: Graph, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves chronological audit events from FalkorDB."""
    query = """
    MATCH (a:AuditEvent)
    RETURN a.event_id AS event_id,
           a.timestamp AS timestamp,
           a.action_type AS action_type,
           a.outcome AS outcome,
           a.entity_id AS entity_id,
           a.actor AS actor,
           a.details AS details,
           a.is_simulation AS is_simulation
    ORDER BY a.timestamp DESC
    LIMIT $limit
    """
    res = graph.query(query, {"limit": limit})
    events = []
    for row in res.result_set:
        events.append({
            "event_id": row[0],
            "timestamp": row[1],
            "action_type": row[2],
            "outcome": row[3],
            "entity_id": row[4],
            "actor": row[5],
            "details": row[6],
            "is_simulation": bool(row[7]),
        })
    return events
