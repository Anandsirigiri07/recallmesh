import React, { useState } from 'react';
import type { GraphVisResponse, VisNode } from '../../types/api';

interface TraceabilityGraphCanvasProps {
  graphData: GraphVisResponse | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  rootLotCode: string;
}

// Stage configuration matching Stitch design
const STAGES = [
  { id: 1, name: '01. Supplier' },
  { id: 2, name: '02. Ing. Lot' },
  { id: 3, name: '03. Production' },
  { id: 4, name: '04. Finished Lot' },
  { id: 5, name: '05. Shipment' },
  { id: 6, name: '06. Destination' },
];

export const TraceabilityGraphCanvas: React.FC<TraceabilityGraphCanvasProps> = ({
  graphData,
  loading,
  error,
  selectedNodeId,
  onSelectNode,
  rootLotCode,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [filterType, setFilterType] = useState<'ALL' | 'AFFECTED' | 'GAPS'>('ALL');
  const [isAgentNotesOpen, setIsAgentNotesOpen] = useState(false);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.7));
  const handleZoomReset = () => setZoomLevel(1.0);

  if (loading) {
    return (
      <div
        className="bg-surface-container-lowest rounded-xl shadow-sm p-8 text-center"
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: 'var(--color-primary)' }}>
          progress_activity
        </span>
        <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
          Building 6-stage FSMA 204 directional trace...
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Querying verified nodes and transformation edges from FalkorDB
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-surface-container-lowest rounded-xl shadow-sm p-8 text-center"
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-status-affected-solid)' }}>
          error
        </span>
        <div style={{ marginTop: '12px', fontSize: '15px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
          Failed to load graph visualization
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', maxWidth: '400px' }}>
          {error}
        </div>
      </div>
    );
  }

  const nodes = graphData?.nodes || [];

  // Group nodes by stage (1..6) considering filter
  const stageNodes: Record<number, VisNode[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  nodes.forEach((n) => {
    // Apply filter: ALL, AFFECTED, or GAPS
    const matchesFilter =
      filterType === 'ALL' ||
      (filterType === 'AFFECTED' && n.is_affected) ||
      (filterType === 'GAPS' && (n.is_gap || n.id === 'FL-SALSA-103'));

    if (matchesFilter && n.stage && n.stage >= 1 && n.stage <= 6) {
      stageNodes[n.stage].push(n);
    }
  });

  // Unplaced nodes (if any)
  const unplacedNodes = nodes.filter((n) => !n.stage || n.stage < 1 || n.stage > 6);

  // Helper to determine node visual badge & styling
  const getNodeVisuals = (node: VisNode) => {
    const isSelected = node.id === selectedNodeId;
    const isGap = node.is_gap || node.id === 'FL-SALSA-103' || node.traceability_status === 'GAP_DETECTED';
    const isAffected = node.is_affected;

    let borderLeftColor = 'var(--color-border-subtle)';
    let headerIcon = 'inventory_2';
    let headerCategory = 'Trace Node';
    let headerColor = 'var(--color-text-secondary)';
    let badgeText = '';
    let badgeBg = 'transparent';
    let badgeColor = 'transparent';

    if (node.stage === 1) {
      borderLeftColor = 'var(--color-status-verified-solid)';
      headerIcon = 'domain';
      headerCategory = 'CTE: SOURCE';
      headerColor = 'var(--color-status-verified-text)';
    } else if (node.stage === 2) {
      if (node.id === 'LOT-CUM-2026-088') {
        borderLeftColor = 'var(--color-status-affected-solid)';
        headerIcon = 'eco';
        headerCategory = 'TAINTED';
        headerColor = 'var(--color-status-affected-text)';
        badgeText = 'Suspect';
        badgeBg = 'var(--color-status-affected-tint)';
        badgeColor = 'var(--color-status-affected-text)';
      } else {
        borderLeftColor = 'var(--color-status-verified-solid)';
        headerIcon = 'eco';
        headerCategory = 'CONTROL';
        headerColor = 'var(--color-status-verified-text)';
        badgeText = 'Clean';
        badgeBg = 'var(--color-status-verified-tint)';
        badgeColor = 'var(--color-status-verified-text)';
      }
    } else if (node.stage === 3) {
      borderLeftColor = node.is_affected ? 'var(--color-status-affected-solid)' : 'var(--color-border-subtle)';
      headerIcon = 'blender';
      headerCategory = 'TRANSFORM';
      headerColor = node.is_affected ? 'var(--color-status-affected-text)' : 'var(--color-text-secondary)';
    } else if (node.stage === 4) {
      if (isGap) {
        borderLeftColor = 'var(--color-status-unknown-solid)';
        headerIcon = 'help_center';
        headerCategory = 'MISSING LINK';
        headerColor = 'var(--color-status-unknown-text)';
        badgeText = 'Review';
        badgeBg = 'var(--color-status-unknown-tint)';
        badgeColor = 'var(--color-status-unknown-text)';
      } else if (isAffected) {
        borderLeftColor = 'var(--color-status-affected-solid)';
        headerIcon = 'takeout_dining';
        headerCategory = 'AFFECTED';
        headerColor = 'var(--color-status-affected-text)';
        badgeText = 'Affected';
        badgeBg = 'var(--color-status-affected-tint)';
        badgeColor = 'var(--color-status-affected-text)';
      } else {
        borderLeftColor = 'var(--color-border-subtle)';
        headerIcon = 'inventory_2';
        headerCategory = 'CONTROL PATH';
        headerColor = 'var(--color-text-secondary)';
        badgeText = 'Outside Path';
        badgeBg = 'var(--color-surface-low)';
        badgeColor = 'var(--color-text-secondary)';
      }
    } else if (node.stage === 5) {
      borderLeftColor = isAffected ? 'var(--color-status-affected-solid)' : 'var(--color-border-subtle)';
      headerIcon = 'local_shipping';
      headerCategory = 'DISPATCHED';
      headerColor = isAffected ? 'var(--color-status-affected-text)' : 'var(--color-text-secondary)';
    } else if (node.stage === 6) {
      borderLeftColor = isAffected ? 'var(--color-status-affected-solid)' : 'var(--color-border-subtle)';
      headerIcon = node.display_name.toLowerCase().includes('retail') ? 'storefront' : 'warehouse';
      headerCategory = isAffected ? 'AT RISK NODE' : 'DISTRIBUTED';
      headerColor = isAffected ? 'var(--color-status-affected-text)' : 'var(--color-text-secondary)';
    }

    return {
      isSelected,
      isGap,
      isAffected,
      borderLeftColor,
      headerIcon,
      headerCategory,
      headerColor,
      badgeText,
      badgeBg,
      badgeColor,
    };
  };

  return (
    <div
      className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Canvas Toolbar */}
      <div
        className="flex items-center justify-between px-space-md py-2.5 bg-surface-container-low/40"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: 'var(--color-surface-low)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom in"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add
            </span>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom out"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              remove
            </span>
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            title="Fit to screen"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              crop_free
            </span>
          </button>

          <div style={{ height: '16px', width: '1px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Layout: Directional CTE Trace ({Math.round(zoomLevel * 100)}%)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Node Filter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: filterType === 'ALL' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: filterType === 'ALL' ? 'var(--color-primary-tint)' : 'var(--color-surface-card)',
                color: filterType === 'ALL' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              All ({nodes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('AFFECTED')}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: filterType === 'AFFECTED' ? '1px solid var(--color-status-affected-solid)' : '1px solid var(--color-border)',
                backgroundColor: filterType === 'AFFECTED' ? 'var(--color-status-affected-tint)' : 'var(--color-surface-card)',
                color: filterType === 'AFFECTED' ? 'var(--color-status-affected-text)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Affected
            </button>
            <button
              type="button"
              onClick={() => setFilterType('GAPS')}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: filterType === 'GAPS' ? '1px solid var(--color-status-unknown-solid)' : '1px solid var(--color-border)',
                backgroundColor: filterType === 'GAPS' ? 'var(--color-status-unknown-tint)' : 'var(--color-surface-card)',
                color: filterType === 'GAPS' ? 'var(--color-status-unknown-text)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Gaps (1)
            </button>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-surface-container)',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
              verified
            </span>
            FDA FSMA 204 Active CTE Trace
          </span>
        </div>
      </div>

      {/* Canvas Body with Dot Grid & Scrollable Workspace */}
      <div
        className="relative w-full overflow-x-auto min-h-[580px] p-6"
        style={{
          backgroundImage: 'radial-gradient(#d5d1c8 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          padding: '24px',
          overflowX: 'auto',
          minHeight: '540px',
          backgroundColor: 'var(--color-canvas-bg)',
        }}
      >
        <div
          style={{
            minWidth: '960px',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Column Headers: 6 Steps */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {STAGES.map((s) => (
              <div
                key={s.id}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.04em',
                }}
              >
                {s.name}
              </div>
            ))}
          </div>

          {/* 6-Stage Columns Grid with Rendered Nodes */}
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '16px',
              minHeight: '420px',
            }}
          >
            {/* SVG Connecting Curves Overlay */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {/* 1. Supplier (Apex) -> Raw Lot (088) */}
              <path
                d="M 130 50 C 145 50, 155 50, 175 50"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
              {/* 2. Raw Lot (088) -> Production Event (4401) */}
              <path
                d="M 290 50 C 305 50, 315 50, 335 50"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
              {/* 3. Production Event (4401) -> FL-SALSA-101 (Affected) */}
              <path
                d="M 450 50 C 465 50, 475 35, 495 35"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
              {/* 4. Production Event -> FL-SALSA-102 (Clean Control) */}
              <path
                d="M 450 50 C 465 50, 475 145, 495 145"
                fill="none"
                stroke="#bec9c4"
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />
              {/* 5. Production Event -> FL-SALSA-103 (EXPLICIT MISSING-LINK INDICATOR) */}
              <path
                d="M 450 50 C 465 50, 475 255, 495 255"
                fill="none"
                stroke="#933927"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />

              {/* 6. FL-SALSA-101 -> SHIP-8821 */}
              <path
                d="M 610 35 C 625 35, 635 25, 655 25"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
              {/* 7. FL-SALSA-101 -> SHIP-8822 */}
              <path
                d="M 610 35 C 625 35, 635 125, 655 125"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />

              {/* 8. SHIP-8821 -> Destination 1 (Northgate DC) */}
              <path
                d="M 770 25 C 785 25, 795 25, 815 25"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
              {/* 9. SHIP-8822 -> Destination 2 (Lakeside Retail Hub) */}
              <path
                d="M 770 125 C 785 125, 795 125, 815 125"
                fill="none"
                stroke={rootLotCode === 'LOT-CUM-2026-088' ? '#ba1a1a' : '#bec9c4'}
                strokeWidth={rootLotCode === 'LOT-CUM-2026-088' ? '2' : '1.5'}
              />
            </svg>

            {/* Stages Columns (1 to 6) */}
            {STAGES.map((stage) => {
              const currentStageNodes = stageNodes[stage.id] || [];
              return (
                <div
                  key={stage.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    zIndex: 2,
                  }}
                >
                  {currentStageNodes.map((node) => {
                    const visuals = getNodeVisuals(node);
                    const isFL103 = node.id === 'FL-SALSA-103';

                    return (
                      <div
                        key={node.id}
                        onClick={() => onSelectNode(node.id)}
                        style={{
                          position: 'relative',
                          backgroundColor: 'var(--color-surface-card)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '10px 12px',
                          border: visuals.isSelected
                            ? '2px solid var(--color-primary)'
                            : '1px solid var(--color-border)',
                          boxShadow: visuals.isSelected ? 'var(--shadow-elevated)' : 'var(--shadow-card)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          overflow: 'visible',
                        }}
                      >
                        {/* Primary Indicator Bar on Left Edge */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: visuals.isSelected ? '5px' : '4px',
                            backgroundColor: visuals.borderLeftColor,
                            borderTopLeftRadius: 'var(--radius-lg)',
                            borderBottomLeftRadius: 'var(--radius-lg)',
                          }}
                        />

                        {/* Floating Missing Link Badge (Strict Stitch Design) */}
                        {isFL103 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '-12px',
                              left: '-16px',
                              padding: '2px 8px',
                              backgroundColor: 'var(--color-status-unknown-solid)',
                              color: '#FFFFFF',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              whiteSpace: 'nowrap',
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
                              link_off
                            </span>
                            Missing link indicator
                          </div>
                        )}

                        {/* Node Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: '15px', color: visuals.headerColor }}
                            >
                              {visuals.headerIcon}
                            </span>
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: visuals.headerColor,
                                letterSpacing: '0.04em',
                              }}
                            >
                              {visuals.headerCategory}
                            </span>
                          </div>

                          {visuals.badgeText && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-xs)',
                                backgroundColor: visuals.badgeBg,
                                color: visuals.badgeColor,
                              }}
                            >
                              {visuals.badgeText}
                            </span>
                          )}
                        </div>

                        {/* Node Title / ID */}
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {node.id}
                        </div>

                        {/* Node Subtitle / Product Name / Count */}
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-secondary)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {node.display_name !== node.id ? node.display_name : node.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Unplaced Nodes Warning Bar (Requirement 4) */}
          {unplacedNodes.length > 0 && (
            <div
              style={{
                marginTop: '16px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-low)',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
              }}
            >
              <strong>Unplaced Nodes ({unplacedNodes.length}):</strong>{' '}
              {unplacedNodes.map((n) => n.id).join(', ')} (Categorized outside stages 1–6)
            </div>
          )}
        </div>
      </div>

      {/* Collapsed Bar: Agent Explainability (Stitch Design) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <button
          type="button"
          onClick={() => setIsAgentNotesOpen((prev) => !prev)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
              neurology
            </span>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                How the agent found this
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                — Agent synthesis based on 3 Critical Tracking Events and supplier Bill of Lading
              </span>
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '18px',
              color: 'var(--color-text-secondary)',
              transform: isAgentNotesOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            expand_more
          </span>
        </button>

        {isAgentNotesOpen && (
          <div
            style={{
              paddingTop: '12px',
              marginTop: '12px',
              borderTop: '1px solid var(--color-border)',
              fontSize: '12px',
              lineHeight: '1.5',
              color: 'var(--color-text-secondary)',
            }}
          >
            Automated graph traversal resolved BOL-TX-48902 timestamped 2026-10-23T08:14Z with batch intake logs.
            Transformation CTE TR-9042 matches 50kg extraction inputs directly with batch lot salsa yield output.
            All downstream shipment manifests are correlated against the Electronic Traceability Ledger.
            Notice: Finished lot <strong>FL-SALSA-103</strong> has no incoming Transformation CTE link,
            prompting mandatory review under FSMA Rule 204.
          </div>
        )}
      </div>
    </div>
  );
};
