import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvestigationWorkspace } from '../components/investigation/InvestigationWorkspace';
import { apiClient } from '../api/client';
import type { GraphVisResponse, NodeInspectorResponse, PredictRiskResponse } from '../types/api';

const mockGraphVisAffected: GraphVisResponse = {
  root_lot_code: 'LOT-CUM-2026-088',
  total_nodes: 7,
  total_edges: 6,
  stages_legend: {
    1: '01. Supplier',
    2: '02. Ing. Lot',
    3: '03. Production Event',
    4: '04. Finished Lot',
    5: '05. Shipment',
    6: '06. Destination',
  },
  nodes: [
    {
      id: 'SUP-APEX-01',
      label: 'Supplier',
      display_name: 'Apex Spice Co.',
      stage: 1,
      stage_name: '01. Supplier',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'LOT-CUM-2026-088',
      label: 'RawLot',
      display_name: 'LOT-CUM-2026-088',
      stage: 2,
      stage_name: '02. Ing. Lot',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'PROD-EVT-4401',
      label: 'ProductionEvent',
      display_name: 'Batch PR-9042',
      stage: 3,
      stage_name: '03. Production Event',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-101',
      label: 'FinishedLot',
      display_name: 'Artisan Roasted Salsa 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-103',
      label: 'FinishedLot',
      display_name: 'Hot Jalapeño 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      is_affected: false,
      is_gap: true,
      details: {},
    },
    {
      id: 'SHIP-8821',
      label: 'Shipment',
      display_name: 'Swift Cold Logistics',
      stage: 5,
      stage_name: '05. Shipment',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'LOC-RETAIL-ALPHA',
      label: 'Location',
      display_name: 'Northgate DC',
      stage: 6,
      stage_name: '06. Destination',
      is_affected: true,
      is_gap: false,
      details: {},
    },
  ],
  edges: [
    { source: 'SUP-APEX-01', target: 'LOT-CUM-2026-088', type: 'ORIGINATED', is_affected_path: false, is_missing_link: false },
    { source: 'LOT-CUM-2026-088', target: 'PROD-EVT-4401', type: 'CONSUMED_IN', is_affected_path: true, is_missing_link: false },
    { source: 'PROD-EVT-4401', target: 'FL-SALSA-101', type: 'PRODUCED', is_affected_path: true, is_missing_link: false },
    { source: 'FL-SALSA-101', target: 'SHIP-8821', type: 'PACKAGED_INTO', is_affected_path: true, is_missing_link: false },
    { source: 'SHIP-8821', target: 'LOC-RETAIL-ALPHA', type: 'SHIPPED_TO', is_affected_path: true, is_missing_link: false },
  ],
};

const mockGraphVisControl: GraphVisResponse = {
  root_lot_code: 'LOT-CUM-2026-090',
  total_nodes: 4,
  total_edges: 3,
  stages_legend: {
    1: '01. Supplier',
    2: '02. Ing. Lot',
    3: '03. Production Event',
    4: '04. Finished Lot',
    5: '05. Shipment',
    6: '06. Destination',
  },
  nodes: [
    {
      id: 'SUP-SUMMIT-02',
      label: 'Supplier',
      display_name: 'Summit Organics',
      stage: 1,
      stage_name: '01. Supplier',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'LOT-CUM-2026-090',
      label: 'RawLot',
      display_name: 'LOT-CUM-2026-090',
      stage: 2,
      stage_name: '02. Ing. Lot',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'PROD-EVT-4402',
      label: 'ProductionEvent',
      display_name: 'Batch PR-9043',
      stage: 3,
      stage_name: '03. Production Event',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-102',
      label: 'FinishedLot',
      display_name: 'Artisan Roasted Salsa 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      is_affected: false,
      is_gap: false,
      details: {},
    },
  ],
  edges: [
    { source: 'SUP-SUMMIT-02', target: 'LOT-CUM-2026-090', type: 'ORIGINATED', is_affected_path: false, is_missing_link: false },
    { source: 'LOT-CUM-2026-090', target: 'PROD-EVT-4402', type: 'CONSUMED_IN', is_affected_path: false, is_missing_link: false },
    { source: 'PROD-EVT-4402', target: 'FL-SALSA-102', type: 'PRODUCED', is_affected_path: false, is_missing_link: false },
  ],
};

