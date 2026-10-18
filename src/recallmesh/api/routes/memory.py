"""Agent memory and institutional knowledge base endpoints."""

from typing import List
from fastapi import APIRouter, Depends
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import (
    AgentMemoryResponse,
    ConnectedEntityCounts,
    InstitutionalFact,
)

router = APIRouter(tags=["Agent Memory"])


@router.get(
    "/api/memory/facts",
    response_model=AgentMemoryResponse,
    summary="Retrieve verified institutional facts and active agent handovers from FalkorDB",
)
def get_memory_facts(graph: Graph = Depends(get_active_graph)) -> AgentMemoryResponse:
    """Returns actual stored institutional facts and agent handovers from FalkorDB.
    
    If no AgentMemory nodes are persisted in the active graph, returns an explicit empty list
    with connected entity summary data, without fabricating fictitious memories.
    """
    # 1. Query AgentMemory nodes if present in schema
    mem_query = """
    MATCH (m:AgentMemory)
    RETURN m.memory_id AS memory_id,
           m.fact_type AS fact_type,
           m.content AS content,
           m.source_reference AS source_ref,
           m.verified_at AS verified_at
    """
    res_mem = graph.query(mem_query)

    facts: List[InstitutionalFact] = []
    for row in res_mem.result_set:
        m_id, f_type, content, s_ref, v_at = row
        facts.append(
            InstitutionalFact(
                memory_id=m_id or "MEM-UNKNOWN",
                fact_type=f_type or "GENERAL",
                content=content or "",
                source_reference=s_ref,
                verified_at=v_at,
            )
        )

    # 2. Query actual connected entities from graph using standard Cypher
    def count_label(label: str) -> int:
        r = graph.query(f"MATCH (n:{label}) RETURN count(n)")
        return r.result_set[0][0] if r.result_set else 0

    connected_summary = ConnectedEntityCounts(
        suppliers_count=count_label("Supplier"),
        finished_lots_count=count_label("FinishedLot"),
        shipments_count=count_label("Shipment"),
        locations_count=count_label("Location"),
    )

    handovers = []
    # Check if any Decision node contains an automated handover event
    dec_res = graph.query(
        """
        MATCH (d:Decision)
        RETURN d.decision_id, d.decision_type, d.authorized_by, d.timestamp, d.rationale
        ORDER BY d.timestamp DESC
        LIMIT 5
        """
    )
    for row in dec_res.result_set:
        handovers.append({
            "decision_id": row[0],
            "decision_type": row[1],
            "authorized_by": row[2],
            "timestamp": row[3],
            "rationale": row[4],
        })

    status_str = "PERSISTED_RECORDS" if facts else "NO_RECORDS_STORED"
    note_str = None if facts else "No active AgentMemory nodes currently persisted in graph."

    return AgentMemoryResponse(
        facts=facts,
        handovers=handovers,
        total_facts=len(facts),
        connected_entity_summary=connected_summary,
        status=status_str,
        note=note_str,
    )
