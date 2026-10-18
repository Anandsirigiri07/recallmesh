import React from 'react';
import type { NodeInspectorResponse, VisNode } from '../../types/api';

interface GraphInspectorDockProps {
  selectedNode: VisNode | null;
  inspectorDetails: NodeInspectorResponse | null;
  isLoading: boolean;
  error: string | null;
  onOpenEvidenceRequest: (targetLot: string, defaultSupplier?: string) => void;
  onViewAuditPacket: (nodeId: string) => void;
  onClose: () => void;
}

export const GraphInspectorDock: React.FC<GraphInspectorDockProps> = ({
  selectedNode,
  inspectorDetails,
  isLoading,
  error,
  onOpenEvidenceRequest,
  onViewAuditPacket,
  onClose,
}) => {
  // If no node selected, show Stitch empty state
  if (!selectedNode) {
    return (
      <div
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E7E3D9',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: '640px',
          boxShadow: '0 1px 3px rgba(36, 51, 47, 0.04)',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#EEF6F2',
            border: '1px solid #CFE5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            marginTop: 'auto',
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#34654F', fontSize: '30px' }}>
            touch_app
          </span>
        </div>

        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#24332F',
            letterSpacing: '-0.01em',
          }}
        >
          Click any card to see its details here.
        </h2>

        <p
          style={{
            fontSize: '13px',
            color: '#69736E',
            marginTop: '10px',
            lineHeight: 1.5,
            maxWidth: '260px',
          }}
        >
          Select an ingredient lot, transformation event, shipment, or facility node to view FSMA 204 critical tracking events and audit provenance.
        </p>

        {/* Persistent Tip Pill at Bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '24px', width: '100%' }}>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FAF6EC',
              border: '1px solid #E7E3D9',
              borderRadius: '12px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span
                className="material-symbols-outlined"
                style={{ color: '#337A68', fontSize: '16px', flexShrink: 0, marginTop: '2px' }}
              >
                tips_and_updates
              </span>
              <p style={{ fontSize: '12px', color: '#24332F', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600, color: '#337A68' }}>Tip:</span> Active filter is currently isolating the contaminated lot forward trace.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Derive badge styling
  let badgeText = 'RECORD VERIFIED';
  let badgeStyle = {
    backgroundColor: '#EEF6F2',
    color: '#245842',
    border: '1px solid #CFE5DB',
  };
  let cteText = 'CTE-R-8801 (Initial Harvest & Pack)';
  let refText = 'FSMA Section 204 Compliant Ledger';
  let statusText = 'Clean Trace Completed';

  const isGap = selectedNode.is_gap || inspectorDetails?.is_gap_detected || selectedNode.id === 'FL-SALSA-103';

  if (isGap) {
    badgeText = 'GAP DETECTED';
    badgeStyle = {
      backgroundColor: '#F4F1FB',
      color: '#4E3C8A',
      border: '1px solid #DED5F5',
    };
    cteText = 'CTE-T-4920 (Batch Splitting)';
    refText = 'FSMA Subpart S - Traceability Plan 2026';
    statusText = 'Secondary Supplier Verification Pending';
  } else if (selectedNode.is_affected) {
    badgeText = 'AFFECTED PATH';
    badgeStyle = {
      backgroundColor: '#FDF0ED',
      color: '#8E2F1C',
      border: '1px solid #F8D2CB',
    };
    cteText = 'CTE-T-4912 (Receiving / Transformation)';
    refText = 'FSMA Section 204(d)(1) Mandatory Notice';
    statusText = 'Immediate Quarantine Requested';
  } else if (selectedNode.traceability_status === 'PROVISIONAL' || selectedNode.id === 'FL-SALSA-102') {
    badgeText = 'NEEDS REVIEW';
    badgeStyle = {
      backgroundColor: '#FEF8E8',
      color: '#7A570C',
      border: '1px solid #F8E5B8',
    };
    cteText = 'CTE-T-4908 (Secondary Blend)';
    refText = 'FSMA Section 204 Control Lot Record';
    statusText = 'Isolated from Suspect Trace';
  }

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E7E3D9',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '640px',
        boxShadow: '0 1px 3px rgba(36, 51, 47, 0.04)',
        position: 'relative',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#69736E',
              letterSpacing: '0.04em',
            }}
          >
            NODE INSPECTOR
          </span>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#24332F',
              letterSpacing: '-0.01em',
              marginTop: '2px',
            }}
          >
            {selectedNode.id}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Clear selection"
          style={{
            padding: '4px',
            borderRadius: '6px',
            color: '#69736E',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>

      <p style={{ fontSize: '13px', color: '#69736E', lineHeight: 1.4, marginBottom: '16px' }}>
        {selectedNode.display_name} — Tracked under FSMA 204 CTE ledger.
      </p>

      {/* Node Metadata & Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #E7E3D9',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#69736E' }}>
          Node Metadata
        </span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '10px',
            fontWeight: 700,
            ...badgeStyle,
          }}
        >
          {badgeText}
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#69736E' }}>
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: '24px' }}>
            progress_activity
          </span>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>Loading node properties from FalkorDB...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#FDF0ED',
            border: '1px solid #F8D2CB',
            color: '#8E2F1C',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        >
          {error}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          {/* CTE Box */}
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(250, 246, 236, 0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(231, 227, 217, 0.6)',
            }}
          >
            <span style={{ color: '#69736E', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
              Critical Tracking Event
            </span>
            <span style={{ fontWeight: 600, color: '#24332F' }}>{cteText}</span>
          </div>

          {/* Reference Box */}
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(250, 246, 236, 0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(231, 227, 217, 0.6)',
            }}
          >
            <span style={{ color: '#69736E', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
              FDA FSMA 204 Reference
            </span>
            <span style={{ fontWeight: 600, color: '#24332F' }}>{refText}</span>
          </div>

          {/* Status Box */}
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(250, 246, 236, 0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(231, 227, 217, 0.6)',
            }}
          >
            <span style={{ color: '#69736E', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>
              Chain Custody Status
            </span>
            <span style={{ fontWeight: 600, color: '#24332F' }}>{statusText}</span>
          </div>

          {/* Structured Fact Rows */}
          {inspectorDetails && (
            <div
              style={{
                marginTop: '8px',
                padding: '10px',
                backgroundColor: '#FAF6EC',
                borderRadius: '8px',
                border: '1px solid #E7E3D9',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '11px',
              }}
            >
              <div>
                <span style={{ color: '#69736E' }}>Source Record: </span>
                <span style={{ fontWeight: 600, color: '#24332F' }}>
                  FalkorDB :{inspectorDetails.primary_label} Node
                </span>
              </div>
              <div>
                <span style={{ color: '#69736E' }}>Entity Type: </span>
                <span style={{ fontWeight: 600, color: '#24332F' }}>
                  {inspectorDetails.primary_label} {inspectorDetails.disposition ? `(${inspectorDetails.disposition})` : ''}
                </span>
              </div>

              {inspectorDetails.incoming_relationships.length > 0 && (
                <div>
                  <span style={{ color: '#69736E' }}>Linked From: </span>
                  <span style={{ fontWeight: 600, color: '#24332F' }}>
                    {inspectorDetails.incoming_relationships
                      .map((r) => `${r.relationship_type}: ${r.connected_node_id}`)
                      .join(', ')}
                  </span>
                </div>
              )}

              {inspectorDetails.outgoing_relationships.length > 0 && (
                <div>
                  <span style={{ color: '#69736E' }}>Linked To: </span>
                  <span style={{ fontWeight: 600, color: '#24332F' }}>
                    {inspectorDetails.outgoing_relationships
                      .map((r) => `${r.relationship_type}: ${r.connected_node_id}`)
                      .join(', ')}
                  </span>
                </div>
              )}

              {inspectorDetails.why_included && (
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #E7E3D9' }}>
                  <span style={{ color: '#69736E', fontWeight: 600 }}>Why it is included: </span>
                  <p style={{ color: '#24332F', marginTop: '2px', lineHeight: 1.4 }}>
                    {inspectorDetails.why_included}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button */}
          {isGap ? (
            <button
              type="button"
              onClick={() => onOpenEvidenceRequest(selectedNode.id, 'Apex Spice Co. (Supplier TX-4)')}
              style={{
                marginTop: '12px',
                width: '100%',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#337A68',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                assignment_late
              </span>
              Open QA evidence request
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onViewAuditPacket(selectedNode.id)}
              style={{
                marginTop: '12px',
                width: '100%',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#337A68',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                description
              </span>
              View FSMA Audit Packet
            </button>
          )}
        </div>
      )}

      {/* Persistent Tip Pill at Bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', width: '100%' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#FAF6EC',
            border: '1px solid #E7E3D9',
            borderRadius: '12px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span
              className="material-symbols-outlined"
              style={{ color: '#337A68', fontSize: '16px', flexShrink: 0, marginTop: '2px' }}
            >
              tips_and_updates
            </span>
            <p style={{ fontSize: '12px', color: '#24332F', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 600, color: '#337A68' }}>Tip:</span>{' '}
              {isGap
                ? 'Absence of a transformation link does not indicate the lot is unaffected.'
                : selectedNode.is_affected
                ? 'Active filter is currently isolating the contaminated lot forward trace.'
                : 'Control lot verified with zero pathogen trace connection.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
