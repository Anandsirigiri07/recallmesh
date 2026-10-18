"""Evidence storage and verification management for RECALLMESH.

Enforces server-side format verification (magic bytes), 10 MB size limits,
secure nonce filenames, path traversal prevention, and FalkorDB metadata persistence.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import uuid
from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from falkordb import Graph

from src.recallmesh.audit import record_audit_event

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB limit
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

# Magic byte signatures
SIGNATURES = {
    ".pdf": b"%PDF",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
}

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "evidence_uploads"


def ensure_upload_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


def validate_file_content(content: bytes, filename: str) -> str:
    """Validates file extension and binary magic bytes."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, PNG, JPG, JPEG.",
        )

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 10 MB ({len(content)} bytes uploaded).",
        )

    sig = SIGNATURES.get(ext)
    if sig and not content.startswith(sig):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File contents do not match header signature for format '{ext}'. Spoofed or corrupted file rejected.",
        )

    return ext


def store_evidence_file(
    graph: Graph,
    content: bytes,
    original_filename: str,
    lot_code: str,
    document_type: str = "LAB_CERTIFICATE",
    uploaded_by: str = "Dr. Elena Vance (QA Food Safety Lead)",
) -> Dict[str, Any]:
    """Stores validated evidence file locally and records metadata in FalkorDB."""
    ext = validate_file_content(content, original_filename)
    dest_dir = ensure_upload_dir()

    # Generate secure nonce filename
    doc_id = f"DOC-{uuid.uuid4().hex[:10]}"
    timestamp_iso = datetime.now(timezone.utc).isoformat()
    stored_name = f"{doc_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{ext}"
    dest_path = dest_dir / stored_name

    # Write file securely
    with open(dest_path, "wb") as f:
        f.write(content)

    # Persist in FalkorDB
    query = """
    CREATE (d:EvidenceDocument {
        document_id: $doc_id,
        original_filename: $original_filename,
        stored_filename: $stored_name,
        lot_code: $lot_code,
        document_type: $document_type,
        size_bytes: $size_bytes,
        uploaded_at: $uploaded_at,
        uploaded_by: $uploaded_by,
        status: 'UPLOADED_VERIFICATION_PENDING'
    })
    WITH d
    OPTIONAL MATCH (target) WHERE target.lot_code = $lot_code
    FOREACH (_ IN CASE WHEN target IS NOT NULL THEN [1] ELSE [] END |
        CREATE (target)-[:HAS_EVIDENCE]->(d)
    )
    RETURN d.document_id AS document_id
    """
    params = {
        "doc_id": doc_id,
        "original_filename": os.path.basename(original_filename),
        "stored_name": stored_name,
        "lot_code": lot_code,
        "document_type": document_type,
        "size_bytes": len(content),
        "uploaded_at": timestamp_iso,
        "uploaded_by": uploaded_by,
    }
    graph.query(query, params)

    # Record in persistent audit trail
    record_audit_event(
        graph=graph,
        action_type="EVIDENCE_UPLOADED",
        outcome="SUCCESS",
        entity_id=lot_code,
        actor=uploaded_by,
        details=f"Uploaded {original_filename} ({len(content)} bytes) for lot {lot_code}. Stored as {doc_id}.",
        is_simulation=False,
    )

    return {
        "document_id": doc_id,
        "filename": original_filename,
        "lot_code": lot_code,
        "document_type": document_type,
        "size_bytes": len(content),
        "uploaded_at": timestamp_iso,
        "status": "Uploaded — verification pending",
        "verification_disclaimer": "File successfully uploaded and stored locally. Note: Uploading does not verify document validity or FDA compliance.",
    }


def get_evidence_file_path(graph: Graph, document_id: str) -> Tuple[Path, str]:
    """Retrieves safe local filesystem path and original filename for a stored document."""
    query = """
    MATCH (d:EvidenceDocument {document_id: $doc_id})
    RETURN d.stored_filename AS stored_filename, d.original_filename AS original_filename
    """
    res = graph.query(query, {"doc_id": document_id})
    if not res.result_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence document '{document_id}' not found.",
        )

    stored_name = res.result_set[0][0]
    orig_name = res.result_set[0][1]

    # Protect against path traversal
    safe_dir = ensure_upload_dir().resolve()
    target_path = (safe_dir / stored_name).resolve()
    if not str(target_path).startswith(str(safe_dir)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path traversal attempt.")

    if not target_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored document file not found on disk.")

    return target_path, orig_name
