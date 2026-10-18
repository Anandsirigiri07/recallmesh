/**
 * Typed API Client for RECALLMESH Backend
 * Connects to FastAPI local service with configurable VITE_API_BASE_URL.
 */

import type {
  HealthResponse,
  OverviewMetricsResponse,
  TraceGapsResponse,
  ActionPlanResponse,
  ExecuteActionPlanResponse,
  UpdateActionStatusRequest,
  UpdateActionStatusResponse,
  ExportActionPlanResponse,
  NodeInspectorResponse,
  SearchResponse,
  GraphVisResponse,
  DownstreamTraceResponse,
  CTERecordsResponse,
  AuditTimelineResponse,
  EvidenceUploadResponse,
  EvidenceRequestResponse,
  CreateCaseRequest,
  CreateCaseResponse,
  CaseSummary,
  PredictRiskRequest,
  PredictRiskResponse,
  DatasetSummary,
  DatasetImportRequest,
  DatasetImportResponse,
} from '../types/api';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || (import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: await response.text() };
        }
        const message = errorData?.detail || `API request failed with status ${response.status}`;
        throw new ApiError(response.status, message, errorData);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(0, `Network error connecting to API: ${err.message || 'Server unreachable'}`);
    }
  }

  /**
   * Health status of API and local FalkorDB
   */
  async getHealth(): Promise<HealthResponse> {
    return this.fetchJson<HealthResponse>('/api/health');
  }

  /**
   * Overview dashboard metrics derived from FalkorDB graph state
   */
  /**
   * Overview dashboard metrics derived from FalkorDB graph state
   */
  async getOverviewMetrics(datasetId?: string): Promise<OverviewMetricsResponse> {
    const qs = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return this.fetchJson<OverviewMetricsResponse>(`/api/overview/metrics${qs}`);
  }

  /**
   * Detected traceability gaps and orphan lots (FSMA 204 violations)
   */
  async getTraceGaps(datasetId?: string): Promise<TraceGapsResponse> {
    const qs = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return this.fetchJson<TraceGapsResponse>(`/api/trace/gaps${qs}`);
  }

  /**
   * Proposed containment action plan for a suspect lot
   */
  async getActionPlan(rootLotId?: string, datasetId?: string): Promise<ActionPlanResponse> {
    const params = new URLSearchParams();
    if (rootLotId) params.append('raw_lot_code', rootLotId);
    if (datasetId) params.append('dataset_id', datasetId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<ActionPlanResponse>(`/api/actions/plan${qs}`);
  }

  /**
   * Update status of an action item with human governance signature and rationale
   */
  async updateActionItemStatus(request: UpdateActionStatusRequest): Promise<UpdateActionStatusResponse> {
    return this.fetchJson<UpdateActionStatusResponse>('/api/actions/item/status', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Export formal FSMA 204 containment action plan dossier in markdown and JSON
   */
  async exportActionPlan(rootLotId?: string, datasetId?: string): Promise<ExportActionPlanResponse> {
    const params = new URLSearchParams();
    if (rootLotId) params.append('raw_lot_code', rootLotId);
    if (datasetId) params.append('dataset_id', datasetId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<ExportActionPlanResponse>(`/api/actions/export${qs}`);
  }

  /**
   * Execute action plan (simulated dry-run gated by governance)
   */
  async executeActionPlan(actionPlan: any, authorizedBy: string, rationale: string = 'Authorized QA Director containment signoff'): Promise<ExecuteActionPlanResponse> {
    return this.fetchJson<ExecuteActionPlanResponse>('/api/actions/execute', {
      method: 'POST',
      body: JSON.stringify({
        action_plan: actionPlan,
        authorized_by: authorizedBy,
        rationale: rationale,
      }),
    });
  }

  /**
   * Full inspector properties and incoming/outgoing relationships for a specific node
   */
  async getNodeInspector(nodeId: string, datasetId?: string): Promise<NodeInspectorResponse> {
    const qs = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return this.fetchJson<NodeInspectorResponse>(`/api/nodes/${encodeURIComponent(nodeId)}/inspector${qs}`);
  }

  /**
   * 6-stage deterministic visualization nodes and edges
   */
  async getGraphVis(rootLotId?: string, datasetId?: string): Promise<GraphVisResponse> {
    const params = new URLSearchParams();
    if (rootLotId) params.append('root_lot_id', rootLotId);
    if (datasetId) params.append('dataset_id', datasetId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<GraphVisResponse>(`/api/trace/graph-vis${qs}`);
  }

  /**
   * Downstream blast radius trace for suspect raw lot
   */
  async getDownstreamTrace(lotId?: string, datasetId?: string): Promise<DownstreamTraceResponse> {
    const params = new URLSearchParams();
    if (lotId) params.append('lot_id', lotId);
    if (datasetId) params.append('dataset_id', datasetId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<DownstreamTraceResponse>(`/api/trace/downstream${qs}`);
  }

  /**
   * Parameterized search across lots, shipments, facilities, and suppliers
   */
  async search(query: string, datasetId?: string): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (datasetId) params.append('dataset_id', datasetId);
    return this.fetchJson<SearchResponse>(`/api/search?${params.toString()}`);
  }

  /**
   * Live Critical Tracking Events from FalkorDB graph state
   */
  async getCteRecords(rawLotCode?: string): Promise<CTERecordsResponse> {
    const query = rawLotCode ? `?raw_lot_code=${encodeURIComponent(rawLotCode)}` : '';
    return this.fetchJson<CTERecordsResponse>(`/api/cte/records${query}`);
  }

  /**
   * Persisted audit timeline of genuine local operations
   */
  async getAuditTimeline(limit: number = 20): Promise<AuditTimelineResponse> {
    return this.fetchJson<AuditTimelineResponse>(`/api/audit/timeline?limit=${limit}`);
  }

  /**
   * Safe local file upload for certificates/evidence
   */
  async uploadEvidence(file: File, lotCode: string, documentType: string = 'CERTIFICATE_OF_ANALYSIS'): Promise<EvidenceUploadResponse> {
    const url = `${this.baseUrl}/api/evidence/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lot_code', lotCode);
    formData.append('document_type', documentType);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: await response.text() };
      }
      throw new ApiError(response.status, errorData?.detail || `Upload failed with status ${response.status}`, errorData);
    }

    return (await response.json()) as EvidenceUploadResponse;
  }

  /**
   * Simulated supplier evidence request
   */
  async requestSupplierEvidence(targetLot: string, supplierName?: string, instructions?: string): Promise<EvidenceRequestResponse> {
    return this.fetchJson<EvidenceRequestResponse>('/api/evidence/request', {
      method: 'POST',
      body: JSON.stringify({
        target_lot: targetLot,
        supplier_name: supplierName || 'PRIMAVERA_ORGANICS_LTD',
        evidence_type: 'CERTIFICATE_OF_ANALYSIS',
        instructions: instructions || 'Request urgent microbiological CoA confirmation',
      }),
    });
  }

  /**
   * Retrieve a previously created simulated supplier evidence request
   */
  async getSupplierRequest(requestId: string): Promise<EvidenceRequestResponse> {
    return this.fetchJson<EvidenceRequestResponse>(`/api/evidence/requests/${encodeURIComponent(requestId)}`);
  }

  /**
   * List all simulated supplier evidence requests
   */
  async listSupplierRequests(limit: number = 50): Promise<EvidenceRequestResponse[]> {
    return this.fetchJson<EvidenceRequestResponse[]>(`/api/evidence/requests?limit=${limit}`);
  }


  /**
   * Create a new investigation case persisted in FalkorDB
   */
  async createCase(payload: CreateCaseRequest): Promise<CreateCaseResponse> {
    return this.fetchJson<CreateCaseResponse>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * List existing investigation cases
   */
  async listCases(datasetId?: string): Promise<CaseSummary[]> {
    const qs = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    return this.fetchJson<CaseSummary[]>(`/api/cases${qs}`);
  }

  /**
   * Get details of a single investigation case docket
   */
  async getCase(caseId: string): Promise<CaseSummary> {
    return this.fetchJson<CaseSummary>(`/api/cases/${encodeURIComponent(caseId)}`);
  }

  /**
   * List all available datasets (synthetic demo + imported supply chains)
   */
  async listDatasets(): Promise<DatasetSummary[]> {
    return this.fetchJson<DatasetSummary[]>('/api/datasets');
  }

  /**
   * Import supply chain dataset via validated FSMA 204 JSON or CTE CSV
   */
  async importDataset(payload: DatasetImportRequest): Promise<DatasetImportResponse> {
    return this.fetchJson<DatasetImportResponse>('/api/datasets/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Download or fetch reference schema template ('json' or 'csv')
   */
  async getDatasetTemplate(format: 'json' | 'csv' = 'json'): Promise<any> {
    const url = `${this.baseUrl}/api/datasets/template?format=${format}`;
    const response = await fetch(url, { headers: { 'Accept': format === 'json' ? 'application/json' : 'text/csv' } });
    if (!response.ok) {
      throw new ApiError(response.status, `Failed to load ${format} template`);
    }
    return format === 'json' ? await response.json() : await response.text();
  }

  /**
   * ML Advisory recall risk classification using offline model pipeline
   */
  async predictRisk(payload: PredictRiskRequest): Promise<PredictRiskResponse> {
    return this.fetchJson<PredictRiskResponse>('/api/ml/predict-risk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * URL for direct download of the FDA FSMA 204 Electronic Sortable Spreadsheet
   */
  getExportCsvUrl(): string {
    return `${this.baseUrl}/api/export/fsma-204-spreadsheet`;
  }

}

export const apiClient = new ApiClient();
