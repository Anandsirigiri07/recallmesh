import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type {
  GraphVisResponse,
  CaseSummary,
  EvidenceRequestResponse,
  EvidenceUploadResponse,
} from '../../types/api';
import { CaseDetailsCard } from './CaseDetailsCard';
import { ModelEstimateCard } from './ModelEstimateCard';
import { PathLegendCard } from './PathLegendCard';
import { TraceabilityGraphCanvas } from './TraceabilityGraphCanvas';
import { NodeInspectorPanel } from './NodeInspectorPanel';
import { SupplierRequestModal } from '../common/SupplierRequestModal';
import { UploadCertificateModal } from '../common/UploadCertificateModal';

interface InvestigationWorkspaceProps {
  initialLotId?: string;
  datasetId?: string;
  activeRootLot?: string;
  onNavigateToOverview?: () => void;
  onNavigateToActionPlans?: () => void;
}

export const InvestigationWorkspace: React.FC<InvestigationWorkspaceProps> = ({
  initialLotId = 'LOT-CUM-2026-088',
  datasetId,
  activeRootLot,
  onNavigateToActionPlans,
}) => {
  const [selectedRootLot, setSelectedRootLot] = useState<string>(activeRootLot || initialLotId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphVisResponse | null>(null);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Sync selectedRootLot when activeRootLot changes from header/dataset switch
  useEffect(() => {
    if (activeRootLot) {
      setSelectedRootLot(activeRootLot);
    }
  }, [activeRootLot]);

  // Active Case metadata
  const [currentCase, setCurrentCase] = useState<CaseSummary | null>(null);
  const [casesList, setCasesList] = useState<CaseSummary[]>([]);

  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierModalLot, setSupplierModalLot] = useState('FL-SALSA-103');
  const [supplierModalName, setSupplierModalName] = useState('Sunrise Spice Co. (Supplier TX-4)');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalLot, setUploadModalLot] = useState('FL-SALSA-103');

  // Success notifications
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Fetch Cases on mount or datasetId change
  useEffect(() => {
    let isMounted = true;
    const fetchCases = async () => {
      try {
        const cases = await apiClient.listCases(datasetId);
        if (isMounted) {
          setCasesList(cases);
          if (cases.length > 0) {
            setCurrentCase(cases[0]);
            if (cases[0].suspect_raw_lot && !activeRootLot) {
              setSelectedRootLot(cases[0].suspect_raw_lot);
            }
          } else {
            setCurrentCase({
              case_id: datasetId ? `INV-${datasetId}` : 'INV-2026-088',
              title: datasetId ? `Incident Docket (${datasetId})` : 'Cumin lot LOT-CUM-2026-088',
              opened_at: new Date().toISOString(),
              hazard_type: 'BIOLOGICAL',
              pathogen_or_hazard: 'Contaminant Screening',
              suspect_raw_lot: activeRootLot || 'LOT-CUM-2026-088',
              provisional_class: 'Class I',
              lifecycle_status: 'ACTIVE_INVESTIGATION',
              lead_investigator: 'Dr. Elena Vance (QA Food Safety Lead)',
            });
          }
        }
      } catch (err) {
        console.warn('Using fallback investigation case', err);
        if (isMounted) {
          setCurrentCase({
            case_id: datasetId ? `INV-${datasetId}` : 'INV-2026-088',
            title: datasetId ? `Incident Docket (${datasetId})` : 'Cumin lot LOT-CUM-2026-088',
            opened_at: new Date().toISOString(),
            hazard_type: 'BIOLOGICAL',
            pathogen_or_hazard: 'Contaminant Screening',
            suspect_raw_lot: activeRootLot || 'LOT-CUM-2026-088',
            provisional_class: 'Class I',
            lifecycle_status: 'ACTIVE_INVESTIGATION',
            lead_investigator: 'Dr. Elena Vance (QA Food Safety Lead)',
          });
        }
      }
    };
    fetchCases();
    return () => {
      isMounted = false;
    };
  }, [datasetId, activeRootLot]);

  // Fetch 6-Stage Graph Visualization whenever selectedRootLot or datasetId changes
  const loadGraph = async (lotCode: string) => {
    setLoadingGraph(true);
    setGraphError(null);
    try {
      const data = datasetId ? await apiClient.getGraphVis(lotCode, datasetId) : await apiClient.getGraphVis(lotCode);
      setGraphData(data);
      // If currently selected node is not in this trace, default intelligently
      const nodeIds = new Set(data.nodes.map((n) => n.id));
      if (!selectedNodeId || !nodeIds.has(selectedNodeId)) {
        if (nodeIds.has('FL-SALSA-101')) {
          setSelectedNodeId('FL-SALSA-101');
        } else if (nodeIds.has(lotCode)) {
          setSelectedNodeId(lotCode);
        } else if (data.nodes.length > 0) {
          setSelectedNodeId(data.nodes[0].id);
        }
      }
    } catch (err: any) {
      setGraphError(err?.message || 'Failed to load graph visualization from local FalkorDB');
    } finally {
      setLoadingGraph(false);
    }
  };

  useEffect(() => {
    loadGraph(selectedRootLot);
  }, [selectedRootLot, datasetId]);

  // Handle Root Lot Switch (Requirement 6: Control-lot comparison)
  const handleSelectRootLot = (lot: string) => {
    setSelectedRootLot(lot);
  };

  // Open QA Evidence Request Modal (Requirement 5)
  const handleOpenEvidenceRequest = (lotId: string, defaultSupplier?: string) => {
    setSupplierModalLot(lotId);
    setSupplierModalName(defaultSupplier || 'Sunrise Spice Co. (Supplier TX-4)');
    setIsSupplierModalOpen(true);
  };

  // Open Upload Certificate Modal
  const handleOpenUploadCertificate = (lotId: string) => {
    setUploadModalLot(lotId);
    setIsUploadModalOpen(true);
  };

  // Export JSON Report
  const handleExportReport = () => {
    const reportData = {
      investigation_id: currentCase?.case_id || 'INV-2026-088',
      suspect_lot: selectedRootLot,
      generated_at_utc: new Date().toISOString(),
      traceability_standard: 'FDA FSMA Rule 204',
      graph_summary: {
        total_nodes: graphData?.total_nodes || 0,
        total_edges: graphData?.total_edges || 0,
        nodes: graphData?.nodes || [],
        edges: graphData?.edges || [],
      },
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation_report_${currentCase?.case_id || 'INV-2026-088'}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div
      className="investigation-workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 'var(--max-content-width)',
        margin: '0 auto',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Context Header Bar (Stitch exact) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: 'var(--spacing-md)',
          paddingBottom: 'var(--spacing-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-container)',
              color: 'var(--color-primary)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              account_tree
            </span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Investigations
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>/</span>
            {casesList.length > 1 ? (
              <select
                value={currentCase?.case_id || 'INV-2026-088'}
                onChange={(e) => {
                  const found = casesList.find((c: CaseSummary) => c.case_id === e.target.value);
                  if (found) {
                    setCurrentCase(found);
                    if (found.suspect_raw_lot) {
                      setSelectedRootLot(found.suspect_raw_lot);
                    }
                  }
                }}
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                  cursor: 'pointer',
                }}
              >
                {casesList.map((c: CaseSummary) => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_id} — {c.title || c.suspect_raw_lot}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {currentCase?.case_id || 'INV-2026-088'}
              </span>
            )}

            {/* Active CTE Pulse Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface-container)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  display: 'inline-block',
                }}
              />
              Active CTE Session
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportReport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 14px',
              backgroundColor: 'var(--color-surface-card)',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              file_download
            </span>
            Export Report
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigateToActionPlans) {
                onNavigateToActionPlans();
              } else {
                setActionSuccessNotice('Containment protocol simulator engaged. Review active shipment stops in Action Plans.');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 14px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              notifications_active
            </span>
            Trigger Alert Protocol
          </button>
        </div>
      </div>

      {/* Success Notice Banner */}
      {actionSuccessNotice && (
        <div
          role="status"
          style={{
            marginBottom: 'var(--spacing-md)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-container)',
            color: 'var(--color-primary-dark)',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
              check_circle
            </span>
            <span>{actionSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Main 3-Column Responsive Layout */}
      <div
        className="investigation-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr) 320px',
          gap: '20px',
          alignItems: 'start',
          width: '100%',
        }}
      >
        {/* LEFT COLUMN: ~280px */}
        <div
          className="investigation-col-left"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
          }}
        >
          <CaseDetailsCard
            currentCase={currentCase}
            selectedRootLot={selectedRootLot}
            onSelectRootLot={handleSelectRootLot}
            impactedLocationsCount={2}
          />

          <ModelEstimateCard
            productDescription={`Organic Cumin Powder 50kg bag (Facility TX-4, Lot ${selectedRootLot})`}
            reasonForRecall="Potential contamination with Salmonella enterica"
          />

          <PathLegendCard />
        </div>

        {/* CENTER COLUMN: Widest 6-Stage Graph Canvas */}
        <div
          className="investigation-col-center"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
          }}
        >
          <TraceabilityGraphCanvas
            graphData={graphData}
            loading={loadingGraph}
            error={graphError}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            rootLotCode={selectedRootLot}
          />
        </div>

        {/* RIGHT COLUMN: Inspector Card (~320px) */}
        <div
          className="investigation-col-right"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
          }}
        >
          <NodeInspectorPanel
            nodeId={selectedNodeId}
            onOpenEvidenceRequest={handleOpenEvidenceRequest}
            onOpenUploadCertificate={handleOpenUploadCertificate}
            onOpenContainmentPlan={onNavigateToActionPlans}
          />
        </div>
      </div>

      {/* Supplier Request Simulation Modal */}
      <SupplierRequestModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        defaultLotCode={supplierModalLot}
        defaultSupplier={supplierModalName}
        onRequestSuccess={(req: EvidenceRequestResponse) => {
          setActionSuccessNotice(`Simulated evidence request ${req.request_id} recorded in FalkorDB property graph.`);
          loadGraph(selectedRootLot);
        }}
      />

      {/* Upload Certificate Modal */}
      <UploadCertificateModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultLotCode={uploadModalLot}
        onUploadSuccess={(doc: EvidenceUploadResponse) => {
          setActionSuccessNotice(`Certificate ${doc.filename} securely registered for lot ${doc.lot_code}.`);
          loadGraph(selectedRootLot);
        }}
      />

      {/* Responsive Styles embedded for Tablet and Phone */}
      <style>{`
        @media (max-width: 1200px) {
          .investigation-grid {
            grid-template-columns: 260px minmax(0, 1fr) 280px !important;
            gap: 14px !important;
          }
        }
        @media (max-width: 1024px) {
          .investigation-grid {
            grid-template-columns: 1fr !important;
          }
          .investigation-col-center {
            order: 1;
          }
          .investigation-col-left {
            order: 2;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
          }
          .investigation-col-right {
            order: 3;
          }
        }
        @media (max-width: 768px) {
          .investigation-grid {
            grid-template-columns: 1fr !important;
          }
          .investigation-col-center {
            order: 1;
          }
          .investigation-col-left {
            order: 2;
            display: flex !important;
            flex-direction: column !important;
          }
          .investigation-col-right {
            order: 3;
          }
        }
      `}</style>
    </div>
  );
};
