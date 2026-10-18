"""Containment action planning and human-in-the-loop governance gate endpoints."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from falkordb import Graph

from datetime import datetime, timezone
from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import (
    ActionPlanResponse,
    ExecuteActionPlanRequest,
    ExecuteActionPlanResponse,
    UpdateActionStatusRequest,
    UpdateActionStatusResponse,
    ExportActionPlanResponse,
)
from src.recallmesh.tracer import (
    GovernanceException,
    build_containment_action_plan,
    execute_containment_action_plan,
    update_action_item_status,
)

router = APIRouter(tags=["Actions & Governance"])


@router.get(
    "/api/actions/plan",
    response_model=ActionPlanResponse,
    summary="Construct a containment proposal grounded in graph evidence paths",
)
def get_action_plan(
    raw_lot_code: Optional[str] = Query(None, description="Suspect lot code"),
    root_lot_id: Optional[str] = Query(None, description="Alias for raw_lot_code"),
    dataset_id: Optional[str] = Query(None, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> ActionPlanResponse:
    """Builds a structured, evidence-grounded containment action plan.
    
    All proposed actions (quarantines, carrier holds, consignee notices, gap audits)
    are initially in 'PROPOSED' status and require explicit human QA authorization.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    clean_lot = (root_lot_id or raw_lot_code or "").strip()

    if not clean_lot and clean_ds:
        ds_res = graph.query("MATCH (d:Dataset {dataset_id: $ds_id}) RETURN d.suspect_root_lot", {"ds_id": clean_ds})
        if ds_res.result_set and ds_res.result_set[0][0]:
            clean_lot = ds_res.result_set[0][0]

    if not clean_lot:
        clean_lot = "LOT-CUM-2026-088"

    plan = build_containment_action_plan(graph, clean_lot, dataset_id=clean_ds)
    return ActionPlanResponse(**plan)


@router.post(
    "/api/actions/item/status",
    response_model=UpdateActionStatusResponse,
    summary="Update status of an individual action item with governance approval signature",
)
def update_item_status(
    request: UpdateActionStatusRequest,
    graph: Graph = Depends(get_active_graph),
) -> UpdateActionStatusResponse:
    """Transitions an action item's status through human governance gate.

    Statuses: PROPOSED (Draft), PENDING_REVIEW, APPROVED, REJECTED (Blocked), COMPLETED.
    Requires human signature (actor) and audit rationale.
    Persists change to FalkorDB Action node and records immutable AuditEvent.
    """
    try:
        result = update_action_item_status(
            graph=graph,
            action_id=request.action_id,
            new_status=request.new_status,
            actor=request.actor,
            rationale=request.rationale,
            supporting_evidence_ids=request.supporting_evidence_ids,
        )
        return UpdateActionStatusResponse(**result)
    except GovernanceException as ge:
        from src.recallmesh.audit import record_audit_event
        record_audit_event(
            graph=graph,
            action_type="ACTION_STATUS_REJECTED",
            outcome="REJECTED",
            entity_id=request.action_id,
            actor=request.actor or "UNAUTHORIZED",
            details=f"Governance barrier rejected action update: {str(ge)}",
            is_simulation=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(ge),
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update action item status: {str(e)}",
        )


@router.post(
    "/api/actions/execute",
    response_model=ExecuteActionPlanResponse,
    summary="Execute simulated containment actions through the human authorization gate",
)
def execute_actions(
    request: ExecuteActionPlanRequest,
    graph: Graph = Depends(get_active_graph),
) -> ExecuteActionPlanResponse:
    """Invokes the governance-gated containment execution gate.
    
    Requires a valid human authorization signature (e.g. 'Morgan Bailey').
    Rejects unauthorized or malformed requests with HTTP 403 Forbidden.
    All actions executed are strictly dry-run simulated digital twin actions;
    never dispatches real-world holds or notifications.
    """
    # 1. Validate request structure
    plan = request.action_plan
    if not isinstance(plan, dict) or "proposed_actions" not in plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed request: 'action_plan' must contain a 'proposed_actions' array.",
        )

    # 2. Invoke governance gate with exception handling
    try:
        execution_result = execute_containment_action_plan(
            graph=graph,
            action_plan=plan,
            authorized_by=request.authorized_by,
            rationale=request.rationale or "Authorized QA Director containment signoff",
        )
    except GovernanceException as ge:
        from src.recallmesh.audit import record_audit_event
        record_audit_event(
            graph=graph,
            action_type="CONTAINMENT_REJECTED",
            outcome="REJECTED",
            entity_id=plan.get("suspect_raw_lot", ""),
            actor=request.authorized_by or "UNAUTHORIZED",
            details=f"Governance barrier rejected unauthorized containment execution: {str(ge)}",
            is_simulation=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(ge),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Containment plan execution failed: {str(e)}",
        )

    # 3. Log persistent audit trail event
    from src.recallmesh.audit import record_audit_event
    record_audit_event(
        graph=graph,
        action_type="CONTAINMENT_SIMULATED",
        outcome="SUCCESS",
        entity_id=execution_result["decision_id"],
        actor=request.authorized_by or "QA Food Safety Lead",
        details=f"Executed simulated containment decision {execution_result['decision_id']} ({execution_result['total_executed']} actions approved).",
        is_simulation=True,
    )

    return ExecuteActionPlanResponse(
        decision_id=execution_result["decision_id"],
        authorized_by=execution_result["authorized_by"],
        authorized_at=execution_result["authorized_at"],
        executed_actions=execution_result["executed_actions"],
        total_executed=execution_result["total_executed"],
        status=execution_result["status"],
    )


