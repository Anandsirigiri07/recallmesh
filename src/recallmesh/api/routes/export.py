"""Electronic sortable spreadsheet export route for FDA FSMA 204 critical tracking events."""

import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.cte import fetch_cte_records, SYNTHETIC_NOTICE

router = APIRouter(tags=["Export"])


@router.get(
    "/api/export/fsma-204-spreadsheet",
    summary="Export critical tracking events as an RFC 4180-compliant sortable CSV spreadsheet",
)
def export_fsma_spreadsheet(
    raw_lot_code: Optional[str] = Query(None, description="Optional raw lot code filter"),
    graph: Graph = Depends(get_active_graph),
) -> Response:
    """Exports actual Critical Tracking Events (CTEs) stored in FalkorDB as a downloadable CSV.
    
    Includes Receiving, Transformation, and Shipping events with stable column headers.
    Properly escapes commas, quotes, newlines, and UTF-8 characters.
    Missing fields remain empty string without inventing fabricated events.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Standardized FSMA Rule 204 Electronic Sortable Spreadsheet columns
    headers = [
        "TLC",
        "Event_Type",
        "Event_ID",
        "Date_Time_UTC",
        "Facility_ID",
        "Facility_Name",
        "GLN",
        "Product_or_Ingredient",
        "Quantity_or_Units",
        "Input_TLCs",
        "Output_TLCs",
        "Traceability_Status",
        "Physical_Disposition",
        "Regulatory_Notice",
    ]
    writer.writerow(headers)

    records = fetch_cte_records(graph, raw_lot_code)
    for r in records:
        writer.writerow([
            r["tlc"],
            r["event_type"],
            r["event_id"],
            r["timestamp"],
            r["facility_id"],
            r["facility_name"],
            "",  # GLN
            r["product_or_sku"],
            r["quantity"],
            "",  # Input_TLCs
            "",  # Output_TLCs
            r["traceability_status"],
            r["physical_disposition"],
            r["regulatory_notice"],
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="fsma_204_cte_ledger.csv"',
            "Cache-Control": "no-cache",
        },
    )
