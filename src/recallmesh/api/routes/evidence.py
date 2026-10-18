"""Evidence upload, safe retrieval, and simulated supplier evidence requests."""

from datetime import datetime, timezone
from typing import List
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import (
    EvidenceRequestCreate,
    EvidenceRequestResponse,
    EvidenceUploadResponse,
)
from src.recallmesh.audit import record_audit_event
from src.recallmesh.evidence import get_evidence_file_path, store_evidence_file

router = APIRouter(tags=["Evidence & Verification"])


@router.post(
    "/api/evidence/upload",
    response_model=EvidenceUploadResponse,
    summary="Upload QA laboratory certificate or verification documentation",
)
async def upload_evidence(
    file: UploadFile = File(..., description="Evidence file (PDF, PNG, JPG, max 10MB)"),
    lot_code: str = Form(..., min_length=1, max_length=100, description="Target lot identifier"),
    document_type: str = Form("LAB_CERTIFICATE", max_length=100),
    uploaded_by: str = Form("Dr. Elena Vance (QA Food Safety Lead)", max_length=100),
    graph: Graph = Depends(get_active_graph),
) -> EvidenceUploadResponse:
    """Stores validated evidence file locally and associates metadata with graph record.
    
    Enforces 10 MB size limit, binary magic byte verification, and secure random storage name.
    Does NOT assert legal validity or FDA certification of the certificate content.
    """
    clean_lot = lot_code.strip()
    
    # Read file content safely
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    # Store file, record in FalkorDB, and log audit event
    result = store_evidence_file(
        graph=graph,
        content=content,
        original_filename=file.filename or "uploaded_evidence.pdf",
        lot_code=clean_lot,
        document_type=document_type,
        uploaded_by=uploaded_by,
    )

    return EvidenceUploadResponse(**result)


@router.get(
    "/api/evidence/{document_id}/download",
    summary="Download previously uploaded evidence document",
)
def download_evidence(
    document_id: str,
    graph: Graph = Depends(get_active_graph),
) -> FileResponse:
    """Safely retrieves stored evidence document from local storage."""
    file_path, original_filename = get_evidence_file_path(graph, document_id)
    return FileResponse(
        path=str(file_path),
        filename=original_filename,
        media_type="application/octet-stream",
    )


@router.post(
    "/api/evidence/request",
    response_model=EvidenceRequestResponse,
    summary="Create a persistent simulated supplier evidence request",
)
def create_supplier_request(
    request: EvidenceRequestCreate,
    graph: Graph = Depends(get_active_graph),
) -> EvidenceRequestResponse:
    """Creates a persistent local simulation record for a supplier evidence request.
    
    Associates the request with the specified lot in FalkorDB and creates an audit entry.
    Explicitly simulated: no real external email, API call, or network request is dispatched.
    """
    clean_lot = request.target_lot.strip()

    # Find supplier connected to lot if available
    sup_query = """
    MATCH (r:RawLot {lot_code: $lot_code})<-[:ORIGINATED]-(s:Supplier)
    RETURN s.name AS name
    """
    res_sup = graph.query(sup_query, {"lot_code": clean_lot})
    supplier_name = request.supplier_name
    if not supplier_name and res_sup.result_set:
        supplier_name = res_sup.result_set[0][0]
    supplier_name = supplier_name or "Sunrise Spice Co. (Supplier TX-4)"

    req_id = f"REQ-SUP-{uuid.uuid4().hex[:8]}"
    timestamp_iso = datetime.now(timezone.utc).isoformat()

    # Create node in FalkorDB
    query = """
    CREATE (r:EvidenceRequest {
        request_id: $req_id,
        target_lot: $lot_code,
        supplier: $supplier,
        document_type: $doc_type,
        requested_by: $requested_by,
        requested_at: $requested_at,
        instructions: $instructions,
        status: 'SIMULATED_REQUEST_CREATED'
    })
    WITH r
    OPTIONAL MATCH (target) WHERE target.lot_code = $lot_code
    FOREACH (_ IN CASE WHEN target IS NOT NULL THEN [1] ELSE [] END |
        CREATE (target)-[:AWAITS_EVIDENCE]->(r)
    )
    """
    params = {
        "req_id": req_id,
        "lot_code": clean_lot,
        "supplier": supplier_name,
        "doc_type": request.document_type or "Certificate of Analysis (CoA)",
        "requested_by": request.requested_by or "Dr. Elena Vance (QA Food Safety Lead)",
        "requested_at": timestamp_iso,
        "instructions": request.instructions or "Please upload Certified Analysis of Cumin Extract Lot 2026-088.",
    }
    graph.query(query, params)

    # Record in audit trail
    record_audit_event(
        graph=graph,
        action_type="SUPPLIER_REQUEST_SIMULATED",
        outcome="SUCCESS",
        entity_id=clean_lot,
        actor=request.requested_by or "Dr. Elena Vance (QA Food Safety Lead)",
        details=f"Created simulated evidence request {req_id} to {supplier_name} for lot {clean_lot}.",
        is_simulation=True,
    )

    return EvidenceRequestResponse(
        request_id=req_id,
        target_lot=clean_lot,
        supplier=supplier_name,
        document_type=request.document_type or "Certificate of Analysis (CoA)",
        requested_at=timestamp_iso,
        status="SIMULATED_REQUEST_CREATED",
        simulation_disclaimer="Simulation only. Recorded in local FalkorDB property graph; no real-world external email or supplier notification was sent.",
        requested_by=request.requested_by or "Dr. Elena Vance (QA Food Safety Lead)",
        instructions=request.instructions or "Please upload Certified Analysis of Cumin Extract Lot 2026-088.",
    )


