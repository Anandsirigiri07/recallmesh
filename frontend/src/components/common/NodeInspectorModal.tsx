import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { NodeInspectorResponse, RelationshipInfo } from '../../types/api';
import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';
import { Button } from './Button';

interface NodeInspectorModalProps {
  nodeId: string | null;
  onClose: () => void;
}

export const NodeInspectorModal = ({ nodeId, onClose }: NodeInspectorModalProps) => {
  const [data, setData] = useState<NodeInspectorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .getNodeInspector(nodeId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to inspect node');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [nodeId]);

  if (!nodeId) return null;

  const getStatusBadge = (status?: string | null): BadgeVariant => {
    if (!status) return 'neutral';
    const s = status.toUpperCase();
    if (s.includes('VERIFIED') || s.includes('AVAILABLE') || s.includes('DELIVERED')) return 'verified';
    if (s.includes('GAP') || s.includes('UNKNOWN')) return 'unknown';
    if (s.includes('REVIEW') || s.includes('PROVISIONAL') || s.includes('TRANSIT')) return 'review';
    if (s.includes('AFFECTED') || s.includes('QUARANTINED') || s.includes('RECALLED')) return 'affected';
    return 'neutral';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(36, 51, 47, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="stitch-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-canvas-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="material-symbols-outlined"
              style={{ color: 'var(--color-primary)', fontSize: '22px' }}
            >
              account_tree
            </span>
            <div>
              <h2
                id="inspector-title"
                style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                Node Inspector • {nodeId}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                FalkorDB Property Graph Record
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close inspector"
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '28px' }}>
                progress_activity
              </span>
              <p style={{ marginTop: '8px' }}>Querying FalkorDB property graph...</p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-status-affected-tint)',
                color: 'var(--color-status-affected-text)',
                border: '1px solid var(--color-status-affected-solid)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span className="material-symbols-outlined">error</span>
                Node Lookup Failed
              </div>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>{error}</p>
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Primary Node Banner */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-canvas-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      TYPE:
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-xs)',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {data.primary_label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {data.traceability_status && (
                      <Badge variant={getStatusBadge(data.traceability_status)}>
                        Trace: {data.traceability_status}
                      </Badge>
                    )}
                    {data.disposition && (
                      <Badge variant={getStatusBadge(data.disposition)}>
                        Disp: {data.disposition}
                      </Badge>
                    )}
                    {data.is_gap_detected && (
                      <Badge variant="unknown">GAP DETECTED</Badge>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {data.display_name}
                </div>

                {data.why_included && (
                  <div
                    style={{
                      marginTop: '4px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: data.is_gap_detected
                        ? 'var(--color-status-unknown-tint)'
                        : 'var(--color-surface-container)',
                      color: data.is_gap_detected
                        ? 'var(--color-status-unknown-text)'
                        : 'var(--color-text-primary)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: '18px',
                        color: data.is_gap_detected
                          ? 'var(--color-status-unknown-solid)'
                          : 'var(--color-primary)',
                      }}
                    >
                      {data.is_gap_detected ? 'warning' : 'info'}
                    </span>
                    <div>
                      <strong>Why Included: </strong>
                      {data.why_included}
                    </div>
                  </div>
                )}
              </div>

              {/* Properties Table */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '10px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Stored Graph Properties
                </h3>
                <div
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                      {Object.entries(data.properties).map(([key, val], idx) => (
                        <tr
                          key={key}
                          style={{
                            borderBottom:
                              idx < Object.entries(data.properties).length - 1
                                ? '1px solid var(--color-border)'
                                : 'none',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : 'var(--color-canvas-bg)',
                          }}
                        >
                          <td
                            style={{
                              padding: '8px 12px',
                              fontWeight: 500,
                              color: 'var(--color-text-secondary)',
                              width: '35%',
                            }}
                          >
                            {key}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ padding: '8px 12px', color: 'var(--color-text-primary)' }}
                          >
                            {typeof val === 'object' && val !== null
                              ? JSON.stringify(val)
                              : String(val)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Connected Relationships */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '10px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Graph Relationships ({data.incoming_relationships.length + data.outgoing_relationships.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.outgoing_relationships.map((rel: RelationshipInfo, i: number) => (
                    <div
                      key={`out-${i}`}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                          arrow_forward
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          -[:{rel.relationship_type}]-&gt;
                        </span>
                        <span>{rel.connected_node_id}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          padding: '2px 6px',
                          backgroundColor: 'var(--color-canvas-bg)',
                          borderRadius: '4px',
                        }}
                      >
                        {rel.connected_node_label}
                      </span>
                    </div>
                  ))}

                  {data.incoming_relationships.map((rel: RelationshipInfo, i: number) => (
                    <div
                      key={`in-${i}`}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
                          arrow_back
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          &lt;-[:{rel.relationship_type}]-
                        </span>
                        <span>{rel.connected_node_id}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          padding: '2px 6px',
                          backgroundColor: 'var(--color-canvas-bg)',
                          borderRadius: '4px',
                        }}
                      >
                        {rel.connected_node_label}
                      </span>
                    </div>
                  ))}

                  {data.incoming_relationships.length === 0 && data.outgoing_relationships.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No connected edges recorded in the active graph for this node.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  );
};
