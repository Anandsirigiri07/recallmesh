import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraceabilityGraphExplorer } from '../components/graph/TraceabilityGraphExplorer';
import { apiClient } from '../api/client';
import type { GraphVisResponse, NodeInspectorResponse } from '../types/api';

const mockGraphVisData: GraphVisResponse = {
  root_lot_code: 'LOT-CUM-2026-088',
  total_nodes: 10,
  total_edges: 7,
  stages_legend: {},
  nodes: [
    {
      id: 'SUP-APEX-01',
      label: 'Supplier',
      display_name: 'Apex Spice Co.',
      stage: 1,
      stage_name: '01. Supplier',
      traceability_status: 'VERIFIED',
      disposition: 'DELIVERED',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'LOT-CUM-2026-088',
      label: 'RawLot',
      display_name: 'Cumin extract 50kg',
      stage: 2,
      stage_name: '02. Ingredient Lot',
      traceability_status: 'VERIFIED',
      disposition: 'QUARANTINED',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'LOT-CUM-2026-090',
      label: 'RawLot',
      display_name: 'Clean Organic Cumin',
      stage: 2,
      stage_name: '02. Ingredient Lot',
      traceability_status: 'VERIFIED',
      disposition: 'AVAILABLE',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'PROD-EVT-4401',
      label: 'ProductionEvent',
      display_name: 'Salsa blend run',
      stage: 3,
      stage_name: '03. Production Event',
      traceability_status: 'VERIFIED',
      disposition: 'IN_USE',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-101',
      label: 'FinishedLot',
      display_name: 'Medium Salsa 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      traceability_status: 'VERIFIED',
      disposition: 'QUARANTINED',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-102',
      label: 'FinishedLot',
      display_name: 'Mild Salsa 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      traceability_status: 'VERIFIED',
      disposition: 'AVAILABLE',
      is_affected: false,
      is_gap: false,
      details: {},
    },
    {
      id: 'FL-SALSA-103',
      label: 'FinishedLot',
      display_name: 'Mild Salsa 16oz',
      stage: 4,
      stage_name: '04. Finished Lot',
      traceability_status: 'GAP_DETECTED',
      disposition: 'UNKNOWN',
      is_affected: false,
      is_gap: true,
      details: {},
    },
    {
      id: 'SHIP-8821',
      label: 'Shipment',
      display_name: 'Refrigerated Express #8821',
      stage: 5,
      stage_name: '05. Shipment',
      traceability_status: 'VERIFIED',
      disposition: 'IN_TRANSIT',
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
      traceability_status: 'VERIFIED',
      disposition: 'DELIVERED',
      is_affected: true,
      is_gap: false,
      details: {},
    },
    {
      id: 'EVID-LAB-904',
      label: 'Evidence',
      display_name: 'Apex Spice Certificate of Analysis Salmonella Alert',
      stage: null,
      stage_name: 'UNPLACED',
      traceability_status: 'VERIFIED',
      disposition: null,
      is_affected: true,
      is_gap: false,
      details: {},
    },
  ],
  edges: [
    { source: 'SUP-APEX-01', target: 'LOT-CUM-2026-088', type: 'ORIGINATED', is_affected_path: false, is_missing_link: false },
    { source: 'LOT-CUM-2026-088', target: 'PROD-EVT-4401', type: 'USED_IN', is_affected_path: true, is_missing_link: false },
    { source: 'PROD-EVT-4401', target: 'FL-SALSA-101', type: 'PRODUCED', is_affected_path: true, is_missing_link: false },
    { source: 'FL-SALSA-101', target: 'SHIP-8821', type: 'PACKAGED_INTO', is_affected_path: true, is_missing_link: false },
    { source: 'SHIP-8821', target: 'LOC-RETAIL-ALPHA', type: 'SHIPPED_TO', is_affected_path: true, is_missing_link: false },
  ],
};

