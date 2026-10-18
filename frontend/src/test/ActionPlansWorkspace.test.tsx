import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionPlansWorkspace } from '../components/actions/ActionPlansWorkspace';
import { apiClient } from '../api/client';
import type { ActionPlanResponse } from '../types/api';

const mockActionPlan: ActionPlanResponse = {
  case_id: 'SR-9412',
  suspect_raw_lot: 'LOT-CUM-2026-088',
  evidence_cited: [
    {
      evidence_id: 'EVID-LAB-904',
      evidence_type: 'COA_LAB_REPORT',
      title: 'Apex Spice Certificate of Analysis Salmonella Alert',
      source_uri: 'file:///mock/lab/coa_904.pdf',
      hash_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  ],
  proposed_actions: [
    {
      action_id: 'ACT-QUARANTINE-01',
      action_type: 'INTERNAL_HOLD',
      status: 'PROPOSED',
      target_id: 'FL-SALSA-101',
      target_entity: 'FinishedLot',
      evidence_references: ['EVID-LAB-904'],
      title: 'Hold inventory of FL-SALSA-101 (simulated)',
      instructions: 'Immediately place physical hold on Artisan Roasted Salsa 16oz in warehouse.',
      initiator: 'Response Planner · QA Team',
      path_classification: 'CONFIRMED_AFFECTED',
      origin_facility: 'Sunrise Spice Co.',
      origin_facility_id: 'TX-4',
      source_contaminant: 'LOT-CUM-2026-088',
      target_facility: 'Austin Central Distribution (TX-WMS-01)',
      current_state: [
        'Physical status: AVAILABLE in Austin WMS',
        'ERP Quarantine: Inactive (Bin 04-A to 04-D)',
      ],
      simulation_impact: [
        'FL-SALSA-101: Automated hold flag applied in digital twin',
        'ERP Quarantine: Virtual lock staged in simulation',
      ],
      audit_trail: [
        {
          actor: 'Response Planner · QA Team',
          action: 'Proposed by Response Planner',
          timestamp: 'Today, 10:18 AM',
          details: 'Automated heuristic trigger',
        },
      ],
    },
    {
      action_id: 'ACT-STOP-SHIP-02',
      action_type: 'CARRIER_STOP_SHIP',
      status: 'PROPOSED',
      target_id: 'SHIP-8821',
      target_entity: 'Shipment',
      evidence_references: ['EVID-LAB-904'],
      title: 'Hold shipment SHIP-8821 (simulated)',
      instructions: 'Issue stop-in-transit request to carrier.',
      carrier: 'Swift Cold Logistics',
      initiator: 'Logistics Agent',
      path_classification: 'CONFIRMED_AFFECTED',
      origin_facility: 'Sunrise Spice Co.',
      origin_facility_id: 'TX-4',
      source_contaminant: 'LOT-CUM-2026-088',
      target_facility: 'Pacific Regional Distribution Center',
      current_state: [
        'SHIP-8821: In transit via Swift Cold Logistics',
        'Carrier stop order: Not issued',
      ],
      simulation_impact: [
        'SHIP-8821: Held (simulated). Carrier geofence reroute trigger armed',
      ],
      audit_trail: [
        {
          actor: 'Logistics Agent',
          action: 'Proposed carrier stop-in-transit',
          timestamp: 'Today, 10:19 AM',
        },
      ],
    },
    {
      action_id: 'ACT-CONSIGNEE-03',
      action_type: 'CONSIGNEE_RECALL_NOTICE',
      status: 'PROPOSED',
      target_id: 'SHIP-8822',
      target_entity: 'Shipment',
      evidence_references: ['EVID-LAB-904'],
      title: 'Draft notice to Sierra Hub Beta',
      instructions: 'Dispatch urgent commercial recall notification.',
      recipient_email: 'logistics@sierrahub.example.com',
      initiator: 'Customer Ops',
      path_classification: 'CONFIRMED_AFFECTED',
      origin_facility: 'Sunrise Spice Co.',
      origin_facility_id: 'TX-4',
      source_contaminant: 'LOT-CUM-2026-088',
      target_facility: 'Sierra Hub Beta',
      current_state: ['SHIP-8822: Delivered to Sierra Hub Beta'],
      simulation_impact: ['Notice to Sierra Hub Beta drafted in digital twin'],
      audit_trail: [],
    },
    {
      action_id: 'ACT-AUDIT-04',
      action_type: 'QA_GAP_AUDIT',
      status: 'PROPOSED',
      target_id: 'FL-SALSA-103',
      target_entity: 'FinishedLot',
      evidence_references: [],
      title: 'QA evidence request for FL-SALSA-103',
      instructions: 'Lot lacks upstream transformation records.',
      initiator: 'Supplier QA Lead',
      path_classification: 'EVIDENCE_GAP',
      origin_facility: 'Apex Spice Co. (Supplier TX-4)',
      origin_facility_id: 'SUP-APEX-01',
      source_contaminant: 'UNKNOWN_UPSTREAM_LINK',
      target_facility: 'Salinas Processing Facility (FAC-SALINAS-01)',
      current_state: ['FL-SALSA-103: Unverified upstream link'],
      simulation_impact: ['QA evidence request queued in digital twin'],
      audit_trail: [],
    },
  ],
  total_actions: 4,
  requires_authorization: true,
  authorized: false,
};

describe('ActionPlansWorkspace Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getActionPlan').mockResolvedValue(mockActionPlan);
  });

  it('renders Action Plans workspace, simulation alert, and proposed actions list', async () => {
    render(<ActionPlansWorkspace />);

    expect(screen.getByText(/Generating Evidence-Grounded Action Plans.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Action Plans' })).toBeInTheDocument();
      expect(screen.getByText(/Simulated actions only/i)).toBeInTheDocument();
      expect(screen.getByText(/Model: MESH-ALPHA-4/i)).toBeInTheDocument();
      expect(screen.getByText(/4 queued/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Hold inventory of FL-SALSA-101 (simulated)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Hold shipment SHIP-8821 (simulated)')).toBeInTheDocument();
    expect(screen.getByText('Draft notice to Sierra Hub Beta')).toBeInTheDocument();
    expect(screen.getByText('QA evidence request for FL-SALSA-103')).toBeInTheDocument();
  });

  it('selects an action candidate card and displays its evidence lineage', async () => {
    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Hold shipment SHIP-8821 (simulated)')).toBeInTheDocument();
    });

    // Click second action card via data-testid
    fireEvent.click(screen.getByTestId('action-card-ACT-STOP-SHIP-02'));

    await waitFor(() => {
      expect(screen.getByText(/SYS-TRIGGER: REF-CTE-SHIP-8821/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Logistics Agent/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Pacific Regional Distribution Center/i)).toBeInTheDocument();
    });

    // Check lineage flow cards
    expect(screen.getByText('Facility Origin')).toBeInTheDocument();
    expect(screen.getByText('Sunrise Spice Co.')).toBeInTheDocument();
    expect(screen.getByText('Source Contaminant')).toBeInTheDocument();
    expect(screen.getByText('Interception Goal')).toBeInTheDocument();
  });

  it('displays Now vs After Approval comparative cards', async () => {
    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Now \(Current State\)/i)).toBeInTheDocument();
      expect(screen.getByText(/After Approval \(Simulation Impact\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Zero real-world warehouse stoppage during simulation/i)).toBeInTheDocument();
    });
  });

  it('successfully executes approval transition with human signature and rationale', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateActionItemStatus').mockResolvedValue({
      action_id: 'ACT-QUARANTINE-01',
      previous_status: 'PROPOSED',
      status: 'APPROVED',
      actor: 'Dr. Elena Vance (QA Food Safety Lead)',
      rationale: 'Authorized QA containment signoff for batch interception',
      updated_at: '2026-10-18T12:00:00Z',
      audit_event_id: 'AUD-TEST-001',
      message: 'Action ACT-QUARANTINE-01 transitioned from PROPOSED to APPROVED.',
    });

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve simulated action/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Approve simulated action/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        action_id: 'ACT-QUARANTINE-01',
        new_status: 'APPROVED',
        actor: 'Dr. Elena Vance (QA Food Safety Lead)',
        rationale: 'Authorized QA containment signoff for batch interception',
      });
      expect(screen.getByText(/transitioned from PROPOSED to APPROVED/i)).toBeInTheDocument();
    });
  });

  it('blocks submission and shows error if human approver signature is empty', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateActionItemStatus');

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve simulated action/i })).toBeInTheDocument();
    });

    const approverInput = screen.getByLabelText(/Human Approver Signature/i);
    fireEvent.change(approverInput, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /Approve simulated action/i }));

    await waitFor(() => {
      expect(updateSpy).not.toHaveBeenCalled();
      expect(screen.getByText(/Human operator signature is mandatory/i)).toBeInTheDocument();
    });
  });

  it('requests changes and transitions action to PENDING_REVIEW', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateActionItemStatus').mockResolvedValue({
      action_id: 'ACT-QUARANTINE-01',
      previous_status: 'PROPOSED',
      status: 'PENDING_REVIEW',
      actor: 'Dr. Elena Vance (QA Food Safety Lead)',
      rationale: 'Check storage temperature before locking',
      updated_at: '2026-10-18T12:00:00Z',
      audit_event_id: 'AUD-TEST-002',
      message: 'Action ACT-QUARANTINE-01 transitioned to PENDING_REVIEW.',
    });

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Request changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Request changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          new_status: 'PENDING_REVIEW',
        })
      );
    });
  });

  it('blocks action and transitions to REJECTED', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateActionItemStatus').mockResolvedValue({
      action_id: 'ACT-QUARANTINE-01',
      previous_status: 'PROPOSED',
      status: 'REJECTED',
      actor: 'Dr. Elena Vance (QA Food Safety Lead)',
      rationale: 'Hold not applicable',
      updated_at: '2026-10-18T12:00:00Z',
      audit_event_id: 'AUD-TEST-003',
      message: 'Action ACT-QUARANTINE-01 transitioned to REJECTED.',
    });

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Block/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Block/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          new_status: 'REJECTED',
        })
      );
    });
  });

  it('filters actions by status tab', async () => {
    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByText('Hold inventory of FL-SALSA-101 (simulated)').length).toBeGreaterThanOrEqual(1);
    });

    // Click APPROVED filter button
    fireEvent.click(screen.getByRole('button', { name: 'APPROVED' }));

    await waitFor(() => {
      expect(screen.getByText(/No actions match filter "APPROVED"/i)).toBeInTheDocument();
    });

    // Click ALL filter button
    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));

    await waitFor(() => {
      expect(screen.getAllByText('Hold inventory of FL-SALSA-101 (simulated)').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens and closes Batch Audit Log modal', async () => {
    vi.spyOn(apiClient, 'getAuditTimeline').mockResolvedValue({
      total_events: 1,
      events: [
        {
          event_id: 'AUD-2026-999',
          timestamp: '2026-10-18T12:00:00Z',
          action_type: 'CONTAINMENT_SIMULATED',
          outcome: 'SUCCESS',
          entity_id: 'DEC-001',
          actor: 'Dr. Elena Vance',
          details: 'Executed simulated containment decision.',
          is_simulation: true,
        },
      ],
    });

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Batch Audit Log/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Batch Audit Log/i }));

    await waitFor(() => {
      expect(screen.getByText('FSMA 204 System Audit Trail')).toBeInTheDocument();
      expect(screen.getByText('AUD-2026-999')).toBeInTheDocument();
      expect(screen.getByText('Executed simulated containment decision.')).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('FSMA 204 System Audit Trail')).not.toBeInTheDocument();
    });
  });

  it('opens and displays Export Plan dossier modal', async () => {
    vi.spyOn(apiClient, 'exportActionPlan').mockResolvedValue({
      plan_id: 'PLAN-LOT-CUM-2026-088-TEST',
      raw_lot_code: 'LOT-CUM-2026-088',
      export_format: 'markdown',
      generated_at_utc: '2026-10-18T12:00:00Z',
      content: '# FSMA 204 CONTAINMENT ACTION PLAN DOSSIER\n**Plan ID:** `PLAN-TEST`',
      structured_plan: mockActionPlan,
      simulation_disclaimer: 'Synthetic Demo',
    });

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export Plan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export Plan/i }));

    await waitFor(() => {
      expect(screen.getByText('FSMA 204 Containment Action Plan Dossier')).toBeInTheDocument();
      expect(screen.getByText(/FSMA 204 CONTAINMENT ACTION PLAN DOSSIER/i)).toBeInTheDocument();
    });
  });

  it('handles backend service failure with Retry button', async () => {
    vi.spyOn(apiClient, 'getActionPlan').mockRejectedValueOnce(new Error('Connection to FalkorDB lost'));

    render(<ActionPlansWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Connection to FalkorDB lost/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    // Provide successful mock on retry
    vi.spyOn(apiClient, 'getActionPlan').mockResolvedValueOnce(mockActionPlan);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Action Plans' })).toBeInTheDocument();
    });
  });
});