const mockInspectorFL101: NodeInspectorResponse = {
  node_id: 'FL-SALSA-101',
  primary_label: 'FinishedLot',
  display_name: 'Artisan Roasted Salsa 16oz',
  properties: { lot_code: 'FL-SALSA-101', manifest_id: '4892' },
  incoming_relationships: [
    { relationship_type: 'PRODUCED', connected_node_id: 'PROD-EVT-4401', connected_node_label: 'ProductionEvent', direction: 'INCOMING' },
  ],
  outgoing_relationships: [
    { relationship_type: 'PACKAGED_INTO', connected_node_id: 'SHIP-8821', connected_node_label: 'Shipment', direction: 'OUTGOING' },
  ],
  traceability_status: 'AFFECTED',
  disposition: 'QUARANTINED',
  is_gap_detected: false,
  why_included: 'Cumin lot LOT-CUM-2026-088 was incorporated directly into Salsa blend run at facility line.',
};

const mockInspectorFL103: NodeInspectorResponse = {
  node_id: 'FL-SALSA-103',
  primary_label: 'FinishedLot',
  display_name: 'Hot Jalapeño 16oz',
  properties: { lot_code: 'FL-SALSA-103' },
  incoming_relationships: [],
  outgoing_relationships: [
    { relationship_type: 'PACKAGED_INTO', connected_node_id: 'SHIP-8824', connected_node_label: 'Shipment', direction: 'OUTGOING' },
  ],
  traceability_status: 'GAP_DETECTED',
  disposition: 'AVAILABLE',
  is_gap_detected: true,
  why_included: 'We could not find a record linking this lot to a production run (missing Critical Tracking Event).',
};

const mockMLPrediction: PredictRiskResponse = {
  model_type: 'improved_three_class',
  task_type: 'three_class_classification',
  predicted_class: 'Class I',
  confidence: 0.8733,
  class_probabilities: { 'Class I': 0.8733, 'Class II': 0.1245, 'Class III': 0.0023 },
  top_explanatory_features: ['cumin', 'salmonella', 'contamination'],
  status: 'PREDICTED_ADVISORY',
  disclaimer: 'NOTICE: Offline research classifier prediction only. This advisory output is not an authoritative recall determination, does not declare any product safe, and does not authorize quarantine without human QA review.',
  published_benchmark_metrics: {
    model_name: 'TF-IDF (1,2 ngrams) + Hazard Indicators (Improved)',
    evaluation_split: 'Past-to-future chronological test split',
    test_accuracy: 0.6655,
    note: 'Chronological test score with +4.87% Class I recall improvement.',
  },
};

