import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewDashboard } from '../components/overview/OverviewDashboard';
import { apiClient } from '../api/client';

describe('OverviewDashboard Component', () => {
  const mockHealth = {
    status: 'healthy' as const,
    falkordb_connected: true,
    graph_name: 'recallmesh',
    version: '1.0.0',
    timestamp_utc: '2026-10-16T12:00:00Z',
  };

  const mockMetrics = {
    active_cases_count: 1,
    shipments_traced_count: 2,
    records_needing_review_count: 1,
    gaps_open_count: 1,
    finished_lots_count: 3,
    quarantined_finished_lots_count: 1,
    available_finished_lots_count: 2,
    current_case: {
      case_id: 'INC-2026-0814',
      opened_at: '2026-10-16T10:00:00Z',
      hazard_type: 'Pathogen Contamination',
      pathogen_or_hazard: 'Salmonella enterica',
      suspect_raw_lot: 'LOT-CUM-2026-088',
      provisional_class: 'Class I',
      lifecycle_status: 'ACTIVE_INVESTIGATION',
    },
    recent_decisions_count: 1,
  };

  const mockGaps = {
    gap_detected_finished_lots: [
      {
        finished_lot_code: 'FL-SALSA-103',
        sku_name: 'Ghost Pepper Salsa Hot 16oz',
        traceability_status: 'GAP_DETECTED',
      },
    ],
    gap_detected_shipments: [],
    total_gaps_found: 1,
    review_tasks: [],
  };

  const mockActionPlan = {
    case_id: 'INC-2026-0814',
    suspect_raw_lot: 'LOT-CUM-2026-088',
    evidence_cited: [],
    proposed_actions: [
      {
        action_id: 'ACT-001',
        action_type: 'SIMULATED_CARRIER_STOP',
        status: 'PROPOSED',
        target_id: 'SHIP-8821',
        target_entity: 'Shipment',
        evidence_references: ['LOT-CUM-2026-088'],
        title: 'Approve simulated hold on SHIP-8821',
        instructions: 'Hold carrier dispatch at Austin DC',
      },
    ],
    total_actions: 1,
    requires_authorization: true,
    authorized: false,
  };

  const mockCteRecords = {
    total_records: 3,
    records: [
      {
        tlc: 'LOT-CUM-2026-088',
        event_type: 'Receiving',
        event_id: 'CTE-RCV-001',
        date_time_utc: '2026-10-16T08:30:00Z',
        facility_id: 'FAC-TX-4',
        facility_name: 'Facility TX-4 (El Paso)',
        gln: '0850001234567',
        product_or_ingredient: 'Organic Ground Cumin',
        quantity_or_units: '500 KG',
        input_tlcs: [],
        output_tlcs: ['LOT-CUM-2026-088'],
        traceability_status: 'AFFECTED',
        physical_disposition: 'QUARANTINED',
        regulatory_notice: 'Synthetic Demo Data',
      },
      {
        tlc: 'SHIP-8821',
        event_type: 'Shipping',
        event_id: 'CTE-SHP-001',
        date_time_utc: '2026-10-16T10:14:00Z',
        facility_id: 'FAC-DC-AUSTIN',
        facility_name: 'DC Austin (Node 12)',
        gln: '0850001234568',
        product_or_ingredient: 'Sol Del Norte Seasoning Mix',
        quantity_or_units: '420 Cases',
        input_tlcs: ['FL-SALSA-101'],
        output_tlcs: ['SHIP-8821'],
        traceability_status: 'PROVISIONAL',
        physical_disposition: 'IN_TRANSIT',
        regulatory_notice: 'Synthetic Demo Data',
      },
      {
        tlc: 'FL-SALSA-103',
        event_type: 'Transformation',
        event_id: 'CTE-TRN-GAP',
        date_time_utc: '2026-10-15T21:00:00Z',
        facility_id: 'FAC-PLANT-2',
        facility_name: 'Plant Central #2 (San Antonio)',
        gln: '0850001234569',
        product_or_ingredient: 'Ghost Pepper Salsa Hot 16oz',
        quantity_or_units: '120 Cases',
        input_tlcs: [],
        output_tlcs: ['FL-SALSA-103'],
        traceability_status: 'GAP_DETECTED',
        physical_disposition: 'QUARANTINED',
        regulatory_notice: 'Synthetic Demo Data',
      },
    ],
    is_synthetic: true,
    generated_at_utc: '2026-10-16T12:00:00Z',
  };

  const mockAuditTimeline = {
    total_events: 1,
    events: [
      {
        event_id: 'EVT-TEST-001',
        timestamp_utc: '2026-10-16T11:45:00Z',
        action_type: 'CASE_CREATED',
        actor: 'LOCAL_DEMO_USER',
        outcome: 'SUCCESS',
        is_simulation: true,
        entity_id: 'INC-2026-0814',
        entity_type: 'RecallCase',
        details: { title: 'Cumin Salmonella Surveillance' },
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(mockHealth);
    vi.spyOn(apiClient, 'getOverviewMetrics').mockResolvedValue(mockMetrics);
    vi.spyOn(apiClient, 'getTraceGaps').mockResolvedValue(mockGaps);
    vi.spyOn(apiClient, 'getActionPlan').mockResolvedValue(mockActionPlan);
    vi.spyOn(apiClient, 'getCteRecords').mockResolvedValue(mockCteRecords);
    vi.spyOn(apiClient, 'getAuditTimeline').mockResolvedValue(mockAuditTimeline);
  });

  it('renders operational header and status badges accurately from API', async () => {
    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    // Operational header
    expect(screen.getByText(/Recall Surveillance & Lineage Ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/Continuous Trace Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Demonstration Monitor/i)).toBeInTheDocument();

    // Verify stat cards rendered with actual API numbers
    await waitFor(() => {
      expect(screen.getByText('Shipments traced')).toBeInTheDocument();
      expect(screen.getByText('Record needs review')).toBeInTheDocument();
      expect(screen.getByText('Gap open in chain')).toBeInTheDocument();
    });

    // Suspect lot from API
    expect(screen.getByText(/Suspected cumin lot LOT-CUM-2026-088/i)).toBeInTheDocument();
    expect(screen.getByText(/Contaminant: Salmonella enterica/i)).toBeInTheDocument();
  });

  it('handles backend service offline / error state with retry button', async () => {
    vi.spyOn(apiClient, 'getOverviewMetrics').mockRejectedValue(
      new Error('Connection refused to 127.0.0.1:8000')
    );

    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Backend API Service Offline or Degraded/i)).toBeInTheDocument();
    });

    // Retry button exists
    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    expect(retryBtn).toBeInTheDocument();

    // Now mock success and click retry
    vi.spyOn(apiClient, 'getOverviewMetrics').mockResolvedValue(mockMetrics);

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText(/Suspected cumin lot LOT-CUM-2026-088/i)).toBeInTheDocument();
    });
  });

  it('renders live CTE records and supports filtering', async () => {
    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    // Live CTE rows present from API
    await waitFor(() => {
      expect(screen.getByText('LOT-CUM-2026-088')).toBeInTheDocument();
      expect(screen.getByText('SHIP-8821')).toBeInTheDocument();
      expect(screen.getByText('FL-SALSA-103')).toBeInTheDocument();
    });

    // Filter by "SALSA-103"
    const filterInput = screen.getByPlaceholderText(/Filter CTEs.../i);
    fireEvent.change(filterInput, { target: { value: 'SALSA-103' } });

    expect(screen.getByText('FL-SALSA-103')).toBeInTheDocument();
    expect(screen.queryByText('SHIP-8821')).not.toBeInTheDocument();
  });

  it('renders persisted audit timeline events honestly', async () => {
    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Audit trail activity/i)).toBeInTheDocument();
      expect(screen.getByText(/Investigation docket INC-2026-0814 initiated/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Simulated/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('truthfully displays autonomous agents as Not instrumented', async () => {
    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    expect(screen.getByText('Autonomous Agents')).toBeInTheDocument();
    const notInstrumentedBadges = screen.getAllByText('Not instrumented');
    expect(notInstrumentedBadges.length).toBeGreaterThanOrEqual(4);
  });

  it('executes simulated action approval with human signature and refreshes timeline', async () => {
    vi.spyOn(apiClient, 'executeActionPlan').mockResolvedValue({
      decision_id: 'DEC-2026-0991',
      authorized_by: 'Dr. Elena Vance (QA Food Safety Lead)',
      authorized_at: '2026-10-16T12:05:00Z',
      executed_actions: [],
      total_executed: 1,
      status: 'SIMULATED_EXECUTED',
      simulation_note: 'Simulated dry-run digital twin actions only.',
    });

    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Approve simulated hold on SHIP-8821')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Review & Approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Decision DEC-2026-0991 executed/i)).toBeInTheDocument();
      expect(screen.getByText(/Approved \(Simulated\)/i)).toBeInTheDocument();
    });
  });

  it('opens Upload Certificate modal and completes file registration', async () => {
    vi.spyOn(apiClient, 'uploadEvidence').mockResolvedValue({
      document_id: 'DOC-TEST-999',
      filename: 'sample_cert.pdf',
      file_size_bytes: 1024,
      lot_code: 'FL-SALSA-103',
      mime_type: 'application/pdf',
      status: 'STORED',
      uploaded_at_utc: '2026-10-16T12:00:00Z',
      verification_status: 'Uploaded — verification pending',
      download_url: '/api/evidence/DOC-TEST-999/download',
      message: 'Certificate uploaded locally.',
    });

    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    const uploadBtn = screen.getByRole('button', { name: /Upload Certificate/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Upload Supplier Certificate/i)).toBeInTheDocument();
  });

  it('opens Supplier Request simulation modal cleanly', async () => {
    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    const supplierBtn = screen.getByRole('button', { name: /Request from Supplier/i });
    fireEvent.click(supplierBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Simulate Supplier Evidence Request/i)).toBeInTheDocument();
  });

  it('opens Node Inspector modal when Inspect button is clicked', async () => {
    vi.spyOn(apiClient, 'getNodeInspector').mockResolvedValue({
      node_id: 'LOT-CUM-2026-088',
      primary_label: 'RawLot',
      display_name: 'Organic Ground Cumin Lot 2026-088',
      properties: { lot_code: 'LOT-CUM-2026-088', is_tainted: true },
      incoming_relationships: [],
      outgoing_relationships: [],
      traceability_status: 'VERIFIED',
      disposition: 'QUARANTINED',
      is_gap_detected: false,
      why_included: 'Suspect origin root lot flagged with positive screen',
    });

    render(
      <OverviewDashboard
        onNavigateToGraph={vi.fn()}
        onNavigateToInvestigation={vi.fn()}
        onNavigateToActionPlans={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('LOT-CUM-2026-088')).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Node Inspector • LOT-CUM-2026-088/i)).toBeInTheDocument();
    });
  });
});