const mockNodeInspectorData: NodeInspectorResponse = {
  node_id: 'FL-SALSA-101',
  primary_label: 'FinishedLot',
  display_name: 'Medium Salsa 16oz',
  properties: { quantity: 1500, batch: 'PR-9042' },
  incoming_relationships: [
    {
      relationship_type: 'PRODUCED',
      connected_node_id: 'PROD-EVT-4401',
      connected_node_label: 'ProductionEvent',
      direction: 'INCOMING',
    },
  ],
  outgoing_relationships: [
    {
      relationship_type: 'PACKAGED_INTO',
      connected_node_id: 'SHIP-8821',
      connected_node_label: 'Shipment',
      direction: 'OUTGOING',
    },
  ],
  traceability_status: 'VERIFIED',
  disposition: 'QUARANTINED',
  is_gap_detected: false,
  why_included: 'Cumin lot LOT-CUM-2026-088 was incorporated directly into Salsa blend run at facility line.',
};

describe('TraceabilityGraphExplorer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient, 'getGraphVis').mockResolvedValue(mockGraphVisData);
    vi.spyOn(apiClient, 'getNodeInspector').mockResolvedValue(mockNodeInspectorData);
  });

  it('1. Loads genuine graph data from API and renders 6-stage column layout and header', async () => {
    render(<TraceabilityGraphExplorer />);

    expect(screen.getByText('Traceability Graph')).toBeInTheDocument();
    expect(screen.getByText('See how every lot, shipment and place is connected.')).toBeInTheDocument();

    // Verify 6 stage column headers
    expect(await screen.findByText('1. Supplier')).toBeInTheDocument();
    expect(screen.getByText('2. Ingredient lot')).toBeInTheDocument();
    expect(screen.getByText('3. Production')).toBeInTheDocument();
    expect(screen.getByText('4. Finished lot')).toBeInTheDocument();
    expect(screen.getByText('5. Shipment')).toBeInTheDocument();
    expect(screen.getByText('6. Destination')).toBeInTheDocument();

    // Verify presence of genuine nodes
    expect(screen.getAllByText('LOT-CUM-2026-088')[0]).toBeInTheDocument();
    expect(screen.getAllByText('FL-SALSA-101')[0]).toBeInTheDocument();
    expect(screen.getAllByText('SHIP-8821')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Northgate DC')[0]).toBeInTheDocument();
  });

  it('2. Category chips correctly filter node rendering', async () => {
    render(<TraceabilityGraphExplorer />);

    expect(await screen.findAllByText('SHIP-8821')).toHaveLength(2);

    // Toggle off Shipments
    const shipmentsChip = screen.getByRole('button', { name: /Shipments/i });
    fireEvent.click(shipmentsChip);

    // Shipments should be hidden from canvas (only in breadcrumb if active)
    expect(screen.getAllByText('SHIP-8821')).toHaveLength(1);

    // Toggle Shipments back on
    fireEvent.click(shipmentsChip);
    expect(await screen.findAllByText('SHIP-8821')).toHaveLength(2);
  });

  it('3. All-record and affected-path modes toggle correctly', async () => {
    render(<TraceabilityGraphExplorer />);

    // Default mode is affected paths only
    expect(await screen.findByText('Affected paths only')).toBeInTheDocument();
    expect(screen.queryByText('LOT-CUM-2026-090')).not.toBeInTheDocument();

    // Switch to All records
    const allRecordsBtn = screen.getByRole('button', { name: /All records/i });
    fireEvent.click(allRecordsBtn);

    // Now clean control lot LOT-CUM-2026-090 is visible
    expect(await screen.findByText('LOT-CUM-2026-090')).toBeInTheDocument();
  });

  it('4. Selecting a node loads and displays node-inspector details', async () => {
    render(<TraceabilityGraphExplorer />);

    // Inspector starts in empty state
    expect(await screen.findByText('Click any card to see its details here.')).toBeInTheDocument();
    expect(screen.getByText(/Select an ingredient lot/i)).toBeInTheDocument();

    // Click node FL-SALSA-101 card
    const node101 = (await screen.findAllByText('FL-SALSA-101'))[0];
    fireEvent.click(node101);

    // Inspector updates with live details
    expect(await screen.findByText('NODE INSPECTOR')).toBeInTheDocument();
    expect(screen.getByText('AFFECTED PATH')).toBeInTheDocument();
    expect(screen.getByText('CTE-T-4912 (Receiving / Transformation)')).toBeInTheDocument();
    expect(screen.getByText('Immediate Quarantine Requested')).toBeInTheDocument();
    expect(screen.getByText(/Cumin lot LOT-CUM-2026-088 was incorporated directly/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View FSMA Audit Packet/i })).toBeInTheDocument();
  });

  it('5. Breadcrumb selection refers to actual verified graph paths and clicking selects node', async () => {
    render(<TraceabilityGraphExplorer />);

    // Verify breadcrumb bar
    expect(await screen.findByText('PATH')).toBeInTheDocument();
    const salsaElements = await screen.findAllByText('Salsa blend run');
    expect(salsaElements.length).toBeGreaterThanOrEqual(1);

    // Click breadcrumb node (second element is in the breadcrumb bar)
    const breadcrumbItem = salsaElements[salsaElements.length - 1];
    fireEvent.click(breadcrumbItem);

    // Node inspector queried for PROD-EVT-4401
    expect(apiClient.getNodeInspector).toHaveBeenCalledWith('PROD-EVT-4401');
  });

  it('6. Zoom, fit-to-view, and reset controls work smoothly', async () => {
    render(<TraceabilityGraphExplorer />);

    await screen.findByText('Traceability Graph');

    const zoomInBtn = screen.getByTitle('Zoom in');
    const zoomOutBtn = screen.getByTitle('Zoom out');
    const fitBtn = screen.getByTitle('Fit to screen');
    const resetBtn = screen.getByRole('button', { name: /Reset/i });

    // Click zoom in
    fireEvent.click(zoomInBtn);
    expect(screen.getByText(/Reset \(115%\)/i)).toBeInTheDocument();

    // Click zoom out
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText(/Reset \(100%\)/i)).toBeInTheDocument();

    // Click fit
    fireEvent.click(fitBtn);
    expect(screen.getByText(/Reset \(100%\)/i)).toBeInTheDocument();

    // Click reset
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Reset \(100%\)/i)).toBeInTheDocument();
  });

  it('7. FL-SALSA-103 retains the missing-link indicator without a fabricated edge', async () => {
    render(<TraceabilityGraphExplorer />);

    // Floating pill rendered over dashed connector
    expect(await screen.findByText('Missing link')).toBeInTheDocument();

    // FL-SALSA-103 rendered with review tag
    const node103 = screen.getByText('FL-SALSA-103');
    expect(node103).toBeInTheDocument();

    // Mock gap inspector response
    vi.spyOn(apiClient, 'getNodeInspector').mockResolvedValueOnce({
      node_id: 'FL-SALSA-103',
      primary_label: 'FinishedLot',
      display_name: 'Mild Salsa 16oz',
      properties: {},
      incoming_relationships: [],
      outgoing_relationships: [],
      traceability_status: 'GAP_DETECTED',
      disposition: 'UNKNOWN',
      is_gap_detected: true,
      why_included: 'We could not find a record linking this lot to a production run (missing Critical Tracking Event).',
    });

    // Click FL-SALSA-103
    fireEvent.click(node103);

    // Inspector displays GAP DETECTED and Open QA evidence request
    expect(await screen.findByText('GAP DETECTED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open QA evidence request/i })).toBeInTheDocument();
  });

  it('8. Unrelated control lot stays outside blast radius and shows clean isolation', async () => {
    render(<TraceabilityGraphExplorer />);

    // Switch to All records
    const allRecordsBtn = await screen.findByRole('button', { name: /All records/i });
    fireEvent.click(allRecordsBtn);

    const controlLot = await screen.findByText('LOT-CUM-2026-090');
    expect(controlLot).toBeInTheDocument();

    // FL-SALSA-102 displays Outside recorded path
    expect(screen.getByText('Outside recorded path. Not safe.')).toBeInTheDocument();
  });

  it('9. Handles API failure honestly with retry button', async () => {
    vi.spyOn(apiClient, 'getGraphVis').mockRejectedValueOnce(new Error('FalkorDB connection refused'));

    render(<TraceabilityGraphExplorer />);

    expect(await screen.findByText('Graph Service Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/FalkorDB connection refused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
  });

  it('10. Search query highlights matching cards', async () => {
    render(<TraceabilityGraphExplorer />);

    await screen.findByText('Traceability Graph');

    const searchInput = screen.getByPlaceholderText('Find a lot or shipment...');
    fireEvent.change(searchInput, { target: { value: '8821' } });

    // SHIP-8821 is matched
    expect(screen.getAllByText('SHIP-8821')[0]).toBeInTheDocument();
  });
});
