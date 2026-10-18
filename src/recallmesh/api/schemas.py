"""Pydantic request and response models for RECALLMESH API endpoints.

Enforces strict type validation, descriptive fields, and consistent JSON serialization.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, root_validator


# ==============================================================================
# Health Check Schemas
# ==============================================================================

class HealthResponse(BaseModel):
    status: str = Field(..., description="'healthy' or 'degraded'")
    falkordb_connected: bool = Field(..., description="Whether local FalkorDB responded to ping")
    graph_name: str = Field(..., description="Active FalkorDB graph identifier")
    version: str = Field(..., description="API version")
    timestamp_utc: str = Field(..., description="Current UTC timestamp in ISO 8601 format")
    note: Optional[str] = Field(None, description="Diagnostic notice if degraded")


# ==============================================================================
# Overview Metrics Schemas
# ==============================================================================

class CaseSummary(BaseModel):
    case_id: str
    opened_at: Optional[str] = None
    hazard_type: Optional[str] = None
    pathogen_or_hazard: Optional[str] = None
    suspect_raw_lot: Optional[str] = None
    provisional_class: Optional[str] = None
    lifecycle_status: Optional[str] = None
    title: Optional[str] = None
    lead_investigator: Optional[str] = None


class OverviewMetricsResponse(BaseModel):
    active_cases_count: int = Field(..., description="Count of open recall cases")
    shipments_traced_count: int = Field(..., description="Count of shipments connected to suspect lineage")
    records_needing_review_count: int = Field(..., description="Count of records with incomplete or review status")
    gaps_open_count: int = Field(..., description="Count of unlinked or orphan lots violating FSMA 204")
    finished_lots_count: int = Field(..., description="Total finished lots in the active graph")
    quarantined_finished_lots_count: int = Field(..., description="Finished lots physically quarantined")
    available_finished_lots_count: int = Field(..., description="Finished lots currently available")
    current_case: Optional[CaseSummary] = Field(None, description="Primary active case summary")
    recent_decisions_count: int = Field(0, description="Count of logged containment decisions")


# ==============================================================================
# Node Inspector Schemas
# ==============================================================================

class RelationshipInfo(BaseModel):
    relationship_type: str
    connected_node_id: str
    connected_node_label: str
    direction: str = Field(..., description="'INCOMING' or 'OUTGOING'")


class NodeInspectorResponse(BaseModel):
    node_id: str
    primary_label: str
    display_name: str
    properties: Dict[str, Any]
    incoming_relationships: List[RelationshipInfo]
    outgoing_relationships: List[RelationshipInfo]
    traceability_status: Optional[str] = None
    disposition: Optional[str] = None
    is_gap_detected: bool = False
    why_included: Optional[str] = None


# ==============================================================================
# Graph Visualization (6-Stage Layout) Schemas
# ==============================================================================

class VisNode(BaseModel):
    id: str
    label: str
    display_name: str
    stage: Optional[int] = Field(None, description="1..6 or null if unplaced")
    stage_name: str = Field(..., description="e.g. '01. Supplier', '04. Finished Lot', 'UNPLACED'")
    traceability_status: Optional[str] = None
    disposition: Optional[str] = None
    is_affected: bool = False
    is_gap: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class VisEdge(BaseModel):
    source: str
    target: str
    type: str
    is_affected_path: bool = False
    is_missing_link: bool = False


class GraphVisResponse(BaseModel):
    root_lot_code: Optional[str] = None
    total_nodes: int
    total_edges: int
    nodes: List[VisNode]
    edges: List[VisEdge]
    stages_legend: Dict[int, str] = {
        1: "Supplier",
        2: "Ingredient Lot",
        3: "Production Event",
        4: "Finished Lot",
        5: "Shipment",
        6: "Destination",
    }


# ==============================================================================
# Trace Schemas
# ==============================================================================

class DownstreamTraceResponse(BaseModel):
    suspect_raw_lot: str
    evidence: List[Dict[str, Any]]
    affected_finished_lots: List[Dict[str, Any]]
    affected_shipments: List[Dict[str, Any]]
    trace_paths: List[Dict[str, Any]]
    total_affected_finished_lots: int
    total_affected_shipments: int


class UpstreamTraceResponse(BaseModel):
    target_finished_lot: str
    lineage: List[Dict[str, Any]]
    is_orphaned: bool


class TraceGapsResponse(BaseModel):
    gap_detected_finished_lots: List[Dict[str, Any]]
    gap_detected_shipments: List[Dict[str, Any]]
    total_gaps_found: int
    review_tasks: List[Dict[str, Any]]


# ==============================================================================
# Machine Learning Schemas
# ==============================================================================

class PredictRiskRequest(BaseModel):
    product_description: str = Field(..., min_length=1, max_length=5000, description="Product SKU or label text")
    reason_for_recall: str = Field(..., min_length=1, max_length=5000, description="Hazard description or lab screen finding")
    model_type: Optional[str] = Field("improved_three_class", description="'improved_three_class', 'baseline_three_class', or 'binary'")
    threshold: Optional[float] = Field(0.43, ge=0.0, le=1.0, description="Decision threshold for binary classifier")


class PublishedMetricsBenchmark(BaseModel):
    model_name: str
    evaluation_split: str = "Past-to-future chronological test split (Sep 2023 - Sep 2026)"
    test_accuracy: float
    test_macro_f1: Optional[float] = None
    test_class_i_recall: Optional[float] = None
    test_roc_auc: Optional[float] = None
    note: str = "Documented offline evaluation metric; not a live runtime score."


class PredictRiskResponse(BaseModel):
    model_type: str
    task_type: str = Field(..., description="'three_class_classification' or 'binary_severity_classification'")
    
    # 3-Class outputs (populated when model_type is 3-class)
    predicted_class: Optional[str] = None
    confidence: Optional[float] = None
    class_probabilities: Optional[Dict[str, float]] = None
    top_explanatory_features: Optional[List[str]] = None
    
    # Binary outputs (populated when model_type is binary)
    predicted_binary_label: Optional[str] = None
    is_class_i: Optional[bool] = None
    class_i_probability: Optional[float] = None
    non_class_i_probability: Optional[float] = None
    threshold_applied: Optional[float] = None
    
    status: str
    disclaimer: str
    published_benchmark_metrics: PublishedMetricsBenchmark


# ==============================================================================
# Action Plans & Governance Schemas
# ==============================================================================

class ActionItem(BaseModel):
    action_id: str
    action_type: str
    status: str
    target_id: str
    target_entity: str
    evidence_references: List[str]
    title: str
    instructions: str
    carrier: Optional[str] = None
    recipient_email: Optional[str] = None
    initiator: Optional[str] = "Response Planner · QA Team"
    path_classification: Optional[str] = "CONFIRMED_AFFECTED"
    origin_facility: Optional[str] = None
    origin_facility_id: Optional[str] = None
    source_contaminant: Optional[str] = None
    target_facility: Optional[str] = None
    current_state: Optional[List[str]] = Field(default_factory=list)
    simulation_impact: Optional[List[str]] = Field(default_factory=list)
    audit_trail: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    authorized_by: Optional[str] = None
    rationale: Optional[str] = None
    updated_at: Optional[str] = None


class ActionPlanResponse(BaseModel):
    case_id: str
    suspect_raw_lot: str
    evidence_cited: List[Dict[str, Any]]
    proposed_actions: List[ActionItem]
    total_actions: int
    requires_authorization: bool
    authorized: bool
    generated_at: Optional[str] = None
    simulation_note: str = (
        "Simulated actions only. Nothing real is stopped or sent. "
        "Production warehouse management systems (WMS) remain unaffected."
    )


class ExecuteActionPlanRequest(BaseModel):
    action_plan: Dict[str, Any] = Field(..., description="Action plan object returned from /api/actions/plan")
    authorized_by: Optional[str] = Field(None, description="Human signature required by governance policy")
    rationale: Optional[str] = Field("Authorized QA Director containment signoff", description="Audit rationale")


class ExecuteActionPlanResponse(BaseModel):
    decision_id: str
    authorized_by: str
    authorized_at: str
    executed_actions: List[Dict[str, Any]]
    total_executed: int
    status: str
    simulation_note: str = (
        "Simulated dry-run digital twin actions only. "
        "No real-world warehouse holds, carrier reroutes, or external notifications were dispatched."
    )


class UpdateActionStatusRequest(BaseModel):
    action_id: str = Field(..., min_length=1, max_length=100, description="Identifier of action item")
    new_status: str = Field(..., description="'PROPOSED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', or 'COMPLETED'")
    actor: str = Field(..., min_length=1, max_length=200, description="Name and title of human operator")
    rationale: str = Field(..., min_length=1, max_length=1000, description="Audit justification")
    supporting_evidence_ids: Optional[List[str]] = Field(default_factory=list)


class UpdateActionStatusResponse(BaseModel):
    action_id: str
    previous_status: str
    status: str
    actor: str
    rationale: str
    updated_at: str
    audit_event_id: str
    message: str


class ExportActionPlanResponse(BaseModel):
    plan_id: str
    raw_lot_code: str
    export_format: str = "markdown"
    generated_at_utc: str
    content: str
    structured_plan: Dict[str, Any]
    simulation_disclaimer: str


# ==============================================================================
# Agent Memory & Company Brain Schemas
# ==============================================================================

class InstitutionalFact(BaseModel):
    memory_id: str
    fact_type: str
    content: str
    source_reference: Optional[str] = None
    verified_at: Optional[str] = None


class ConnectedEntityCounts(BaseModel):
    suppliers_count: int
    finished_lots_count: int
    shipments_count: int
    locations_count: int


class AgentMemoryResponse(BaseModel):
    facts: List[InstitutionalFact]
    handovers: List[Dict[str, Any]]
    total_facts: int
    connected_entity_summary: ConnectedEntityCounts
    status: str
    note: Optional[str] = None


# ==============================================================================
# Search Schemas
# ==============================================================================

class SearchMatch(BaseModel):
    entity_type: str
    entity_id: str
    display_name: str
    traceability_status: Optional[str] = None
    disposition: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    total_matches: int
    matches: List[SearchMatch]


# ==============================================================================
# Critical Tracking Events (CTEs) JSON Schemas
# ==============================================================================

class CTERecord(BaseModel):
    tlc: str = Field(..., description="Traceability Lot Code")
    event_type: str = Field(..., description="'Receiving', 'Transformation', or 'Shipping'")
    event_id: str = Field(..., description="Unique Critical Tracking Event identifier")
    timestamp: Optional[str] = Field(None, description="Event timestamp in ISO format")
    facility_id: Optional[str] = Field(None, description="Facility or carrier identifier")
    facility_name: Optional[str] = Field(None, description="Facility or business name")
    product_or_sku: Optional[str] = Field(None, description="Product description or SKU name")
    quantity: Optional[str] = Field(None, description="Recorded quantity with unit of measure")
    traceability_status: str = Field(..., description="'VERIFIED', 'GAP_DETECTED', etc.")
    physical_disposition: str = Field(..., description="'AVAILABLE', 'QUARANTINED', 'IN_TRANSIT', etc.")
    regulatory_notice: str = Field(..., description="Demonstration data notice")


class CTERecordsResponse(BaseModel):
    records: List[CTERecord]
    total_records: int


# ==============================================================================
# Audit Trail Schemas
# ==============================================================================

class AuditEvent(BaseModel):
    event_id: str
    timestamp: str
    action_type: str
    outcome: str
    entity_id: Optional[str] = None
    actor: str
    details: str
    is_simulation: bool = True


class AuditTimelineResponse(BaseModel):
    events: List[AuditEvent]
    total_events: int


# ==============================================================================
# Evidence Upload & Supplier Request Schemas
# ==============================================================================

class EvidenceUploadResponse(BaseModel):
    document_id: str
    filename: str
    lot_code: str
    document_type: str
    size_bytes: int
    uploaded_at: str
    status: str
    verification_disclaimer: str


class EvidenceRequestCreate(BaseModel):
    target_lot: str = Field(..., min_length=1, max_length=100)
    supplier_name: Optional[str] = Field(None, max_length=200)
    document_type: Optional[str] = Field("Certificate of Analysis (CoA)", max_length=100)
    requested_by: Optional[str] = Field("Dr. Elena Vance (QA Food Safety Lead)", max_length=100)
    instructions: Optional[str] = Field(None, max_length=1000)


class EvidenceRequestResponse(BaseModel):
    request_id: str
    target_lot: str
    supplier: str
    document_type: str
    requested_at: str
    status: str
    simulation_disclaimer: str
    requested_by: Optional[str] = None
    instructions: Optional[str] = None



# ==============================================================================
# Investigation Docket Creation Schemas
# ==============================================================================

class CreateCaseRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    suspect_raw_lot: str = Field(..., min_length=1, max_length=100)
    hazard_description: Optional[str] = Field(None, max_length=1000)
    description: Optional[str] = Field(None, max_length=1000)
    pathogen_or_hazard: Optional[str] = Field(None, max_length=200)
    hazard_type: Optional[str] = Field(None, max_length=100)
    source_facility: Optional[str] = Field(None, max_length=200)
    lead_investigator: Optional[str] = Field("Dr. Elena Vance (QA Food Safety Lead)", max_length=100)
    dataset_id: Optional[str] = Field(None, max_length=100)

    @root_validator(pre=True)
    def unify_hazard(cls, values):
        if not values.get("hazard_description"):
            values["hazard_description"] = values.get("description") or values.get("pathogen_or_hazard") or "Microbiological Contamination"
        return values



class CreateCaseResponse(BaseModel):
    case_id: str
    title: str
    suspect_raw_lot: str
    hazard: str
    source_facility: Optional[str] = None
    opened_at: str
    status: str
    note: str


# ==========================================
# Dataset Management & Ingestion Schemas
# ==========================================

class DatasetSummary(BaseModel):
    dataset_id: str
    name: str
    description: str
    facility_id: Optional[str] = None
    suspect_root_lot: Optional[str] = None
    ingested_at: str
    is_demo: bool = False
    ingested_by: str = "System"
    raw_lot_count: int = 0
    finished_lot_count: int = 0


class DatasetImportRequest(BaseModel):
    format: str = Field("json", description="Import format: 'json' or 'csv'")
    payload: Optional[Dict[str, Any]] = Field(None, description="Structured dataset JSON payload")
    csv_content: Optional[str] = Field(None, description="FSMA 204 CTE CSV text")
    dataset_id: Optional[str] = Field(None, description="Optional override dataset_id")
    name: Optional[str] = Field(None, description="Optional override name")
    suspect_root_lot: Optional[str] = Field(None, description="Optional override suspect root lot")
    facility_id: Optional[str] = Field(None, description="Optional facility ID")
    ingested_by: Optional[str] = Field("QA Ingestion Specialist", description="Operator identity")

    @root_validator(pre=True)
    def normalize_aliases(cls, values):
        if not isinstance(values, dict):
            return values
        if "dataset_json" in values and "payload" not in values:
            values["payload"] = values["dataset_json"]
        if "csv_text" in values and "csv_content" not in values:
            values["csv_content"] = values["csv_text"]
        if "dataset_name" in values and "name" not in values:
            values["name"] = values["dataset_name"]
        return values


class DatasetImportResponse(BaseModel):
    dataset_id: str
    name: str
    ingested_at: str
    entity_counts: Dict[str, int]
    suspect_root_lot: Optional[str] = None
    message: str
    is_demo: bool = False


