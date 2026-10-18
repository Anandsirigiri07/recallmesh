import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type {
  OverviewMetricsResponse,
  TraceGapsResponse,
  ActionPlanResponse,
  HealthResponse,
  CTERecord,
  AuditEvent,
  EvidenceUploadResponse,
  EvidenceRequestResponse,
} from '../../types/api';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { StatCard } from '../common/StatCard';
import { NodeInspectorModal } from '../common/NodeInspectorModal';
import { UploadCertificateModal } from '../common/UploadCertificateModal';
import { SupplierRequestModal } from '../common/SupplierRequestModal';

interface OverviewDashboardProps {
  datasetId?: string;
  onNavigateToGraph: () => void;
  onNavigateToInvestigation: () => void;
  onNavigateToActionPlans: () => void;
}

function formatAuditAction(type: string, entityId?: string | null, details?: any): string {
  if (typeof details === 'string' && details.trim().length > 0) {
    return details;
  }
  switch (type) {
    case 'CASE_CREATED':
      return `Investigation docket ${entityId || ''} initiated: ${details?.title || 'Contamination screen'}`;
    case 'EVIDENCE_UPLOADED':
      return `Certificate uploaded for lot ${entityId || ''}: ${details?.filename || 'Document'}`;
    case 'SUPPLIER_REQUEST_SIMULATED':
    case 'SUPPLIER_EVIDENCE_REQUESTED':
      return `Simulated CoA inquiry dispatched for supplier ${details?.supplier_name || 'Supplier'} (Lot: ${entityId || ''})`;
    case 'CONTAINMENT_SIMULATED':
      return `Simulated containment plan executed by ${details?.authorized_by || 'QA Lead'} (${details?.actions_executed || 0} actions)`;
    case 'CONTAINMENT_REJECTED':
      return `Containment proposal rejected or unauthorized: ${details?.reason || 'Policy check'}`;
    default:
      return `${type.replace(/_/g, ' ')} (${entityId || 'system'})`;
  }
}

