import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { apiClient } from '../api/client';

describe('AppShell Component and Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue({
      status: 'healthy',
      falkordb_connected: true,
      graph_name: 'recallmesh',
      version: '1.0.0',
      timestamp_utc: '2026-10-16T12:00:00Z',
    });
    vi.spyOn(apiClient, 'getOverviewMetrics').mockResolvedValue({
      active_cases_count: 1,
      shipments_traced_count: 2,
      records_needing_review_count: 1,
      gaps_open_count: 1,
      finished_lots_count: 3,
      quarantined_finished_lots_count: 1,
      available_finished_lots_count: 2,
      current_case: null,
      recent_decisions_count: 0,
    });
    vi.spyOn(apiClient, 'getTraceGaps').mockResolvedValue({
      gap_detected_finished_lots: [],
      gap_detected_shipments: [],
      total_gaps_found: 0,
      review_tasks: [],
    });
    vi.spyOn(apiClient, 'getActionPlan').mockResolvedValue(null as any);
    vi.spyOn(apiClient, 'getCteRecords').mockResolvedValue({
      total_records: 2,
      records: [
        {
          tlc: 'LOT-CUM-2026-088',
          event_type: 'Receiving',
          event_id: 'CTE-RCV-001',
          date_time_utc: '2026-10-16T08:30:00Z',
          facility_id: 'FAC-TX-4',
          facility_name: 'Facility TX-4 (El Paso)',
          input_tlcs: [],
          output_tlcs: ['LOT-CUM-2026-088'],
          traceability_status: 'AFFECTED',
          physical_disposition: 'QUARANTINED',
          regulatory_notice: 'Synthetic Demo Data',
        },
      ],
      is_synthetic: true,
      generated_at_utc: '2026-10-16T12:00:00Z',
    });
    vi.spyOn(apiClient, 'getAuditTimeline').mockResolvedValue({
      total_events: 0,
      events: [],
    });
    vi.spyOn(apiClient, 'getGraphVis').mockResolvedValue({
      root_lot_code: 'LOT-CUM-2026-088',
      total_nodes: 0,
      total_edges: 0,
      nodes: [],
      edges: [],
      stages_legend: {},
    });
    vi.spyOn(apiClient, 'listCases').mockResolvedValue([]);
    vi.spyOn(apiClient, 'predictRisk').mockResolvedValue({
      model_type: 'improved_three_class',
      task_type: 'three_class_classification',
      predicted_class: 'Class I',
      confidence: 0.85,
      status: 'PREDICTED_ADVISORY',
      disclaimer: 'Advisory prediction',
      published_benchmark_metrics: {
        model_name: 'TF-IDF',
        evaluation_split: 'Chronological',
        test_accuracy: 0.6655,
        note: 'Benchmark',
      },
    });
  });

  it('renders application brand, truthful demo badge, and default Overview tab', () => {
    render(<AppShell />);

    // Brand title in sidebar
    expect(screen.getByText('RECALLMESH')).toBeInTheDocument();

    // Truthful Synthetic Traceability Demo badge (no false FDA verification claim)
    expect(screen.getByText('Synthetic Demo')).toBeInTheDocument();
    expect(screen.getByText('Not FDA Certified')).toBeInTheDocument();

    // Default Overview screen content
    expect(screen.getByText(/Recall Surveillance & Lineage Ledger/i)).toBeInTheDocument();
  });

  it('navigates cleanly to Investigation Workspace and placeholder screens', async () => {
    render(<AppShell />);

    // Navigate to Investigations
    const invTab = screen.getByRole('button', { name: /Investigations/i });
    fireEvent.click(invTab);

    // Active Investigation Workspace rendered
    expect(await screen.findByText('Active CTE Session')).toBeInTheDocument();
    expect(screen.getByText('Case Reference')).toBeInTheDocument();

    // Navigate to Traceability Graph explorer
    const graphTab = screen.getByRole('button', { name: /Traceability Graph/i });
    fireEvent.click(graphTab);
    expect(await screen.findByText(/See how every lot, shipment and place is connected/i)).toBeInTheDocument();
    expect(screen.getByText('Affected paths only')).toBeInTheDocument();

    // Navigate to Action Plans workspace
    const actionTab = screen.getByRole('button', { name: /Action Plans/i });
    fireEvent.click(actionTab);
    expect(await screen.findByText(/Review, authorize, and run containment vectors/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulation Environment Active/i)).toBeInTheDocument();

    // Navigate to Agent Memory placeholder
    const memoryTab = screen.getByRole('button', { name: /Agent Memory/i });
    fireEvent.click(memoryTab);
    expect(screen.getByText('Agent Memory & Institutional Knowledge Base')).toBeInTheDocument();
  });

  it('opens and closes New Investigation modal cleanly', () => {
    render(<AppShell />);

    const newInvBtn = screen.getByRole('button', { name: /New investigation/i });
    fireEvent.click(newInvBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Initiate Incident Docket/i)).toBeInTheDocument();

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('executes global search and displays matching graph nodes', async () => {
    vi.spyOn(apiClient, 'search').mockResolvedValue({
      query: 'cumin',
      total_matches: 1,
      matches: [
        {
          entity_type: 'RawLot',
          entity_id: 'LOT-CUM-2026-088',
          display_name: 'Organic Ground Cumin Lot',
          traceability_status: 'VERIFIED',
          disposition: 'QUARANTINED',
        },
      ],
    });

    render(<AppShell />);

    const searchInput = screen.getByPlaceholderText(/Search lots, shipments, facilities.../i);
    fireEvent.change(searchInput, { target: { value: 'cumin' } });

    await waitFor(() => {
      expect(screen.getAllByText('LOT-CUM-2026-088').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Organic Ground Cumin Lot')).toBeInTheDocument();
    });
  });
});
