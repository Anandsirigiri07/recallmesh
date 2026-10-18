import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { NodeInspectorResponse } from '../../types/api';

interface NodeInspectorPanelProps {
  nodeId: string | null;
  onOpenEvidenceRequest: (lotId: string, defaultSupplier?: string) => void;
  onOpenUploadCertificate: (lotId: string) => void;
  onOpenContainmentPlan?: () => void;
  onClose?: () => void;
}

export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({
  nodeId,
  onOpenEvidenceRequest,
  onOpenUploadCertificate,
  onOpenContainmentPlan,
}) => {
  const [data, setData] = useState<NodeInspectorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setData(null);
      return;
    }

    let isMounted = true;
    const fetchNode = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getNodeInspector(nodeId);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || `Failed to load details for node '${nodeId}'`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNode();
    return () => {
      isMounted = false;
    };
  }, [nodeId]);

  if (!nodeId) {
    return (
      <div
        className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>
            pageview
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Node Inspector
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
          Select any node in the 6-stage graph canvas to inspect its FSMA 204 ledger attributes, relationships, and forensic reasoning.
        </p>
      </div>
    );
  }

  const isGap = data?.is_gap_detected || nodeId === 'FL-SALSA-103' || data?.traceability_status === 'GAP_DETECTED';
  const isAffected = data?.traceability_status === 'AFFECTED' || (data && !isGap && (nodeId === 'LOT-CUM-2026-088' || nodeId === 'FL-SALSA-101' || nodeId.startsWith('SHIP-8821') || nodeId.startsWith('SHIP-8822')));

  return (
    <div
      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
      style={{
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Inspector Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-sm)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--spacing-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>
            pageview
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Node Inspector
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          {data?.node_id || nodeId}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
          Querying FalkorDB node attributes...
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-review-tint)',
            color: 'var(--color-status-review-text)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>Node Unavailable</div>
          <div>{error}</div>
        </div>
      ) : data ? (
        <>
          {/* Node Identity & Badge */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  wordBreak: 'break-all',
                }}
              >
                {data.node_id}
              </h3>

              {isGap ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-unknown-tint)',
                    color: 'var(--color-status-unknown-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                    link_off
                  </span>
                  Gap detected
                </span>
              ) : isAffected ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-affected-tint)',
                    color: 'var(--color-status-affected-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-status-affected-solid)',
                    }}
                  />
                  Affected path
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-status-verified-tint)',
                    color: 'var(--color-status-verified-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-status-verified-solid)',
                    }}
                  />
                  Record verified
                </span>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.4' }}>
              {isGap
                ? 'Consumer salsa SKU missing inbound critical transformation link (KDE: TLC receipt mismatch).'
                : data.display_name && data.display_name !== data.node_id
                ? `${data.display_name} — Tracked under FSMA 204 CTE ledger.`
                : `Verified graph entity (${data.primary_label}) in property graph.`}
            </p>
          </div>

          {/* Structured Fact Rows */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-low)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: 'var(--spacing-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Source Record
              </span>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {isGap
                  ? 'Missing WMS Link / Pending COA'
                  : data.properties?.manifest_id
                  ? `Manifest #${data.properties.manifest_id}`
                  : `FalkorDB :${data.primary_label} Node`}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Entity Type
              </span>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {data.primary_label}
                {data.disposition ? ` (${data.disposition})` : ''}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Linked From
              </span>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {data.incoming_relationships.length > 0
                  ? data.incoming_relationships.map((r) => `${r.relationship_type}: ${r.connected_node_id}`).join(', ')
                  : isGap
                  ? 'Production: Salsa blend run (unconfirmed/missing)'
                  : 'Source origin root'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Linked To
              </span>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {data.outgoing_relationships.length > 0
                  ? data.outgoing_relationships.map((r) => `${r.relationship_type}: ${r.connected_node_id}`).join(', ')
                  : 'Terminal node'}
              </div>
            </div>
          </div>

          {/* Section: Why It Is Included */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 6px 0',
              }}
            >
              Why it is included
            </h4>
            <p
              style={{
                fontSize: '12.5px',
                color: 'var(--color-text-primary)',
                lineHeight: '1.45',
                margin: 0,
                backgroundColor: 'var(--color-surface-card)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            >
              {data.why_included ||
                (isGap
                  ? 'We could not find a record linking this lot to a production run (missing Critical Tracking Event).'
                  : 'Verified through deterministic graph relationship traversal.')}
            </p>
          </div>

          {/* Action Buttons based on status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isGap ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenEvidenceRequest('FL-SALSA-103', 'Sunrise Spice Co. (Supplier TX-4)')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '40px',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-hover)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    assignment_late
                  </span>
                  <span>Open QA evidence request</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUploadCertificate('FL-SALSA-103')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-surface-card)',
                    color: 'var(--color-primary)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-container)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-card)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    upload_file
                  </span>
                  <span>Upload Analysis Certificate</span>
                </button>
              </>
            ) : isAffected && onOpenContainmentPlan ? (
              <>
                <button
                  type="button"
                  onClick={onOpenContainmentPlan}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '40px',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    verified
                  </span>
                  <span>Approve simulated hold & plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUploadCertificate(data.node_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-surface-card)',
                    color: 'var(--color-primary)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    description
                  </span>
                  <span>View evidence & FSMA records</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpenUploadCertificate(data.node_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  description
                </span>
                <span>View evidence</span>
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