@router.get(
    "/api/evidence/requests/{request_id}",
    response_model=EvidenceRequestResponse,
    summary="Retrieve a previously created simulated supplier evidence request",
)
def get_supplier_request(
    request_id: str,
    graph: Graph = Depends(get_active_graph),
) -> EvidenceRequestResponse:
    """Retrieves an EvidenceRequest node by request ID from FalkorDB."""
    clean_id = request_id.strip()
    query = """
    MATCH (r:EvidenceRequest {request_id: $req_id})
    RETURN r.request_id AS request_id,
           r.target_lot AS target_lot,
           r.supplier AS supplier,
           r.document_type AS document_type,
           r.requested_by AS requested_by,
           r.requested_at AS requested_at,
           r.instructions AS instructions,
           r.status AS status
    """
    res = graph.query(query, {"req_id": clean_id})
    if not res.result_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence request '{request_id}' not found.",
        )
    row = res.result_set[0]
    return EvidenceRequestResponse(
        request_id=row[0],
        target_lot=row[1],
        supplier=row[2],
        document_type=row[3],
        requested_by=row[4],
        requested_at=row[5],
        instructions=row[6],
        status=row[7],
        simulation_disclaimer="Simulation only. Recorded in local FalkorDB property graph; no real-world external email or supplier notification was sent.",
    )


@router.get(
    "/api/evidence/requests",
    response_model=List[EvidenceRequestResponse],
    summary="List all simulated supplier evidence requests",
)
def list_supplier_requests(
    limit: int = 50,
    graph: Graph = Depends(get_active_graph),
) -> List[EvidenceRequestResponse]:
    """Lists simulated supplier requests stored in FalkorDB."""
    query = """
    MATCH (r:EvidenceRequest)
    RETURN r.request_id AS request_id,
           r.target_lot AS target_lot,
           r.supplier AS supplier,
           r.document_type AS document_type,
           r.requested_by AS requested_by,
           r.requested_at AS requested_at,
           r.instructions AS instructions,
           r.status AS status
    ORDER BY r.requested_at DESC
    LIMIT $limit
    """
    res = graph.query(query, {"limit": limit})
    results = []
    for row in res.result_set:
        results.append(
            EvidenceRequestResponse(
                request_id=row[0],
                target_lot=row[1],
                supplier=row[2],
                document_type=row[3],
                requested_by=row[4],
                requested_at=row[5],
                instructions=row[6],
                status=row[7],
                simulation_disclaimer="Simulation only. Recorded in local FalkorDB property graph; no real-world external email or supplier notification was sent.",
            )
        )
    return results