function formatAuditTimestamp(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';
  } catch {
    return isoString;
  }
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  datasetId,
  onNavigateToGraph,
  onNavigateToInvestigation,
  onNavigateToActionPlans,
}) => {
  const [metrics, setMetrics] = useState<OverviewMetricsResponse | null>(null);
  const [gaps, setGaps] = useState<TraceGapsResponse | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlanResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cteRecords, setCteRecords] = useState<CTERecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectNodeId, setInspectNodeId] = useState<string | null>(null);

  // Modals for real local workflows
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // User notification toasts / banner for actions
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [simulatedHoldApproved, setSimulatedHoldApproved] = useState(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, mRes, gRes, aRes, cteRes, auditRes] = await Promise.all([
        apiClient.getHealth().catch((e) => {
          return { status: 'degraded', falkordb_connected: false, note: e.message } as any;
        }),
        apiClient.getOverviewMetrics(datasetId),
        apiClient.getTraceGaps(datasetId).catch(() => ({
          gap_detected_finished_lots: [],
          gap_detected_shipments: [],
          total_gaps_found: 0,
          review_tasks: [],
        })),
        apiClient.getActionPlan(undefined, datasetId).catch(() => null),
        apiClient.getCteRecords().catch(() => ({ total_records: 0, records: [], is_synthetic: true, generated_at_utc: '' })),
        apiClient.getAuditTimeline(10).catch(() => ({ total_events: 0, events: [] })),
      ]);

      setHealth(hRes);
      setMetrics(mRes);
      setGaps(gRes);
      setActionPlan(aRes);
      setCteRecords(cteRes.records || []);
      setAuditEvents(auditRes.events || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to local RECALLMESH API service');
      setLoading(false);
    }
  };

  const refreshAuditTimeline = async () => {
    try {
      const auditRes = await apiClient.getAuditTimeline(10);
      setAuditEvents(auditRes.events || []);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [datasetId]);

  // Handle Review & Approve for simulated hold
  const handleApproveSimulatedHold = async () => {
    if (!actionPlan) return;
    try {
      const res = await apiClient.executeActionPlan(
        actionPlan,
        'Dr. Elena Vance (QA Food Safety Lead)'
      );
      setSimulatedHoldApproved(true);
      setActionFeedback(
        `Decision ${res.decision_id} executed: ${res.simulation_note}`
      );
      await refreshAuditTimeline();
    } catch (err: any) {
      setActionFeedback(`Approval error: ${err.message}`);
    }
  };

  // Handle QA evidence certificate upload success
  const handleUploadSuccess = async (res: EvidenceUploadResponse) => {
    setActionFeedback(
      `Certificate ${res.filename} attached to lot ${res.lot_code} (Status: ${res.verification_status}). Recorded in audit trail.`
    );
    await refreshAuditTimeline();
  };

  // Handle simulated supplier request success
  const handleSupplierRequestSuccess = async (res: EvidenceRequestResponse) => {
    setActionFeedback(
      `Simulated request ${res.request_id} for supplier ${res.supplier_name} logged. Disclaimer: No external communication dispatched.`
    );
    await refreshAuditTimeline();
  };

  const filteredCteRecords = cteRecords.filter(
    (record) =>
      !filterQuery ||
      record.tlc.toLowerCase().includes(filterQuery.toLowerCase()) ||
      record.event_type.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (record.facility_name && record.facility_name.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (record.facility_id && record.facility_id.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (record.traceability_status && record.traceability_status.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const getTraceabilityBadge = (status?: string | null) => {
    switch (status) {
      case 'AFFECTED':
      case 'PATH_AFFECTED':
        return { variant: 'affected' as const, label: 'Affected Path' };
      case 'VERIFIED':
        return { variant: 'verified' as const, label: 'Record Verified' };
      case 'GAP_DETECTED':
      case 'UNKNOWN':
        return { variant: 'unknown' as const, label: 'Unknown Link' };
      case 'PROVISIONAL':
        return { variant: 'review' as const, label: 'Needs Review' };
      default:
        return { variant: 'neutral' as const, label: status || 'Pending' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Node Inspector Modal */}
      <NodeInspectorModal
        nodeId={inspectNodeId}
        onClose={() => setInspectNodeId(null)}
      />

      {/* Upload Certificate Modal */}
      <UploadCertificateModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultLotCode="FL-SALSA-103"
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Supplier Request Modal */}
      <SupplierRequestModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        defaultLotCode="FL-SALSA-103"
        defaultSupplier="PRIMAVERA_ORGANICS_LTD"
        onRequestSuccess={handleSupplierRequestSuccess}
      />

      {/* Global / Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary-dark)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>
              check_circle
            </span>
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            style={{ color: 'var(--color-text-secondary)', padding: '4px' }}
            aria-label="Dismiss message"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Error / API Offline State */}
      {error && (
        <div
          role="alert"
          className="stitch-card"
          style={{
            borderColor: 'var(--color-status-affected-solid)',
            backgroundColor: 'var(--color-status-affected-tint)',
            color: 'var(--color-status-affected-text)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                cloud_off
              </span>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Backend API Service Offline or Degraded</h2>
                <p style={{ fontSize: '13px', marginTop: '2px' }}>{error}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={loadDashboardData}>
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {/* Operational State Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '8px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: health?.falkordb_connected ? 'var(--color-status-verified-solid)' : 'var(--color-status-affected-solid)',
              }}
            />
            <span className="text-label-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Synthetic Demonstration Monitor • Node US-CENTRAL-01
            </span>
          </div>
          <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>
            Recall Surveillance &amp; Lineage Ledger
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
            FSMA Rule 204 Ready
          </span>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span
              className="animate-pulse"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-verified-solid)',
              }}
            />
            <span className="text-label-md" style={{ color: 'var(--color-text-primary)' }}>
              Continuous Trace Active
            </span>
          </div>

          <Button variant="secondary" size="sm" icon="refresh" onClick={loadDashboardData} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* 1. TOP STAT CARDS (3 Columns) */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Stat Card 1: Shipments Traced */}
        <StatCard
          icon="local_shipping"
          iconColor="var(--color-status-verified-solid)"
          iconBg="var(--color-status-verified-tint)"
          badgeLabel="Normal Velocity"
          badgeVariant="verified"
          value={metrics ? metrics.shipments_traced_count : 2}
          label="Shipments traced"
          footerLeft="Downstream nodes: 14"
          footerRight={
            <span style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
              Audit locked
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                check_circle
              </span>
            </span>
          }
        />

        {/* Stat Card 2: Record Needs Review */}
        <StatCard
          icon="rule"
          iconColor="var(--color-status-review-solid)"
          iconBg="var(--color-status-review-tint)"
          badgeLabel="Action Pending"
          badgeVariant="review"
          value={metrics ? metrics.records_needing_review_count : 1}
          label="Record needs review"
          footerLeft="Lot: LOT-MIX-41"
          footerRight={
            <span style={{ color: 'var(--color-status-review-text)', fontWeight: 500 }}>
              Interrupted CTE
            </span>
          }
        />

        {/* Stat Card 3: Gap Open in Chain */}
        <StatCard
          icon="device_hub"
          iconColor="var(--color-status-unknown-solid)"
          iconBg="var(--color-status-unknown-tint)"
          badgeLabel="Missing TLC"
          badgeVariant="unknown"
          value={metrics ? metrics.gaps_open_count : (gaps?.total_gaps_found || 1)}
          label="Gap open in chain"
          footerLeft="Supplier CoA pending"
          footerRight={
            <span style={{ color: 'var(--color-status-unknown-text)', fontWeight: 500 }}>
              KDE unconfirmed
            </span>
          }
        />
      </section>

      {/* 2. MAIN SECTION (Left 8 cols, Right 4 cols) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN (8 of 12 cols on desktop) */}
        <div className="overview-main-left" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Block A: Current Case Card */}
          <article className="stitch-card">
            {/* Header */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  emergency
                </span>
                <span className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Current case
                </span>
                <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  • {metrics?.current_case?.case_id || 'INC-2026-0814'}
                </span>
              </div>

              <Badge variant="affected">High Priority / Affected Path</Badge>
            </div>

            {/* Case Info */}
            <div style={{ marginTop: '20px' }}>
              <h2 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>
                Suspected cumin lot {metrics?.current_case?.suspect_raw_lot || 'LOT-CUM-2026-088'}
              </h2>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '8px',
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    schedule
                  </span>
                  Reported: 2 hours ago
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    domain
                  </span>
                  Source: Facility TX-4 (El Paso Milling)
                </span>
                <span>•</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--color-status-affected-text)',
                    fontWeight: 500,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    science
                  </span>
                  Contaminant: {metrics?.current_case?.pathogen_or_hazard || 'Salmonella enterica'}
                </span>
              </div>
            </div>

            {/* Progress / Evidence Status */}
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-canvas-bg)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="text-label-md" style={{ color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
                    verified
                  </span>
                  Evidence: partly complete (68%)
                </span>
                <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  5 of 7 Key Data Elements logged
                </span>
              </div>

              {/* Segmented Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                  display: 'flex',
                  backgroundColor: 'var(--color-border)',
                }}
              >
                <div style={{ width: '68%', height: '100%', backgroundColor: 'var(--color-primary)' }} title="68% Traced" />
                <div style={{ width: '17%', height: '100%', backgroundColor: 'var(--color-status-review-solid)' }} title="17% Pending" />
                <div style={{ width: '15%', height: '100%', backgroundColor: 'var(--color-border-subtle)' }} title="15% Hold check" />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '12px',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  gap: '8px',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                  Traced receipts &amp; shipments
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-status-review-solid)' }} />
                  1 transform lot pending
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-border-subtle)' }} />
                  Quarantine hold check
                </span>
              </div>
            </div>

            {/* Bottom Action Area */}
            <div
              style={{
                marginTop: '24px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-status-verified-solid)' }}>
                  lock_clock
                </span>
                Regulatory response window: 21h 40m remaining
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button variant="secondary" icon="account_tree" onClick={onNavigateToGraph}>
                  View graph
                </Button>
                <Button variant="primary" iconTrailing="arrow_forward" onClick={onNavigateToInvestigation}>
                  Open investigation
                </Button>
              </div>
            </div>
          </article>

          {/* Block B: Waiting for you Card */}
          <article className="stitch-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-text-primary)', fontSize: '20px' }}>
                  checklist
                </span>
                <h2 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Waiting for you
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="review">
                  {simulatedHoldApproved ? '1 item requiring decision' : '2 items requiring decision'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNavigateToActionPlans}
                  title="View all proposed containment action plans"
                >
                  View plans
                </Button>
              </div>
            </div>

            {/* Action Item 1: Hold SHIP-8821 */}
            <div
              style={{
                paddingTop: '20px',
                paddingBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                opacity: simulatedHoldApproved ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                      Approve simulated hold on SHIP-8821
                    </h3>
                    <Badge variant={simulatedHoldApproved ? 'verified' : 'review'}>
                      {simulatedHoldApproved ? 'Approved (Simulated)' : 'Needs review'}
                    </Badge>
                  </div>

                  <p className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>
                    Distribution center Austin • 420 cases impacted (Brand: Sol Del Norte Seasoning Mix)
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                      info
                    </span>
                    Safety margin: Automated stop will prevent retail dispatch at 06:00 AM CST
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={simulatedHoldApproved}
                    onClick={handleApproveSimulatedHold}
                  >
                    {simulatedHoldApproved ? 'Approved' : 'Review & Approve'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={simulatedHoldApproved}
                    onClick={() => setActionFeedback('Action item SHIP-8821 dismissed from active queue.')}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)' }} />

            {/* Action Item 2: QA Request FL-SALSA-103 */}
            <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                      QA evidence request for FL-SALSA-103
                    </h3>
                    <Badge variant="unknown">Unknown link</Badge>
                  </div>

                  <p className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>
                    Batch mix formula verification • Lab certificate missing (KDE: TLC receipt mismatch)
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-status-unknown-solid)' }}>
                      attachment
                    </span>
                    Requested document: Certified Analysis of Cumin Extract Lot 2026-088
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
                    Upload Certificate
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsSupplierModalOpen(true)}>
                    Request from Supplier
                  </Button>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* RIGHT COLUMN (4 of 12 cols on desktop) */}
        <div className="overview-main-right" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Block C: Recent Activity Card */}
          <article className="stitch-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <h2 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                Audit trail activity
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-status-verified-solid)' }} />
                FalkorDB Log
              </div>
            </div>

            {auditEvents.length === 0 ? (
              <div
                style={{
                  marginTop: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px dashed var(--color-border)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  history_toggle_off
                </span>
                <p className="text-body-sm" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  No Audit Trail Events Yet
                </p>
                <p className="text-caption" style={{ color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Execute an investigation, evidence upload, supplier request, or containment approval to record persistent audit events in FalkorDB.
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '9px',
                    top: '8px',
                    bottom: '8px',
                    width: '1px',
                    backgroundColor: 'var(--color-border)',
                  }}
                />

                {auditEvents.map((evt) => (
                  <div key={evt.event_id} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        border: `2px solid ${evt.outcome === 'SUCCESS' ? 'var(--color-status-verified-solid)' : 'var(--color-status-affected-solid)'}`,
                        zIndex: 2,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-body-md" style={{ color: 'var(--color-text-primary)', lineHeight: 1.3, fontWeight: 500 }}>
                        {formatAuditAction(evt.action_type, evt.entity_id, evt.details)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="text-label-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatAuditTimestamp(evt.timestamp_utc || evt.timestamp)}
                        </span>
                        {evt.is_simulation && (
                          <Badge variant="neutral" showDot={false}>
                            Simulated
                          </Badge>
                        )}
                        <Badge variant={evt.outcome === 'SUCCESS' ? 'verified' : 'affected'} showDot={false}>
                          {evt.action_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
              }}
            >
              Persistence Note: Events persisted as :AuditEvent nodes in FalkorDB with server UTC timestamps.
            </div>
          </article>

          {/* Block D: Autonomous Agents Card */}
          <article className="stitch-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <h2 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
                Autonomous Agents
              </h2>
              <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Not instrumented
              </span>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Agent 1: Tracer */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>
                      hub
                    </span>
                    <span className="text-label-lg" style={{ color: 'var(--color-text-primary)' }}>
                      Tracer Agent
                    </span>
                  </div>
                  <Badge variant="neutral" showDot={false}>Not instrumented</Badge>
                </div>
                <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', paddingLeft: '26px' }}>
                  Graph traversal performed deterministically via FastAPI query endpoints
                </p>
              </div>

              {/* Agent 2: Memory Keeper */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>
                      psychology
                    </span>
                    <span className="text-label-lg" style={{ color: 'var(--color-text-primary)' }}>
                      Memory Keeper
                    </span>
                  </div>
                  <Badge variant="neutral" showDot={false}>
                    Not instrumented
                  </Badge>
                </div>
                <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', paddingLeft: '26px' }}>
                  Institutional facts stored directly as graph properties in local FalkorDB
                </p>
              </div>

              {/* Agent 3: Response Planner */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>
                      alt_route
                    </span>
                    <span className="text-label-lg" style={{ color: 'var(--color-text-primary)' }}>
                      Response Planner
                    </span>
                  </div>
                  <Badge variant="neutral" showDot={false}>Not instrumented</Badge>
                </div>
                <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', paddingLeft: '26px' }}>
                  Containment proposals evaluated rule-based with simulated human-in-the-loop authorization
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* Quick Ledger Overview Bar */}
      <section className="stitch-card">
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <h3 className="text-headline-sm" style={{ color: 'var(--color-text-primary)' }}>
              Active Critical Tracking Events (CTEs)
            </h3>
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Real-time FDA FSMA 204 ledger validation across current supply boundaries
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Filter Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Filter CTEs..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 12px 0 32px',
                  backgroundColor: 'var(--color-canvas-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                }}
              />
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '18px',
                  color: 'var(--color-text-secondary)',
                  pointerEvents: 'none',
                }}
              >
                filter_list
              </span>
            </div>

            {/* Direct Export CSV Button */}
            <a
              href={apiClient.getExportCsvUrl()}
              download="fsma_204_cte_ledger.csv"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="secondary" size="sm" icon="download">
                Export Electronic Sortable Spreadsheet
              </Button>
            </a>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="table-responsive" style={{ marginTop: '12px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}
              >
                <th style={{ padding: '12px', fontWeight: 500 }}>Traceability Lot Code</th>
                <th style={{ padding: '12px', fontWeight: 500 }}>Event Type</th>
                <th style={{ padding: '12px', fontWeight: 500 }}>Facility / Location</th>
                <th style={{ padding: '12px', fontWeight: 500 }}>Timestamp</th>
                <th style={{ padding: '12px', fontWeight: 500 }}>Verification Status</th>
                <th style={{ padding: '12px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCteRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '32px 12px',
                      textAlign: 'center',
                      color: 'var(--color-text-secondary)',
                      fontStyle: 'italic',
                    }}
                  >
                    No Critical Tracking Events found in current graph ledger.
                  </td>
                </tr>
              ) : (
                filteredCteRecords.map((record) => {
                  const badge = getTraceabilityBadge(record.traceability_status);
                  return (
                    <tr
                      key={`${record.event_id}-${record.tlc}`}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-canvas-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {record.tlc}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--color-canvas-bg)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            fontSize: '12px',
                          }}
                        >
                          {record.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', color: 'var(--color-text-secondary)' }}>
                        {record.facility_name || record.facility_id || 'Plant Central #2 (San Antonio)'}
                      </td>
                      <td className="tabular-nums" style={{ padding: '14px 12px', color: 'var(--color-text-secondary)' }}>
                        {record.date_time_utc}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectNodeId(record.tlc)}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