describe('InvestigationWorkspace Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(apiClient, 'listCases').mockResolvedValue([
      {
        case_id: 'INV-2026-088',
        title: 'Cumin lot LOT-CUM-2026-088',
        opened_at: '2026-10-16T10:00:00Z',
        hazard_type: 'BIOLOGICAL',
        pathogen_or_hazard: 'Salmonella enterica',
        suspect_raw_lot: 'LOT-CUM-2026-088',
        provisional_class: 'Class I',
        lifecycle_status: 'ACTIVE_INVESTIGATION',
        lead_investigator: 'Dr. Elena Vance (QA Food Safety Lead)',
      },
    ]);

    vi.spyOn(apiClient, 'getGraphVis').mockImplementation(async (lotCode) => {
      if (lotCode === 'LOT-CUM-2026-090') {
        return mockGraphVisControl;
      }
      return mockGraphVisAffected;
    });

    vi.spyOn(apiClient, 'getNodeInspector').mockImplementation(async (nodeId) => {
      if (nodeId === 'FL-SALSA-103') {
        return mockInspectorFL103;
      }
      return mockInspectorFL101;
    });

    vi.spyOn(apiClient, 'predictRisk').mockResolvedValue(mockMLPrediction);
  });

  it('renders 3-column desktop investigation layout with active session header', async () => {
    render(<InvestigationWorkspace />);

    // Header context
    expect(await screen.findByText('Active CTE Session')).toBeInTheDocument();
    expect(screen.getAllByText('INV-2026-088').length).toBeGreaterThanOrEqual(1);

    // Column 1: Case Details & Legend
    expect(screen.getByText('Case Reference')).toBeInTheDocument();
    expect(screen.getByText('Cumin lot LOT-CUM-2026-088')).toBeInTheDocument();
    expect(screen.getByText('Path Legend')).toBeInTheDocument();

    // Column 2: 6-Stage Graph canvas headers
    expect(screen.getByText('01. Supplier')).toBeInTheDocument();
    expect(screen.getByText('02. Ing. Lot')).toBeInTheDocument();
    expect(screen.getByText('03. Production')).toBeInTheDocument();
    expect(screen.getByText('04. Finished Lot')).toBeInTheDocument();
    expect(screen.getByText('05. Shipment')).toBeInTheDocument();
    expect(screen.getByText('06. Destination')).toBeInTheDocument();

    // Column 3: Node Inspector
    expect(screen.getByText('Node Inspector')).toBeInTheDocument();
  });

  it('displays grounded ML prediction and distinguishes inference from benchmark', async () => {
    render(<InvestigationWorkspace />);

    // Individual lot prediction
    expect(await screen.findByText('Class I')).toBeInTheDocument();
    expect(screen.getByText('87.3%')).toBeInTheDocument();

    // Verbatim research disclaimer preserved
    expect(
      screen.getByText(/NOTICE: Offline research classifier prediction only/i)
    ).toBeInTheDocument();

    // Locked benchmark metric clearly separated (66.55% vs individual 87.3%)
    expect(screen.getByText(/66.55% accuracy/i)).toBeInTheDocument();
  });

  it('renders FL-SALSA-103 with missing-link indicator and QA evidence action', async () => {
    render(<InvestigationWorkspace />);

    // Floating Missing link badge on graph
    expect(await screen.findByText(/Missing link indicator/i)).toBeInTheDocument();

    // Click FL-SALSA-103 node to inspect
    const fl103Node = screen.getByText('FL-SALSA-103');
    fireEvent.click(fl103Node);

    // Inspector should update to FL-SALSA-103
    expect(await screen.findByText(/Gap detected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We could not find a record linking this lot to a production run/i)
    ).toBeInTheDocument();

    // Action button: Open QA evidence request
    expect(screen.getByRole('button', { name: /Open QA evidence request/i })).toBeInTheDocument();
  });

  it('verifies control lot LOT-CUM-2026-090 remains outside affected blast radius', async () => {
    render(<InvestigationWorkspace />);

    await screen.findByText('Active CTE Session');

    // Click "Control Lot (090)" switcher
    const controlBtn = screen.getByRole('button', { name: /Control Lot \(090\)/i });
    fireEvent.click(controlBtn);

    // Should re-query graph for LOT-CUM-2026-090
    await waitFor(() => {
      expect(apiClient.getGraphVis).toHaveBeenCalledWith('LOT-CUM-2026-090');
    });

    // Control lot details rendered
    expect(await screen.findByText(/Clean Control Lot LOT-CUM-2026-090/i)).toBeInTheDocument();
    expect(screen.getByText('0 Affected Centers (Isolated)')).toBeInTheDocument();
  });

  it('opens QA evidence request modal and submits simulated inquiry', async () => {
    vi.spyOn(apiClient, 'requestSupplierEvidence').mockResolvedValue({
      request_id: 'REQ-SUP-TEST-999',
      target_lot: 'FL-SALSA-103',
      supplier_name: 'Sunrise Spice Co. (Supplier TX-4)',
      evidence_type: 'Certificate of Analysis (CoA)',
      requested_at_utc: new Date().toISOString(),
      status: 'SIMULATED_REQUEST_CREATED',
      is_simulation: true,
      disclaimer: 'Simulation only. Recorded in local FalkorDB property graph; no real-world external email was sent.',
    });

    render(<InvestigationWorkspace />);

    // Select FL-SALSA-103
    const fl103Node = await screen.findByText('FL-SALSA-103');
    fireEvent.click(fl103Node);

    // Click Open QA evidence request
    const openBtn = await screen.findByRole('button', { name: /Open QA evidence request/i });
    fireEvent.click(openBtn);

    // Modal opens
    expect(screen.getByText('Simulate Supplier Evidence Request')).toBeInTheDocument();
    expect(screen.getByText(/Simulation Notice:/i)).toBeInTheDocument();

    // Submit inquiry
    const submitBtn = screen.getByRole('button', { name: /Simulate Request/i });
    fireEvent.click(submitBtn);

    // Success notice displayed
    expect(
      await screen.findByText(/Simulated evidence request REQ-SUP-TEST-999 recorded in FalkorDB/i)
    ).toBeInTheDocument();
  });

  it('handles offline ML prediction error cleanly without fabricating probabilities', async () => {
    vi.spyOn(apiClient, 'predictRisk').mockRejectedValue(new Error('Model weights missing'));

    render(<InvestigationWorkspace />);

    expect(await screen.findByText(/Offline Inference Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Model weights missing/i)).toBeInTheDocument();
  });
});
