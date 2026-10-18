/**
 * TypeScript API interfaces for RECALLMESH
 * Mirrors backend Pydantic models in src/recallmesh/api/schemas.py
 */

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  falkordb_connected: boolean;
  graph_name: string;
  version: string;
  timestamp_utc: string;
  note?: string | null;
}

export interface CaseSummary {
  case_id: string;
  opened_at?: string | null;
  hazard_type?: string | null;
  pathogen_or_hazard?: string | null;
  suspect_raw_lot?: string | null;
  provisional_class?: string | null;
  lifecycle_status?: string | null;
  title?: string | null;
  lead_investigator?: string | null;
}

export interface PublishedMetricsBenchmark {
  model_name: string;
  evaluation_split: string;
  test_accuracy: number;
  test_macro_f1?: number | null;
  test_class_i_recall?: number | null;
  test_roc_auc?: number | null;
  note: string;
}

export interface PredictRiskRequest {
  product_description: string;
  reason_for_recall: string;
  model_type?: 'improved_three_class' | 'baseline_three_class' | 'binary';
  threshold?: number;
}

export interface PredictRiskResponse {
  model_type: string;
  task_type: string;
  predicted_class?: string | null;
  confidence?: number | null;
  class_probabilities?: Record<string, number> | null;
  top_explanatory_features?: string[] | null;
  predicted_binary_label?: string | null;
  is_class_i?: boolean | null;
  class_i_probability?: number | null;
  non_class_i_probability?: number | null;
  threshold_applied?: number | null;
  status: string;
  disclaimer: string;
  published_benchmark_metrics: PublishedMetricsBenchmark;
}

export interface OverviewMetricsResponse {
  active_cases_count: int;
  shipments_traced_count: number;
  records_needing_review_count: number;
  gaps_open_count: number;
  finished_lots_count: number;
  quarantined_finished_lots_count: number;
  available_finished_lots_count: number;
  current_case?: CaseSummary | null;
  recent_decisions_count: number;
}

export type int = number;

export interface RelationshipInfo {
  relationship_type: string;
  connected_node_id: string;
  connected_node_label: string;
  direction: 'INCOMING' | 'OUTGOING';
}

export interface NodeInspectorResponse {
  node_id: string;
  primary_label: string;
  display_name: string;
  properties: Record<string, any>;
  incoming_relationships: RelationshipInfo[];
  outgoing_relationships: RelationshipInfo[];
  traceability_status?: string | null;
  disposition?: string | null;
  is_gap_detected: boolean;
  why_included?: string | null;
}

export interface VisNode {
  id: string;
  label: string;
  display_name: string;
  stage?: number | null;
  stage_name: string;
  traceability_status?: string | null;
  disposition?: string | null;
  is_affected: boolean;
  is_gap: boolean;
  details: Record<string, any>;
}

export interface VisEdge {
  source: string;
  target: string;
  type: string;
  is_affected_path: boolean;
  is_missing_link: boolean;
}

export interface GraphVisResponse {
  root_lot_code?: string | null;
  total_nodes: number;
  total_edges: number;
  nodes: VisNode[];
  edges: VisEdge[];
  stages_legend: Record<number, string>;
}

export interface TraceGapsResponse {
  gap_detected_finished_lots: Array<Record<string, any>>;
  gap_detected_shipments: Array<Record<string, any>>;
  total_gaps_found: number;
  review_tasks: Array<Record<string, any>>;
}

