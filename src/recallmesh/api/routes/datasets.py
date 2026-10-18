"""Dataset management, validation, and real-data ingestion API routes."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import (
    DatasetImportRequest,
    DatasetImportResponse,
    DatasetSummary,
)
from src.recallmesh.ingestion import (
    get_sample_csv_template,
    get_sample_poultry_dataset,
    ingest_dataset,
    list_datasets,
    parse_csv_cte_dataset,
    validate_dataset,
)

router = APIRouter(tags=["Datasets & Ingestion"])


@router.get(
    "/api/datasets",
    response_model=List[DatasetSummary],
    summary="List all available datasets in FalkorDB",
)
def get_datasets(graph: Graph = Depends(get_active_graph)) -> List[DatasetSummary]:
    """Retrieves all registered datasets in the active graph.

    Distinguishes the built-in synthetic demo dataset from imported real-data sets.
    """
    raw_datasets = list_datasets(graph)
    return [DatasetSummary(**d) for d in raw_datasets]


@router.post(
    "/api/datasets/import",
    response_model=DatasetImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import, validate, and isolate a new supply chain dataset in FalkorDB",
)
def import_dataset(
    request: DatasetImportRequest,
    graph: Graph = Depends(get_active_graph),
) -> DatasetImportResponse:
    """Ingests a verified supply chain dataset (JSON or CSV).

    Performs strict in-memory pre-validation:
    - Identifier presence and uniqueness
    - Data type constraints
    - Referential integrity (raw lot suppliers, production event ingredients, shipment lots)
    - Provenance isolation: stamps dataset_id and is_demo=False on all entities
    - Idempotency: MERGE semantics prevent duplicate records on retries
    - Rejects invalid data with actionable HTTP 422 errors without partial database writes
    """
    import_format = (request.format or "json").lower().strip()
    actor = (request.ingested_by or "QA Ingestion Specialist").strip()

    dataset_dict: Dict[str, Any] = {}

    if import_format == "csv":
        if not request.csv_content or not request.csv_content.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "CSV content is empty.", "errors": ["'csv_content' must contain valid CSV rows."]},
            )
        ds_id = request.dataset_id or f"DS-CSV-{int(__import__('time').time())}"
        ds_name = request.name or f"Imported CSV Dataset {ds_id}"
        try:
            dataset_dict = parse_csv_cte_dataset(
                csv_text=request.csv_content,
                dataset_id=ds_id,
                dataset_name=ds_name,
                suspect_root_lot=request.suspect_root_lot,
                facility_id=request.facility_id or "FAC-IMPORT-01",
                ingested_by=actor,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Failed to parse CSV CTE rows.", "errors": [str(e)]},
            )
    else:
        # JSON format
        if not request.payload:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "JSON dataset payload is empty.", "errors": ["'payload' must contain a valid dataset object."]},
            )
        dataset_dict = dict(request.payload)
        if request.dataset_id or request.name or request.suspect_root_lot:
            meta = dict(dataset_dict.get("dataset_metadata") or {})
            if request.dataset_id:
                meta["dataset_id"] = request.dataset_id
            if request.name:
                meta["name"] = request.name
            if request.suspect_root_lot:
                meta["suspect_root_lot"] = request.suspect_root_lot
            dataset_dict["dataset_metadata"] = meta

    # Validate in-memory
    is_valid, validation_errors = validate_dataset(dataset_dict)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Dataset validation failed with {len(validation_errors)} error(s).",
                "errors": validation_errors,
            },
        )

    # Ingest into FalkorDB
    try:
        counts = ingest_dataset(graph=graph, data=dataset_dict, is_demo=False, actor=actor)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database write error during dataset ingestion: {e}",
        )

    ds_meta = dataset_dict.get("dataset_metadata", {})
    return DatasetImportResponse(
        dataset_id=counts["dataset_id"],
        name=counts["name"],
        ingested_at=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        entity_counts=counts["entity_counts"],
        suspect_root_lot=ds_meta.get("suspect_root_lot"),
        message=f"Dataset '{counts['name']}' ({counts['dataset_id']}) successfully validated and ingested into FalkorDB.",
        is_demo=False,
    )


@router.get(
    "/api/datasets/template",
    summary="Download sample dataset template (JSON or CSV)",
)
def get_dataset_template(
    format: str = Query("json", description="'json' or 'csv'"),
) -> Any:
    """Returns sample reference data conforming to the RECALLMESH schema.

    Enables testing and verification of independent datasets.
    """
    if format.lower() == "csv":
        csv_text = get_sample_csv_template()
        return PlainTextResponse(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=fsma_204_cte_sample_template.csv"},
        )
    return get_sample_poultry_dataset()