@router.get(
    "/api/actions/export",
    response_model=ExportActionPlanResponse,
    summary="Export formal FSMA 204 containment action plan dossier in markdown and JSON format",
)
def export_action_plan(
    raw_lot_code: Optional[str] = Query(None, description="Suspect lot code"),
    root_lot_id: Optional[str] = Query(None, description="Alias for raw_lot_code"),
    dataset_id: Optional[str] = Query(None, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> ExportActionPlanResponse:
    """Generates an audit-ready FSMA Section 204 containment dossier."""
    clean_ds = dataset_id.strip() if dataset_id else None
    clean_lot = (root_lot_id or raw_lot_code or "").strip()

    if not clean_lot and clean_ds:
        ds_res = graph.query("MATCH (d:Dataset {dataset_id: $ds_id}) RETURN d.suspect_root_lot", {"ds_id": clean_ds})
        if ds_res.result_set and ds_res.result_set[0][0]:
            clean_lot = ds_res.result_set[0][0]

    if not clean_lot:
        clean_lot = "LOT-CUM-2026-088"

    plan = build_containment_action_plan(graph, clean_lot, dataset_id=clean_ds)
    timestamp_utc = datetime.now(timezone.utc).isoformat()
    plan_id = f"PLAN-{clean_lot}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

    # Generate Markdown Dossier
    lines = [
        f"# FSMA 204 CONTAINMENT ACTION PLAN DOSSIER",
        f"**Plan ID:** `{plan_id}`  ",
        f"**Target Lot:** `{clean_lot}`  ",
        f"**Generated:** {timestamp_utc}  ",
        f"**Governance Gate:** Human Signoff Required (`requires_authorization=true`)  ",
        f"**Simulation Guardrail:** Active (Digital Twin Dry-Run Only — No live external holds dispatched)  ",
        "",
        "---",
        "",
        "## 1. Supporting Lab & Traceability Evidence",
    ]
    if plan["evidence_cited"]:
        for ev in plan["evidence_cited"]:
            lines.append(f"- **{ev.get('title', 'Evidence')}** (`{ev.get('evidence_id')}`)")
            lines.append(f"  - Type: {ev.get('evidence_type')} | Hash: `{ev.get('hash_sha256', 'N/A')[:16]}...`")
    else:
        lines.append("- *No supporting evidence records linked directly to this raw lot.*")

    lines.extend([
        "",
        "## 2. Proposed Containment Actions & Target Entities",
        "",
        "| ID | Type | Target | Status | Initiator | Instructions |",
        "|---|---|---|---|---|---|",
    ])
    for act in plan["proposed_actions"]:
        lines.append(
            f"| `{act['action_id']}` | {act['action_type']} | `{act['target_id']}` | **{act['status']}** | {act.get('initiator', 'QA')} | {act['instructions']} |"
        )

    lines.extend([
        "",
        "## 3. Human Governance & Compliance Certification",
        "Under 21 CFR § 1.1300–1.1400 (FSMA Section 204), all product holds, stop-shipment commands,",
        "and consignee notifications must be formally authorized by qualified personnel.",
        "",
        f"**Authorized Status:** {plan['authorized']}  ",
        "**Regulatory Disclaimer:** Synthetic Demo Data • Not FDA Certified • Research Prototype Only.",
    ])

    return ExportActionPlanResponse(
        plan_id=plan_id,
        raw_lot_code=clean_lot,
        export_format="markdown",
        generated_at_utc=timestamp_utc,
        content="\n".join(lines),
        structured_plan=plan,
        simulation_disclaimer="Synthetic Demo • Research Prototype Only",
    )
