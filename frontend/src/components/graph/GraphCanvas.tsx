import React from 'react';
import type { VisEdge, VisNode } from '../../types/api';
import { GraphBreadcrumb, type BreadcrumbItem } from './GraphBreadcrumb';

interface GraphCanvasProps {
  nodes: VisNode[];
  edges: VisEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  zoom: number;
  pathFilter: 'affected' | 'all';
  selectedCategories: string[];
  searchQuery: string;
  breadcrumbItems: BreadcrumbItem[];
  shipmentCount?: number;
  onResetZoom?: () => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges: _edges,
  selectedNodeId,
  onSelectNode,
  zoom,
  pathFilter,
  selectedCategories,
  searchQuery,
  breadcrumbItems,
  shipmentCount = 2,
}) => {
  // Category mapping
  // 'Lots' -> RawLot, FinishedLot
  // 'Shipments' -> Shipment
  // 'Suppliers' -> Supplier
  // 'Evidence' -> Evidence
  // 'Locations' -> Location
  // 'Production' -> ProductionEvent (always included unless specific filter excludes)
  const isCategoryVisible = (label: string): boolean => {
    if (selectedCategories.length === 0) return false;
    if (label === 'RawLot' || label === 'FinishedLot') return selectedCategories.includes('Lots');
    if (label === 'Shipment') return selectedCategories.includes('Shipments');
    if (label === 'Supplier') return selectedCategories.includes('Suppliers');
    if (label === 'Evidence') return selectedCategories.includes('Evidence');
    if (label === 'Location') return selectedCategories.includes('Locations');
    if (label === 'ProductionEvent') return true; // Keep transformation to link lots
    return true;
  };

  // Filter nodes based on pathFilter and selectedCategories
  const filteredNodes = nodes.filter((n) => {
    // 1. Path filter
    if (pathFilter === 'affected') {
      // In affected mode, show affected nodes + FL-SALSA-102 (marked outside) + FL-SALSA-103 (gap)
      if (!n.is_affected && n.id !== 'FL-SALSA-103' && n.id !== 'FL-SALSA-102' && n.label !== 'Supplier') {
        return false;
      }
    }

    // 2. Category filter
    if (!isCategoryVisible(n.label)) {
      return false;
    }

    return true;
  });

  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Partition into 6 stages
  const stage1Suppliers = filteredNodes.filter((n) => n.stage === 1 || n.label === 'Supplier');
  const stage2Ingredients = filteredNodes.filter((n) => n.stage === 2 || n.label === 'RawLot');
  const stage3Production = filteredNodes.filter((n) => n.stage === 3 || n.label === 'ProductionEvent');
  const stage4Finished = filteredNodes.filter((n) => n.stage === 4 || n.label === 'FinishedLot');
  const stage5Shipments = filteredNodes.filter((n) => n.stage === 5 || n.label === 'Shipment');
  const stage6Destinations = filteredNodes.filter((n) => n.stage === 6 || n.label === 'Location');
  const evidenceNodes = filteredNodes.filter((n) => n.label === 'Evidence');

  // Search match helper
  const isSearchMatch = (node: VisNode): boolean => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      node.id.toLowerCase().includes(q) ||
      node.display_name.toLowerCase().includes(q) ||
      node.label.toLowerCase().includes(q)
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E7E3D9',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '640px',
        boxShadow: '0 1px 3px rgba(36, 51, 47, 0.04)',
      }}
    >
      {/* Archival Dot Grid Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.6,
          backgroundImage: 'radial-gradient(#d5d1c5 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* 6 Stage Column Headers */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))',
          gap: '8px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(231, 227, 217, 0.7)',
          textAlign: 'center',
          overflowX: 'auto',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          1. Supplier
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          2. Ingredient lot
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          3. Production
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          4. Finished lot
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          5. Shipment
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#69736E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          6. Destination
        </div>
      </div>

      {/* Interactive Graph Zone */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          margin: '24px 0',
          minHeight: '440px',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        {/* SVG Connections Overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            minWidth: '860px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Path 1: Supplier -> Ingredient Lot (Verified Sage) */}
          {visibleNodeIds.has('SUP-APEX-01') && visibleNodeIds.has('LOT-CUM-2026-088') && (
            <path
              d="M 15% 50% C 18% 50%, 20% 50%, 23% 50%"
              fill="none"
              stroke="#579779"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Path 2: Ingredient Lot -> Production Run (Affected Coral) */}
          {visibleNodeIds.has('LOT-CUM-2026-088') && visibleNodeIds.has('PROD-EVT-4401') && (
            <path
              d="M 31% 50% C 34% 50%, 36% 50%, 40% 50%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Path 3A: Production Run -> FL-SALSA-101 (Affected Coral, branches upward) */}
          {visibleNodeIds.has('PROD-EVT-4401') && visibleNodeIds.has('FL-SALSA-101') && (
            <path
              d="M 48% 50% C 51% 50%, 53% 22%, 56% 22%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Path 3B: Production Run -> FL-SALSA-102 (Outside Recorded Path, dashed grey) */}
          {visibleNodeIds.has('PROD-EVT-4401') && visibleNodeIds.has('FL-SALSA-102') && (
            <path
              d="M 48% 50% C 51% 50%, 53% 50%, 56% 50%"
              fill="none"
              stroke="#D0CCC3"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          )}

          {/* Path 3C: Production Run -> FL-SALSA-103 (Needs Review, Missing Link Lavender dashed) */}
          {visibleNodeIds.has('PROD-EVT-4401') && visibleNodeIds.has('FL-SALSA-103') && (
            <path
              d="M 48% 50% C 51% 50%, 53% 78%, 56% 78%"
              fill="none"
              stroke="#9682CE"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          )}

          {/* Path 4A: FL-SALSA-101 -> SHIP-8821 (Affected Coral) */}
          {visibleNodeIds.has('FL-SALSA-101') && visibleNodeIds.has('SHIP-8821') && (
            <path
              d="M 64.5% 22% C 67% 22%, 69% 28%, 73% 28%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Path 4B: FL-SALSA-101 -> SHIP-8822 (Affected Coral) */}
          {visibleNodeIds.has('FL-SALSA-101') && visibleNodeIds.has('SHIP-8822') && (
            <path
              d="M 64.5% 22% C 67% 22%, 69% 68%, 73% 68%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Path 5A: SHIP-8821 -> Northgate DC / LOC-RETAIL-ALPHA (Affected Coral) */}
          {visibleNodeIds.has('SHIP-8821') && (
            <path
              d="M 81.5% 28% C 84% 28%, 86% 28%, 89.5% 28%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Path 5B: SHIP-8822 -> Lakeside Retail Hub / LOC-RETAIL-BETA (Affected Coral) */}
          {visibleNodeIds.has('SHIP-8822') && (
            <path
              d="M 81.5% 68% C 84% 68%, 86% 68%, 89.5% 68%"
              fill="none"
              stroke="#E77861"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Missing Link Floating Badge on the Lavender line */}
        {visibleNodeIds.has('FL-SALSA-103') && (
          <div
            style={{
              position: 'absolute',
              left: '50.5%',
              top: '65%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: '#F4F1FB',
                border: '1px solid #DED5F5',
                color: '#4E3C8A',
                boxShadow: '0 1px 3px rgba(78, 60, 138, 0.1)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#9682CE',
                }}
              />
              Missing link
            </span>
          </div>
        )}

        {/* 6 Column Node Grid Placement */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))',
            gap: '8px',
            zIndex: 10,
          }}
        >
          {/* Col 1: Supplier Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            {stage1Suppliers.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    maxWidth: '150px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: '4px solid #579779',
                    padding: '12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#579779', fontSize: '16px' }}>
                      domain
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#245842',
                        backgroundColor: '#EEF6F2',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      Supplier
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.display_name || 'Apex Spice Co.'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.id} • Austin, TX-4
                  </div>
                </div>
              );
            })}
          </div>

          {/* Col 2: Ingredient Lot Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            {stage2Ingredients.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              const isSource = n.is_affected || n.id === 'LOT-CUM-2026-088';
              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    maxWidth: '155px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: isSource ? '4px solid #E77861' : '4px solid #579779',
                    padding: '12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: isSource ? '#E77861' : '#579779', fontSize: '16px' }}>
                      grain
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        borderRadius: '9999px',
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: isSource ? '#FDF0ED' : '#EEF6F2',
                        color: isSource ? '#8E2F1C' : '#245842',
                      }}
                    >
                      {isSource && (
                        <span
                          className="animate-pulse"
                          style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E77861' }}
                        />
                      )}
                      {isSource ? 'Source lot' : 'Control'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.display_name || 'Cumin extract 50kg'}
                  </div>
                </div>
              );
            })}

            {evidenceNodes.map((ev) => {
              const isSelected = selectedNodeId === ev.id;
              const matchesSearch = isSearchMatch(ev);
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectNode(ev.id)}
                  style={{
                    width: '100%',
                    maxWidth: '155px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: '4px solid #337A68',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#337A68', fontSize: '15px' }}>
                      description
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#245842',
                        backgroundColor: '#EEF6F2',
                        padding: '2px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      Evidence
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.display_name || 'COA Lab Report'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Col 3: Production Run Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            {stage3Production.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              const isAff = n.is_affected || n.id === 'PROD-EVT-4401';
              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    maxWidth: '150px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: isAff ? '4px solid #E77861' : '4px solid #579779',
                    padding: '12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: isAff ? '#E77861' : '#579779', fontSize: '16px' }}>
                      science
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: isAff ? '#8E2F1C' : '#245842',
                        backgroundColor: isAff ? '#FDF0ED' : '#EEF6F2',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      Transformation
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.display_name || 'Salsa blend run'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.id}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Col 4: Finished Lots (Stacked: 101, 102, 103) */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
            {stage4Finished.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              const is101 = n.id === 'FL-SALSA-101';
              const is102 = n.id === 'FL-SALSA-102';
              const is103 = n.id === 'FL-SALSA-103';

              let borderLeft = '4px solid #E77861';
              let badgeColor = '#8E2F1C';
              let badgeBg = '#FDF0ED';
              let badgeLabel = 'Affected';

              if (is102) {
                borderLeft = '4px solid #BEC9C4';
                badgeColor = '#69736E';
                badgeBg = '#FAF6EC';
                badgeLabel = 'Control';
              } else if (is103) {
                borderLeft = '4px solid #D9A638';
                badgeColor = '#7A570C';
                badgeBg = '#FEF8E8';
                badgeLabel = 'Review';
              }

              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    backgroundColor: is102 ? 'rgba(250, 246, 236, 0.6)' : '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: is102 ? 0.85 : searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: is101 ? '#E77861' : is103 ? '#D9A638' : '#69736E',
                          fontSize: '15px',
                        }}
                      >
                        inventory_2
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.id}
                      </span>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: '9px',
                        fontWeight: 700,
                        color: badgeColor,
                        backgroundColor: badgeBg,
                        padding: '2px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#69736E', lineHeight: 1.2 }}>
                    {is102 ? 'Outside recorded path. Not safe.' : n.display_name || '16oz Salsa'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Col 5: Shipments (Stacked) */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '8px 0', gap: '16px' }}>
            {stage5Shipments.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              const isAff = n.is_affected || n.id === 'SHIP-8821' || n.id === 'SHIP-8822';
              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: isAff ? '4px solid #E77861' : '4px solid #579779',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ color: isAff ? '#E77861' : '#579779', fontSize: '16px' }}>
                      local_shipping
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: isAff ? '#8E2F1C' : '#245842',
                        backgroundColor: isAff ? '#FDF0ED' : '#EEF6F2',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {isAff ? 'Affected' : 'Verified'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.id === 'SHIP-8821' ? '420 cases • Refrig. Express' : n.id === 'SHIP-8822' ? '380 cases • Carrier Line' : n.display_name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Col 6: Destinations (Stacked) */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '8px 0', gap: '16px' }}>
            {stage6Destinations.map((n) => {
              const isSelected = selectedNodeId === n.id;
              const matchesSearch = isSearchMatch(n);
              const isDistributor = n.id === 'LOC-RETAIL-ALPHA' || n.display_name.includes('Pacific') || n.display_name.includes('Northgate');
              return (
                <div
                  key={n.id}
                  onClick={() => onSelectNode(n.id)}
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E7E3D9',
                    borderLeft: '4px solid #E77861',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px #337A68, 0 4px 12px rgba(36, 51, 47, 0.12)' : '0 1px 3px rgba(36, 51, 47, 0.04)',
                    outline: matchesSearch ? '2px solid #D9A638' : 'none',
                    opacity: searchQuery && !matchesSearch ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#E77861', fontSize: '16px' }}>
                      {isDistributor ? 'storefront' : 'store'}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: '#8E2F1C',
                        backgroundColor: '#FDF0ED',
                        padding: '2px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {isDistributor ? 'Distributor' : 'Retail'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#24332F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isDistributor ? 'Northgate DC' : 'Lakeside Retail Hub'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#69736E', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isDistributor ? 'Austin, TX (Node 12)' : 'San Antonio, TX'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Graph Card Footer (Legend & Slim Coral Path Bar) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(231, 227, 217, 0.6)',
        }}
      >
        {/* Legend Chips Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E77861' }} />
            <span style={{ color: '#24332F', fontWeight: 500 }}>Affected path</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#579779' }} />
            <span style={{ color: '#24332F', fontWeight: 500 }}>Record verified</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#D9A638' }} />
            <span style={{ color: '#24332F', fontWeight: 500 }}>Needs review</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9682CE' }} />
            <span style={{ color: '#24332F', fontWeight: 500 }}>Unknown link</span>
          </div>
        </div>

        {/* Path Breadcrumb Bar */}
        <GraphBreadcrumb
          items={breadcrumbItems}
          onSelectNode={onSelectNode}
          shipmentCount={shipmentCount}
        />
      </div>
    </div>
  );
};
