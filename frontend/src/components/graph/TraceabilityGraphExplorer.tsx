import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import type { VisNode, VisEdge, NodeInspectorResponse, EvidenceRequestResponse } from '../../types/api';
import { GraphToolbar } from './GraphToolbar';
import { GraphCanvas } from './GraphCanvas';
import { GraphInspectorDock } from './GraphInspectorDock';
import { SupplierRequestModal } from '../common/SupplierRequestModal';
import { Modal } from '../common/Modal';

interface TraceabilityGraphExplorerProps {
  datasetId?: string;
  activeRootLot?: string;
  onNavigateToOverview?: () => void;
  onNavigateToInvestigation?: () => void;
}

export const TraceabilityGraphExplorer: React.FC<TraceabilityGraphExplorerProps> = ({
  datasetId,
  activeRootLot,
  onNavigateToOverview: _onNavigateToOverview,
  onNavigateToInvestigation: _onNavigateToInvestigation,
}) => {
  // State
  const [pathFilter, setPathFilter] = useState<'affected' | 'all'>('affected');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Lots',
    'Shipments',
    'Suppliers',
    'Evidence',
    'Locations',
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rootLotId, setRootLotId] = useState(activeRootLot || 'LOT-CUM-2026-088');

  // Sync rootLotId when activeRootLot changes from header/dataset switch
  useEffect(() => {
    if (activeRootLot) {
      setRootLotId(activeRootLot);
    }
  }, [activeRootLot]);

  // Graph Data
  const [nodes, setNodes] = useState<VisNode[]>([]);
  const [edges, setEdges] = useState<VisEdge[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Inspector Data
  const [inspectorDetails, setInspectorDetails] = useState<NodeInspectorResponse | null>(null);
  const [isInspectorLoading, setIsInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);

  // Modal Workflows
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierModalLot, setSupplierModalLot] = useState('FL-SALSA-103');
  const [supplierModalSupplier, setSupplierModalSupplier] = useState('Apex Spice Co. (Supplier TX-4)');

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditModalNodeId, setAuditModalNodeId] = useState<string>('');

  // 1. Fetch Graph Visualization Data
  const fetchGraphData = useCallback(async (lotCode: string, dsId?: string) => {
    setIsLoadingGraph(true);
    setGraphError(null);
    try {
      const vis = dsId ? await apiClient.getGraphVis(lotCode, dsId) : await apiClient.getGraphVis(lotCode);
      setNodes(vis.nodes || []);
      setEdges(vis.edges || []);
    } catch (err: any) {
      setGraphError(err.message || 'Failed to load graph visualization from local FalkorDB instance.');
    } finally {
      setIsLoadingGraph(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData(rootLotId, datasetId);
  }, [fetchGraphData, rootLotId, datasetId]);

  // 2. Fetch Inspector Details when selectedNodeId changes
  useEffect(() => {
    if (!selectedNodeId) {
      setInspectorDetails(null);
      setInspectorError(null);
      return;
    }

    let isCurrent = true;
    setIsInspectorLoading(true);
    setInspectorError(null);

    const inspectorPromise = datasetId
      ? apiClient.getNodeInspector(selectedNodeId, datasetId)
      : apiClient.getNodeInspector(selectedNodeId);

    inspectorPromise
      .then((data) => {
        if (isCurrent) {
          setInspectorDetails(data);
        }
      })
      .catch((err: any) => {
        if (isCurrent) {
          setInspectorError(err.message || `Failed to retrieve node inspector for ID ${selectedNodeId}`);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsInspectorLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedNodeId, datasetId]);

  // Category Toggle
  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // Zoom Controls
  const handleZoomIn = () => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.65, +(z - 0.15).toFixed(2)));
  const handleFitToScreen = () => setZoom(1.0);
  const handleReset = () => {
    setZoom(1.0);
    setSearchQuery('');
    setSelectedNodeId(null);
    setSelectedCategories(['Lots', 'Shipments', 'Suppliers', 'Evidence', 'Locations']);
  };

  // Selected Node
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Breadcrumb derivation
  const getBreadcrumbItems = () => {
    if (!selectedNodeId) {
      return [
        { id: 'LOT-CUM-2026-088', label: 'LOT-CUM-2026-088' },
        { id: 'PROD-EVT-4401', label: 'Salsa blend run' },
        { id: 'FL-SALSA-101', label: 'FL-SALSA-101' },
        { id: 'SHIP-8821', label: 'SHIP-8821' },
        { id: 'LOC-RETAIL-ALPHA', label: 'Northgate DC', isDestination: true },
      ];
    }

    if (selectedNodeId === 'FL-SALSA-103') {
      return [
        { id: 'LOT-CUM-2026-088', label: 'LOT-CUM-2026-088' },
        { id: 'PROD-EVT-4401', label: 'Salsa blend run' },
        { id: 'FL-SALSA-103', label: 'FL-SALSA-103 (Review / Gap)', isDestination: true },
      ];
    }

    if (selectedNodeId === 'SHIP-8822' || selectedNodeId === 'LOC-RETAIL-BETA') {
      return [
        { id: 'LOT-CUM-2026-088', label: 'LOT-CUM-2026-088' },
        { id: 'PROD-EVT-4401', label: 'Salsa blend run' },
        { id: 'FL-SALSA-101', label: 'FL-SALSA-101' },
        { id: 'SHIP-8822', label: 'SHIP-8822' },
        { id: 'LOC-RETAIL-BETA', label: 'Lakeside Retail Hub', isDestination: true },
      ];
    }

    if (selectedNodeId === 'LOT-CUM-2026-090' || selectedNodeId === 'FL-SALSA-102') {
      return [
        { id: 'LOT-CUM-2026-090', label: 'LOT-CUM-2026-090 (Clean Control)' },
        { id: 'PROD-EVT-4402', label: 'PROD-EVT-4402' },
        { id: 'FL-SALSA-102', label: 'FL-SALSA-102', isDestination: true },
      ];
    }

    return [
      { id: 'LOT-CUM-2026-088', label: 'LOT-CUM-2026-088' },
      { id: 'PROD-EVT-4401', label: 'Salsa blend run' },
      { id: selectedNodeId, label: selectedNode?.display_name || selectedNodeId, isDestination: true },
    ];
  };

  return (
    <div
      className="traceability-graph-explorer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
      }}
    >
      {/* Top Toolbar */}
      <GraphToolbar
        pathFilter={pathFilter}
        onPathFilterChange={setPathFilter}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        onReset={handleReset}
      />

      {/* Main Content Grid: Big Graph Area (Left/Center) + Inspector Dock (Right) */}
      <div
        className="traceability-graph-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '24px',
          alignItems: 'start',
          width: '100%',
        }}
      >
        {/* Left/Center Graph Area */}
        <div style={{ minWidth: 0, width: '100%' }}>
          {isLoadingGraph ? (
            <div
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E7E3D9',
                padding: '60px 24px',
                textAlign: 'center',
                color: '#69736E',
                minHeight: '640px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: '#337A68' }}>
                progress_activity
              </span>
              <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 500, color: '#24332F' }}>
                Loading Traceability Property Graph...
              </p>
              <p style={{ marginTop: '4px', fontSize: '12px', color: '#69736E' }}>
                Querying CTE lineage events from local FalkorDB instance
              </p>
            </div>
          ) : graphError ? (
            <div
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #F8D2CB',
                padding: '40px 24px',
                textAlign: 'center',
                color: '#8E2F1C',
                minHeight: '640px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#E77861' }}>
                cloud_off
              </span>
              <h3 style={{ marginTop: '12px', fontSize: '16px', fontWeight: 600 }}>Graph Service Unavailable</h3>
              <p style={{ marginTop: '6px', fontSize: '13px', maxWidth: '420px', color: '#69736E' }}>
                {graphError}
              </p>
              <button
                type="button"
                onClick={() => fetchGraphData(rootLotId)}
                style={{
                  marginTop: '16px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#337A68',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
              zoom={zoom}
              pathFilter={pathFilter}
              selectedCategories={selectedCategories}
              searchQuery={searchQuery}
              breadcrumbItems={getBreadcrumbItems()}
              shipmentCount={2}
            />
          )}
        </div>

        {/* Right Inspector Dock */}
        <div style={{ width: '100%' }}>
          <GraphInspectorDock
            selectedNode={selectedNode}
            inspectorDetails={inspectorDetails}
            isLoading={isInspectorLoading}
            error={inspectorError}
            onOpenEvidenceRequest={(targetLot, defaultSupplier) => {
              setSupplierModalLot(targetLot);
              if (defaultSupplier) setSupplierModalSupplier(defaultSupplier);
              setIsSupplierModalOpen(true);
            }}
            onViewAuditPacket={(nodeId) => {
              setAuditModalNodeId(nodeId);
              setIsAuditModalOpen(true);
            }}
            onClose={() => setSelectedNodeId(null)}
          />
        </div>
      </div>

      {/* Supplier Request Simulation Modal */}
      {isSupplierModalOpen && (
        <SupplierRequestModal
          isOpen={isSupplierModalOpen}
          onClose={() => setIsSupplierModalOpen(false)}
          defaultLotCode={supplierModalLot}
          defaultSupplier={supplierModalSupplier}
          onRequestSuccess={(_res: EvidenceRequestResponse) => {
            setIsSupplierModalOpen(false);
          }}
        />
      )}

      {/* FSMA Audit Packet Details Modal */}
      {isAuditModalOpen && (
        <Modal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          title={`FSMA 204 Audit Packet — ${auditModalNodeId}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#EEF6F2',
                borderRadius: '8px',
                border: '1px solid #CFE5DB',
                color: '#245842',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  verified_user
                </span>
                <span>Cryptographic Chain-of-Custody Verified</span>
              </div>
              <p style={{ marginTop: '4px', fontSize: '12px', color: '#245842' }}>
                All Critical Tracking Events (CTEs) and Key Data Elements (KDEs) conform strictly to FDA Food Safety Modernization Act Section 204 requirements.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: '#FAF6EC', borderRadius: '8px', border: '1px solid #E7E3D9' }}>
                <span style={{ fontSize: '11px', color: '#69736E', textTransform: 'uppercase' }}>Ledger Status</span>
                <p style={{ fontWeight: 600, color: '#24332F', marginTop: '2px' }}>Immutable Local Record</p>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#FAF6EC', borderRadius: '8px', border: '1px solid #E7E3D9' }}>
                <span style={{ fontSize: '11px', color: '#69736E', textTransform: 'uppercase' }}>Target Entity</span>
                <p style={{ fontWeight: 600, color: '#24332F', marginTop: '2px' }}>{auditModalNodeId}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#337A68',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Close Audit Packet
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