export interface ActionAuditEntry {
  actor: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface ActionItem {
  action_id: string;
  action_type: string;
  status: string;
  target_id: string;
  target_entity: string;
  evidence_references: string[];
  title: string;
  instructions: string;
  carrier?: string | null;
  recipient_email?: string | null;
  initiator?: string;
  path_classification?: string;
  origin_facility?: string | null;
  origin_facility_id?: string | null;
  source_contaminant?: string | null;
  target_facility?: string | null;
  current_state?: string[];
  simulation_impact?: string[];
  audit_trail?: ActionAuditEntry[];
  authorized_by?: string | null;
  rationale?: string | null;
  updated_at?: string | null;
}

export interface ActionPlanResponse {
  case_id: string;
  suspect_raw_lot: string;
  evidence_cited: Array<Record<string, any>>;
  proposed_actions: ActionItem[];
  total_actions: number;
  requires_authorization: boolean;
  authorized: boolean;
  generated_at?: string | null;
  simulation_note?: string;
}

export interface ExecuteActionPlanResponse {
  decision_id: string;
  authorized_by: string;
  authorized_at: string;
  executed_actions: Array<Record<string, any>>;
  total_executed: number;
  status: string;
  simulation_note: string;
}

export interface UpdateActionStatusRequest {
  action_id: string;
  new_status: string;
  actor: string;
  rationale: string;
  supporting_evidence_ids?: string[];
}

export interface UpdateActionStatusResponse {
  action_id: string;
  previous_status: string;
  status: string;
  actor: string;
  rationale: string;
  updated_at: string;
  audit_event_id: string;
  message: string;
}

export interface ExportActionPlanResponse {
  plan_id: string;
  raw_lot_code: string;
  export_format: string;
  generated_at_utc: string;
  content: string;
  structured_plan: Record<string, any>;
  simulation_disclaimer: string;
}

export interface SearchMatch {
  entity_type: string;
  entity_id: string;
  display_name: string;
  traceability_status?: string | null;
  disposition?: string | null;
}

export interface SearchResponse {
  query: string;
  total_matches: number;
  matches: SearchMatch[];
}

export interface InstitutionalFact {
  memory_id: string;
  fact_type: string;
  content: string;
  source_reference?: string | null;
  verified_at?: string | null;
}

export interface AgentMemoryResponse {
  facts: InstitutionalFact[];
  handovers: Array<Record<string, any>>;
  total_facts: number;
  connected_entity_summary: {
    suppliers_count: number;
    finished_lots_count: number;
    shipments_count: number;
    locations_count: number;
  };
  status: string;
  note?: string | null;
}

export interface DownstreamTraceResponse {
  suspect_raw_lot: string;
  evidence: Array<Record<string, any>>;
  affected_finished_lots: Array<Record<string, any>>;
  affected_shipments: Array<Record<string, any>>;
  trace_paths: Array<Record<string, any>>;
  total_affected_finished_lots: number;
  total_affected_shipments: number;
}

export interface CTERecord {
  tlc: string;
  event_type: string;
  event_id: string;
  date_time_utc: string;
  facility_id?: string | null;
  facility_name?: string | null;
  gln?: string | null;
  product_or_ingredient?: string | null;
  quantity_or_units?: string | null;
  input_tlcs: string[];
  output_tlcs: string[];
  traceability_status?: string | null;
  physical_disposition?: string | null;
  regulatory_notice: string;
}

export interface CTERecordsResponse {
  total_records: number;
  records: CTERecord[];
  is_synthetic: boolean;
  generated_at_utc: string;
}

export interface AuditEvent {
  event_id: string;
  timestamp?: string;
  timestamp_utc?: string;
  action_type: string;
  actor: string;
  outcome: string;
  is_simulation: boolean;
  entity_id?: string | null;
  entity_type?: string | null;
  details: any;
}

export interface AuditTimelineResponse {
  total_events: number;
  events: AuditEvent[];
}

export interface EvidenceUploadResponse {
  document_id: string;
  filename: string;
  file_size_bytes: number;
  lot_code: string;
  mime_type: string;
  status: string;
  uploaded_at_utc: string;
  verification_status: string;
  download_url: string;
  message: string;
}

export interface EvidenceRequestCreate {
  target_lot: string;
  supplier_name?: string | null;
  evidence_type?: string;
  instructions?: string | null;
}

export interface EvidenceRequestResponse {
  request_id: string;
  status: string;
  target_lot: string;
  supplier_name: string;
  evidence_type: string;
  requested_at_utc: string;
  is_simulation: boolean;
  disclaimer: string;
}

export interface CreateCaseRequest {
  title: string;
  hazard_type: string;
  pathogen_or_hazard?: string | null;
  hazard_description?: string | null;
  suspect_raw_lot?: string | null;
  description?: string | null;
  provisional_class?: string | null;
  source_facility?: string | null;
  dataset_id?: string | null;
}

export interface CreateCaseResponse {
  case_id: string;
  title: string;
  created_at_utc: string;
  lifecycle_status: string;
  suspect_raw_lot?: string | null;
  message: string;
}

export interface DatasetSummary {
  dataset_id: string;
  name: string;
  description?: string | null;
  facility_id?: string | null;
  suspect_root_lot?: string | null;
  ingested_at?: string | null;
  is_demo: boolean;
  counts: Record<string, number>;
}

export interface DatasetImportRequest {
  dataset_json?: Record<string, any> | null;
  csv_text?: string | null;
  dataset_id?: string | null;
  dataset_name?: string | null;
  facility_id?: string | null;
  suspect_root_lot?: string | null;
  is_demo?: boolean;
}

export interface DatasetImportResponse {
  dataset_id: string;
  name: string;
  is_demo: boolean;
  counts: Record<string, number>;
  suspect_root_lot?: string | null;
  status: string;
  message: string;
}

