import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type {
  ActionPlanResponse,
  ActionItem,
  AuditTimelineResponse,
  ExportActionPlanResponse,
} from '../../types/api';
import { Modal } from '../common/Modal';

interface ActionPlansWorkspaceProps {
  datasetId?: string;
  activeRootLot?: string;
  onNavigateToOverview?: () => void;
  onNavigateToInvestigation?: () => void;
  onNavigateToGraph?: () => void;
}

export const ActionPlansWorkspace: React.FC<ActionPlansWorkspaceProps> = ({
  datasetId,
  activeRootLot,
  onNavigateToOverview: _onNavigateToOverview,
  onNavigateToInvestigation: _onNavigateToInvestigation,
  onNavigateToGraph: _onNavigateToGraph,
}) => {
  // State
  const [rootLotId, setRootLotId] = useState(activeRootLot || 'LOT-CUM-2026-088');

  // Sync rootLotId when activeRootLot changes from header/dataset switch
  useEffect(() => {
    if (activeRootLot) {
      setRootLotId(activeRootLot);
    }
  }, [activeRootLot]);

  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Human Governance Signoff State
  const [approverName, setApproverName] = useState('Dr. Elena Vance (QA Food Safety Lead)');
  const [rationale, setRationale] = useState('Authorized QA containment signoff for batch interception');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [isBatchAuditOpen, setIsBatchAuditOpen] = useState(false);
  const [batchAuditEvents, setBatchAuditEvents] = useState<any[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDossier, setExportDossier] = useState<ExportActionPlanResponse | null>(null);
  const [isLoadingExport, setIsLoadingExport] = useState(false);

  // Fetch Action Plan
  const fetchPlan = useCallback(async (lotCode: string, dsId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = dsId ? await apiClient.getActionPlan(lotCode, dsId) : await apiClient.getActionPlan(lotCode);
      setPlan(data);
      if (data.proposed_actions && data.proposed_actions.length > 0) {
        setSelectedActionId((prev) => {
          if (prev && data.proposed_actions.some((a) => a.action_id === prev)) {
            return prev;
          }
          return data.proposed_actions[0].action_id;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load containment action plan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan(rootLotId, datasetId);
  }, [fetchPlan, rootLotId, datasetId]);

  // Selected Action Item
  const selectedAction: ActionItem | null =
    plan?.proposed_actions.find((a) => a.action_id === selectedActionId) ||
    plan?.proposed_actions[0] ||
    null;

  // Filtered Actions
  const filteredActions = (plan?.proposed_actions || []).filter((action) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PROPOSED') return action.status === 'PROPOSED';
    if (statusFilter === 'PENDING_REVIEW') return action.status === 'PENDING_REVIEW';
    if (statusFilter === 'APPROVED') return action.status === 'APPROVED';
    if (statusFilter === 'REJECTED') return action.status === 'REJECTED';
    if (statusFilter === 'SIMULATED') {
      return action.status === 'APPROVED_SIMULATED' || action.status === 'COMPLETED';
    }
    return true;
  });

  // Handle Status Transition
  const handleTransitionStatus = async (newStatus: string) => {
    if (!selectedAction) return;

    if (!approverName.trim()) {
      setActionError('Human operator signature is mandatory before updating containment actions.');
      return;
    }
    if (!rationale.trim()) {
      setActionError('Audit justification rationale is required for governance tracking.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.updateActionItemStatus({
        action_id: selectedAction.action_id,
        new_status: newStatus,
        actor: approverName.trim(),
        rationale: rationale.trim(),
      });

      setSuccessMessage(res.message);
      // Refresh plan to display persisted status & audit trail
      await fetchPlan(rootLotId);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setActionError(`Governance rejection (${err.status}): ${err.message}`);
      } else {
        setActionError(err.message || 'Failed to update action status.');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Batch Audit Modal
  const handleOpenBatchAudit = async () => {
    setIsBatchAuditOpen(true);
    setIsLoadingAudits(true);
    try {
      const res: AuditTimelineResponse = await apiClient.getAuditTimeline(25);
      setBatchAuditEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load batch audit log:', err);
    } finally {
      setIsLoadingAudits(false);
    }
  };

  // Open Export Dossier Modal
  const handleOpenExport = async () => {
    setIsExportModalOpen(true);
    setIsLoadingExport(true);
    try {
      const res = datasetId ? await apiClient.exportActionPlan(rootLotId, datasetId) : await apiClient.exportActionPlan(rootLotId);
      setExportDossier(res);
    } catch (err) {
      console.error('Failed to load export dossier:', err);
    } finally {
      setIsLoadingExport(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'INTERNAL_HOLD':
        return 'inventory_2';
      case 'CARRIER_STOP_SHIP':
        return 'local_shipping';
      case 'CONSIGNEE_RECALL_NOTICE':
        return 'description';
      case 'QA_GAP_AUDIT':
        return 'biotech';
      default:
        return 'assignment_turned_in';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#E6F4EA', color: '#137333', border: 'rgba(19, 115, 51, 0.3)' };
      case 'APPROVED_SIMULATED':
      case 'COMPLETED':
        return { bg: '#E0F2EB', color: '#136150', border: 'rgba(19, 97, 80, 0.3)' };
      case 'PENDING_REVIEW':
        return { bg: '#FEF3D6', color: '#8F6617', border: 'rgba(143, 102, 23, 0.3)' };
      case 'REJECTED':
        return { bg: '#FCE8E6', color: '#C5221F', border: 'rgba(197, 34, 31, 0.3)' };
      case 'PROPOSED':
      default:
        return { bg: '#F0ECE1', color: '#5C584E', border: 'var(--color-border)' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Approved';
      case 'APPROVED_SIMULATED':
      case 'COMPLETED':
        return 'Simulated';
      case 'PENDING_REVIEW':
        return 'Changes Requested';
      case 'REJECTED':
        return 'Blocked';
      case 'PROPOSED':
      default:
        return 'Proposed';
    }
  };

  return (
    <div className="action-plans-container" style={{ padding: 'var(--spacing-lg) 0' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 var(--spacing-lg)' }}>
        {/* TOP BANNER & HEADER */}
        <header style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  FSMA 204 Stage II
                </span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-secondary)' }}></span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  Simulation Environment Active
                </span>
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.015em', margin: 0 }}>
                Action Plans
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                Review, authorize, and run containment vectors across synthetic digital twins.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-surface-container-high, #dbece6)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Model: MESH-ALPHA-4
              </span>
              <button
                type="button"
                onClick={handleOpenBatchAudit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                <span>Batch Audit Log</span>
              </button>
            </div>
          </div>

          {/* Simulation Guardrail Alert Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#FEF8E8',
              border: '1px solid #F3DA98',
              color: '#745115',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8F6617', flexShrink: 0 }}>
              info
            </span>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
              <span>
                <strong>Simulated actions only.</strong> Nothing real is stopped or sent. Production warehouse management systems (WMS) remain unaffected.
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, flexShrink: 0 }}>
                Dry-run Session #{plan?.case_id || 'SR-9412'}
              </span>
            </div>
          </div>
        </header>

        {/* Global Error or Loading State */}
        {isLoading && (
          <div
            style={{
              padding: 'var(--spacing-xl)',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span className="material-symbols-outlined spin" style={{ fontSize: '32px', color: 'var(--color-primary)' }}>
              progress_activity
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Generating Evidence-Grounded Action Plans...
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Traversing critical tracking events and evaluating containment vectors in FalkorDB
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#FCE8E6',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(197, 34, 31, 0.3)',
              color: '#C5221F',
              marginBottom: 'var(--spacing-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchPlan(rootLotId)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#C5221F',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && plan && (
          /* TWO-COLUMN MAIN WORKSPACE */
          <div
            className="action-plans-main-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 'var(--spacing-lg)',
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: Proposed Actions Backlog (4 cols) */}
            <section
              aria-label="Action Backlog"
              className="action-backlog-col"
              style={{
                gridColumn: 'span 4',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Proposed Actions
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-surface-container-high, #dbece6)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {filteredActions.length} queued
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {['ALL', 'PROPOSED', 'APPROVED'].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid',
                        borderColor: statusFilter === filter ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: statusFilter === filter ? 'var(--color-primary)' : 'transparent',
                        color: statusFilter === filter ? '#fff' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action List Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredActions.length === 0 ? (
                  <div
                    style={{
                      padding: 'var(--spacing-lg)',
                      textAlign: 'center',
                      backgroundColor: 'var(--color-surface-card)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px dashed var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    No actions match filter "{statusFilter}".
                  </div>
                ) : (
                  filteredActions.map((action) => {
                    const isSelected = action.action_id === selectedActionId;
                    const statusBadge = getStatusBadgeStyle(action.status);
                    return (
                      <article
                        key={action.action_id}
                        data-testid={`action-card-${action.action_id}`}
                        tabIndex={0}
                        onClick={() => setSelectedActionId(action.action_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedActionId(action.action_id);
                          }
                        }}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: isSelected ? '#F0F7F5' : 'var(--color-surface-card)',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          boxShadow: 'var(--shadow-card)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: '5px',
                              backgroundColor: 'var(--color-primary)',
                            }}
                          />
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: isSelected ? 'var(--color-surface-card)' : 'var(--color-canvas-bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border)',
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                              {getActionIcon(action.action_type)}
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: statusBadge.bg,
                              color: statusBadge.color,
                              border: `1px solid ${statusBadge.border}`,
                            }}
                          >
                            {getStatusLabel(action.status)}
                          </span>
                        </div>

                        <h2
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            lineHeight: 1.35,
                            margin: '0 0 6px 0',
                          }}
                        >
                          {action.title}
                        </h2>

                        <p
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                            account_tree
                          </span>
                          <span>{action.initiator || 'Response Planner · QA Team'}</span>
                        </p>

                        <div
                          style={{
                            marginTop: '12px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                          }}
                        >
                          {action.path_classification === 'CONFIRMED_AFFECTED' ? (
                            <span style={{ color: 'var(--color-tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-tertiary)' }}></span>
                              Critical Path Link
                            </span>
                          ) : (
                            <span style={{ color: '#9682CE', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9682CE' }}></span>
                              Evidence Gap
                            </span>
                          )}
                          <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            ID: {action.action_id}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {/* RIGHT COLUMN: Detailed Review Stage (8 cols) */}
            <section
              aria-label="Action Execution Review"
              className="action-detail-col"
              style={{
                gridColumn: 'span 8',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-lg)',
              }}
            >
              {selectedAction ? (
                <div
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-surface-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                  }}
                >
                  {/* Detailed Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: getStatusBadgeStyle(selectedAction.status).bg,
                            color: getStatusBadgeStyle(selectedAction.status).color,
                            border: `1px solid ${getStatusBadgeStyle(selectedAction.status).border}`,
                          }}
                        >
                          {getStatusLabel(selectedAction.status)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          SYS-TRIGGER: REF-CTE-{selectedAction.target_id}
                        </span>
                      </div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
                        {selectedAction.title}
                      </h2>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Initiator:{' '}
                        <strong style={{ color: 'var(--color-text-primary)' }}>{selectedAction.initiator || 'Response Planner · QA Team'}</strong> • Target
                        facility:{' '}
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {selectedAction.target_facility || 'Austin Central Distribution (TX-WMS-01)'}
                        </strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleOpenExport}
                        title="Download Audit Dossier"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '38px',
                          padding: '0 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                        <span>Export Plan</span>
                      </button>
                    </div>
                  </div>

                  {/* Notification Banners */}
                  {successMessage && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#E6F4EA',
                        border: '1px solid rgba(19, 115, 51, 0.3)',
                        color: '#137333',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {actionError && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#FCE8E6',
                        border: '1px solid rgba(197, 34, 31, 0.3)',
                        color: '#C5221F',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                      <span>{actionError}</span>
                    </div>
                  )}

                  {/* Section 1: Why: Evidence Traceability Lineage */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>route</span>
                        Why: Evidence Traceability Lineage
                      </span>
                      {selectedAction.path_classification === 'CONFIRMED_AFFECTED' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(231, 120, 97, 0.1)',
                            color: 'var(--color-tertiary)',
                            border: '1px solid rgba(231, 120, 97, 0.25)',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-tertiary)' }}></span>
                          Affected Path Confirmed
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(150, 130, 206, 0.15)',
                            color: '#9682CE',
                            border: '1px solid rgba(150, 130, 206, 0.3)',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9682CE' }}></span>
                          Evidence Gap Detected
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      {selectedAction.instructions}
                    </p>

                    {/* Lineage Flow 3-Step Representation */}
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: 'var(--color-canvas-bg)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      {/* Step A: Origin Facility */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: '180px',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-surface-card)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                          Facility Origin
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {selectedAction.origin_facility || 'Sunrise Spice Co.'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          Location ID: {selectedAction.origin_facility_id || 'TX-4'}
                        </span>
                      </div>

                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-text-secondary)' }}>
                        arrow_forward
                      </span>

                      {/* Step B: Source Contaminant */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-surface-card)',
                          border: '2px solid var(--color-tertiary)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-tertiary)', textTransform: 'uppercase' }}>
                            Source Contaminant
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-tertiary)' }}>
                            warning
                          </span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          Cumin Raw Lot
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-tertiary)', fontFamily: 'monospace', fontWeight: 600 }}>
                          {selectedAction.source_contaminant || rootLotId}
                        </span>
                      </div>

                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-text-secondary)' }}>
                        arrow_forward
                      </span>

                      {/* Step C: Target Interception Goal */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-surface-card)',
                          border: '2px solid var(--color-primary)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                            Interception Goal
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                            target
                          </span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {selectedAction.target_id}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                          {selectedAction.target_entity} · Containment
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Now vs. After Approval */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>compare_arrows</span>
                      Now vs. After Approval
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                      {/* Current State */}
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: 'var(--color-canvas-bg)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Now (Current State)
                            </span>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}>lock_open</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(selectedAction.current_state || [
                              'Inventory status: Available for dispatch in warehouse',
                              'ERP Quarantine: Inactive',
                              'Consignee notice: Not dispatched',
                            ]).map((item, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginTop: '2px', flexShrink: 0 }}>
                                  schedule
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                          Live telemetry feed active
                        </div>
                      </div>

                      {/* Simulation Impact */}
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: '#F0F7F5',
                          border: '1px solid var(--color-primary)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(51, 122, 104, 0.25)', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              After Approval (Simulation Impact)
                            </span>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>lock_clock</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(selectedAction.simulation_impact || [
                              'Virtual hold flag applied in digital twin',
                              'Automated ERP quarantine lock staged in simulation',
                              'Zero real-world warehouse stoppage during simulation',
                            ]).map((item, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }}>
                                  check_circle
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-primary)', borderTop: '1px solid rgba(51, 122, 104, 0.25)', paddingTop: '8px', fontWeight: 600 }}>
                          Zero real-world warehouse stoppage during simulation
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: 3-Step Approval Pipeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>linear_scale</span>
                      3-Step Approval Pipeline
                    </span>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Approval acts as the formal human-in-the-loop audit gate prior to dry-run simulated execution.
                    </p>

                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: 'var(--color-canvas-bg)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '520px', margin: '0 auto', position: 'relative' }}>
                        {/* Step 1: Proposed */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, backgroundColor: 'var(--color-canvas-bg)', padding: '0 8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: selectedAction.status === 'PROPOSED' ? 'var(--color-primary)' : 'var(--color-surface-card)',
                              color: selectedAction.status === 'PROPOSED' ? '#fff' : 'var(--color-primary)',
                              border: '2px solid var(--color-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            1
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Proposed</span>
                        </div>

                        {/* Line 1 */}
                        <div style={{ flex: 1, height: '2px', backgroundColor: ['APPROVED', 'COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-border)' }} />

                        {/* Step 2: Approved */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, backgroundColor: 'var(--color-canvas-bg)', padding: '0 8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: selectedAction.status === 'APPROVED' ? 'var(--color-primary)' : ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-surface-card)',
                              color: ['APPROVED', 'COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? '#fff' : 'var(--color-text-secondary)',
                              border: '2px solid',
                              borderColor: ['APPROVED', 'COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            2
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: ['APPROVED', 'COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                            Approved
                          </span>
                        </div>

                        {/* Line 2 */}
                        <div style={{ flex: 1, height: '2px', backgroundColor: ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-border)' }} />

                        {/* Step 3: Simulated */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, backgroundColor: 'var(--color-canvas-bg)', padding: '0 8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-surface-card)',
                              color: ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? '#fff' : 'var(--color-text-secondary)',
                              border: '2px solid',
                              borderColor: ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            3
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: ['COMPLETED', 'APPROVED_SIMULATED'].includes(selectedAction.status) ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                            Simulated
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Human Governance Inputs & Action Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      <div>
                        <label
                          htmlFor="approver-name-input"
                          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}
                        >
                          Human Approver Signature <span style={{ color: 'var(--color-tertiary)' }}>*</span>
                        </label>
                        <input
                          id="approver-name-input"
                          type="text"
                          value={approverName}
                          onChange={(e) => setApproverName(e.target.value)}
                          placeholder="e.g. Dr. Elena Vance (QA Lead)"
                          disabled={isSubmittingAction}
                          style={{
                            width: '100%',
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface-card)',
                            color: 'var(--color-text-primary)',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="rationale-input"
                          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}
                        >
                          Audit Justification Rationale <span style={{ color: 'var(--color-tertiary)' }}>*</span>
                        </label>
                        <input
                          id="rationale-input"
                          type="text"
                          value={rationale}
                          onChange={(e) => setRationale(e.target.value)}
                          placeholder="Reason for decision"
                          disabled={isSubmittingAction}
                          style={{
                            width: '100%',
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface-card)',
                            color: 'var(--color-text-primary)',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {selectedAction.status !== 'APPROVED' && selectedAction.status !== 'COMPLETED' && selectedAction.status !== 'APPROVED_SIMULATED' ? (
                          <button
                            type="button"
                            onClick={() => handleTransitionStatus('APPROVED')}
                            disabled={isSubmittingAction}
                            style={{
                              height: '40px',
                              padding: '0 18px',
                              borderRadius: 'var(--radius-lg)',
                              backgroundColor: 'var(--color-primary)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: 'var(--shadow-card)',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_reg</span>
                            <span>Approve simulated action</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTransitionStatus('COMPLETED')}
                            disabled={isSubmittingAction || selectedAction.status === 'COMPLETED'}
                            style={{
                              height: '40px',
                              padding: '0 18px',
                              borderRadius: 'var(--radius-lg)',
                              backgroundColor: selectedAction.status === 'COMPLETED' ? '#579779' : 'var(--color-primary)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: isSubmittingAction || selectedAction.status === 'COMPLETED' ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sync_saved_locally</span>
                            <span>{selectedAction.status === 'COMPLETED' ? 'Simulated in Digital Twin' : 'Run simulated execution'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleTransitionStatus('PENDING_REVIEW')}
                          disabled={isSubmittingAction}
                          style={{
                            height: '40px',
                            padding: '0 16px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-primary)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-primary)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rate_review</span>
                          <span>Request changes</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTransitionStatus('REJECTED')}
                        disabled={isSubmittingAction}
                        style={{
                          height: '40px',
                          padding: '0 16px',
                          borderRadius: 'var(--radius-lg)',
                          border: 'none',
                          backgroundColor: 'rgba(231, 120, 97, 0.12)',
                          color: 'var(--color-tertiary)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>block</span>
                        <span>Block</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 5: Action Audit Trail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Action Audit Trail
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        FSMA Section 204.145 Compliant Log
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedAction.audit_trail || []).map((entry, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-canvas-bg)',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }}></span>
                            <strong style={{ color: 'var(--color-text-primary)' }}>{entry.action}</strong>
                            {entry.details && <span style={{ color: 'var(--color-text-secondary)' }}>• {entry.details}</span>}
                          </div>
                          <time style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
                            {entry.timestamp}
                          </time>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--spacing-xl)',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-surface-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-text-secondary)' }}>
                    touch_app
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '8px' }}>
                    Select an action candidate to review
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Choose an action from the proposed actions backlog to review evidence paths, current vs simulation impact, and execute governance gates.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Batch Audit Log Modal */}
      <Modal
        isOpen={isBatchAuditOpen}
        onClose={() => setIsBatchAuditOpen(false)}
        title="FSMA 204 System Audit Trail"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Chronological log of containment decisions, simulated executions, and evidence requests stored immutably in FalkorDB.
          </p>

          {isLoadingAudits ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <span className="material-symbols-outlined spin" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>
                progress_activity
              </span>
            </div>
          ) : batchAuditEvents.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>
              No audit events recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
              {batchAuditEvents.map((aud) => (
                <div
                  key={aud.event_id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-canvas-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {aud.action_type}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                      {aud.event_id}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-primary)', margin: 0 }}>
                    {aud.details}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    <span>Actor: {aud.actor}</span>
                    <time>{new Date(aud.timestamp).toLocaleString()}</time>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setIsBatchAuditOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Export Plan Dossier Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="FSMA 204 Containment Action Plan Dossier"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Audit-ready containment dossier formatted under 21 CFR § 1.1300–1.1400 (FSMA Section 204) records maintenance rules.
          </p>

          {isLoadingExport ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <span className="material-symbols-outlined spin" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>
                progress_activity
              </span>
            </div>
          ) : exportDossier ? (
            <div>
              <pre
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px solid var(--color-border)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--color-text-primary)',
                }}
              >
                {exportDossier.content}
              </pre>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Failed to load export dossier.</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Simulation Guardrail Active: Dry-run data only.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  if (exportDossier?.content) {
                    navigator.clipboard?.writeText(exportDossier.content);
                    alert('Dossier copied to clipboard!');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy Markdown
              </button>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
