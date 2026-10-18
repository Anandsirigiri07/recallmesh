import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import type { NavTab } from './Sidebar';
import { Header } from './Header';
import { OverviewDashboard } from '../overview/OverviewDashboard';
import { InvestigationWorkspace } from '../investigation/InvestigationWorkspace';
import { TraceabilityGraphExplorer } from '../graph/TraceabilityGraphExplorer';
import { ActionPlansWorkspace } from '../actions/ActionPlansWorkspace';
import { ScreenPlaceholder } from '../placeholders/ScreenPlaceholder';
import { NodeInspectorModal } from '../common/NodeInspectorModal';
import { NewInvestigationModal } from '../common/NewInvestigationModal';
import { ImportDatasetModal } from '../common/ImportDatasetModal';
import { apiClient } from '../../api/client';
import type { DatasetSummary, DatasetImportResponse } from '../../types/api';

export const AppShell: React.FC = () => {
  const getInitialTab = (): NavTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['overview', 'investigations', 'traceability-graph', 'action-plans', 'agent-memory', 'company-brain'].includes(hash)) {
        return hash as NavTab;
      }
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['overview', 'investigations', 'traceability-graph', 'action-plans', 'agent-memory', 'company-brain'].includes(tab)) {
        return tab as NavTab;
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTabState] = useState<NavTab>(getInitialTab);

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalInspectNodeId, setGlobalInspectNodeId] = useState<string | null>(null);
  const [isNewInvestigationOpen, setIsNewInvestigationOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Dataset State & Isolation
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetSummary | null>(null);

  // Load datasets on mount
  useEffect(() => {
    let isMounted = true;
    apiClient
      .listDatasets()
      .then((list) => {
        if (isMounted) {
          setDatasets(list);
          if (list.length > 0) {
            const demoDs = list.find((d) => d.is_demo) || list[0];
            setActiveDataset(demoDs);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load datasets list from FalkorDB:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectDataset = (ds: DatasetSummary) => {
    setActiveDataset(ds);
  };

  const handleImportSuccess = async (imported: DatasetImportResponse) => {
    try {
      const updatedList = await apiClient.listDatasets();
      setDatasets(updatedList);
      const newlyImported = updatedList.find((d) => d.dataset_id === imported.dataset_id);
      if (newlyImported) {
        setActiveDataset(newlyImported);
      } else {
        setActiveDataset({
          dataset_id: imported.dataset_id,
          name: imported.name,
          is_demo: imported.is_demo,
          counts: imported.counts,
          suspect_root_lot: imported.suspect_root_lot,
        });
      }
    } catch {
      // fallback
    }
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewDashboard
            datasetId={activeDataset?.dataset_id}
            onNavigateToGraph={() => setActiveTab('traceability-graph')}
            onNavigateToInvestigation={() => setActiveTab('investigations')}
            onNavigateToActionPlans={() => setActiveTab('action-plans')}
          />
        );

      case 'investigations':
        return (
          <InvestigationWorkspace
            datasetId={activeDataset?.dataset_id}
            activeRootLot={activeDataset?.suspect_root_lot || undefined}
            onNavigateToOverview={() => setActiveTab('overview')}
            onNavigateToActionPlans={() => setActiveTab('action-plans')}
          />
        );

      case 'traceability-graph':
        return (
          <TraceabilityGraphExplorer
            datasetId={activeDataset?.dataset_id}
            activeRootLot={activeDataset?.suspect_root_lot || undefined}
            onNavigateToOverview={() => setActiveTab('overview')}
            onNavigateToInvestigation={() => setActiveTab('investigations')}
          />
        );

      case 'action-plans':
        return (
          <ActionPlansWorkspace
            datasetId={activeDataset?.dataset_id}
            activeRootLot={activeDataset?.suspect_root_lot || undefined}
            onNavigateToOverview={() => setActiveTab('overview')}
            onNavigateToInvestigation={() => setActiveTab('investigations')}
            onNavigateToGraph={() => setActiveTab('traceability-graph')}
          />
        );

      case 'agent-memory':
      case 'company-brain':
        return (
          <ScreenPlaceholder
            title="Agent Memory & Institutional Knowledge Base"
            icon="psychology"
            description="Historical incident recall, agent handovers, supplier compliance memory, and connected entity graph topology."
            scheduledMilestone="Milestone 4B.5 (Upcoming)"
            onBackToOverview={() => setActiveTab('overview')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="recallmesh-app-container"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-canvas-bg)',
        display: 'flex',
      }}
    >
      {/* Node Inspector Modal for Global Searches */}
      <NodeInspectorModal
        nodeId={globalInspectNodeId}
        onClose={() => setGlobalInspectNodeId(null)}
      />

      {/* New Investigation Modal */}
      <NewInvestigationModal
        isOpen={isNewInvestigationOpen}
        onClose={() => setIsNewInvestigationOpen(false)}
        activeDatasetId={activeDataset?.dataset_id}
        initialSuspectLot={activeDataset?.suspect_root_lot || undefined}
        onSuccess={() => {
          setActiveTab('overview');
        }}
      />

      {/* Import Supply Chain Dataset Modal */}
      <ImportDatasetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Persistent Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className="recallmesh-main-wrapper"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onInspectNode={(nodeId) => setGlobalInspectNodeId(nodeId)}
          onNewInvestigationClick={() => setIsNewInvestigationOpen(true)}
          activeDataset={activeDataset}
          datasets={datasets}
          onSelectDataset={handleSelectDataset}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        <main
          className="recallmesh-main-content"
          style={{
            flex: 1,
            padding: 'calc(var(--header-height) + var(--spacing-xl)) var(--spacing-xl) var(--spacing-xl) var(--spacing-xl)',
            backgroundColor: 'var(--color-canvas-bg)',
            minHeight: '100vh',
          }}
        >
          <div
            style={{
              maxWidth: 'var(--max-content-width)',
              margin: '0 auto',
              width: '100%',
            }}
          >
            {renderActiveScreen()}
          </div>
        </main>
      </div>
    </div>
  );
};
