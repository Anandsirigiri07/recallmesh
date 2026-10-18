import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../api/client';
import type { SearchMatch, DatasetSummary } from '../../types/api';
import { Button } from '../common/Button';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onInspectNode: (nodeId: string) => void;
  onNewInvestigationClick: () => void;
  activeDataset?: DatasetSummary | null;
  datasets?: DatasetSummary[];
  onSelectDataset?: (dataset: DatasetSummary) => void;
  onOpenImportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onInspectNode,
  onNewInvestigationClick,
  activeDataset,
  datasets = [],
  onSelectDataset,
  onOpenImportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDatasetDropdownOpen, setIsDatasetDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const datasetDropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search scoped to active dataset
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const handler = setTimeout(() => {
      setIsSearching(true);
      apiClient
        .search(searchQuery.trim(), activeDataset?.dataset_id)
        .then((res) => {
          setSearchResults(res.matches || []);
          setIsDropdownOpen(true);
          setIsSearching(false);
        })
        .catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery, activeDataset?.dataset_id]);

  // Click outside listener for search and dataset dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (datasetDropdownRef.current && !datasetDropdownRef.current.contains(e.target as Node)) {
        setIsDatasetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="recallmesh-header"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: 'var(--header-height)',
        backgroundColor: 'var(--color-surface-card)',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-lg)',
        gap: 'var(--spacing-md)',
      }}
    >
      {/* Mobile Hamburger Button */}
      <button
        onClick={onToggleMobileMenu}
        aria-label="Toggle Navigation Menu"
        className="mobile-menu-btn"
        style={{
          display: 'none',
          padding: '8px',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-primary)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
          menu
        </span>
      </button>

      {/* Search Input Container */}
      <div
        ref={dropdownRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
          maxWidth: '560px',
        }}
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-secondary)',
              fontSize: '20px',
              pointerEvents: 'none',
            }}
          >
            {isSearching ? 'progress_activity' : 'search'}
          </span>

          <input
            type="text"
            placeholder="Search lots, shipments, facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsDropdownOpen(true);
            }}
            aria-label="Search records"
            style={{
              width: '100%',
              height: '40px',
              paddingLeft: '40px',
              paddingRight: '16px',
              backgroundColor: 'var(--color-canvas-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              fontFamily: 'inherit',
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        </div>

        {/* Demo Data Pill */}
        <span
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-surface-high)',
            color: 'var(--color-text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Demo data
        </span>

        {/* Search Results Dropdown */}
        {isDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '48px',
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              maxHeight: '360px',
              overflowY: 'auto',
              zIndex: 60,
              padding: '6px',
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                No matching graph nodes found for "{searchQuery}".
              </div>
            ) : (
              searchResults.map((match) => (
                <button
                  key={`${match.entity_type}-${match.entity_id}`}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onInspectNode(match.entity_id);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: 'var(--color-text-primary)',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-canvas-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-surface-low)',
                        color: 'var(--color-primary)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {match.entity_type}
                    </span>
                    <span style={{ fontWeight: 600 }}>{match.entity_id}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{match.display_name}</span>
                  </div>

                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}
                  >
                    chevron_right
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Action Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Dataset Selector Dropdown */}
        <div ref={datasetDropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDatasetDropdownOpen(!isDatasetDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              transition: 'border-color 0.15s ease',
            }}
            title="Switch active supply chain dataset"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
              dataset
            </span>
            <span style={{ fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeDataset ? activeDataset.name || activeDataset.dataset_id : 'Select Dataset'}
            </span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                backgroundColor: activeDataset?.is_demo ? 'var(--color-surface-low)' : '#E0F2FE',
                color: activeDataset?.is_demo ? 'var(--color-primary)' : '#0369A1',
              }}
            >
              {activeDataset?.is_demo ? 'Demo' : 'Imported'}
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
              arrow_drop_down
            </span>
          </button>

          {/* Dataset Dropdown Panel */}
          {isDatasetDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '320px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-dropdown)',
                border: '1px solid var(--color-border)',
                padding: '8px 0',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '6px 14px 8px 14px',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>FalkorDB Datasets</span>
                <span>{datasets.length} available</span>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {datasets.map((ds) => {
                  const isSelected = activeDataset?.dataset_id === ds.dataset_id;
                  const totalNodes = Object.values(ds.counts || {}).reduce((a, b) => a + b, 0);
                  return (
                    <button
                      key={ds.dataset_id}
                      type="button"
                      onClick={() => {
                        if (onSelectDataset) onSelectDataset(ds);
                        setIsDatasetDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        backgroundColor: isSelected ? 'var(--color-surface-low)' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-canvas-bg)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '18px',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          marginTop: '2px',
                        }}
                      >
                        {isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                            {ds.name || ds.dataset_id}
                          </span>
                          <span
                            style={{
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: ds.is_demo ? 'var(--color-surface-low)' : '#E0F2FE',
                              color: ds.is_demo ? 'var(--color-primary)' : '#0369A1',
                            }}
                          >
                            {ds.is_demo ? 'Demo' : 'Imported'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {totalNodes > 0 ? `${totalNodes} graph nodes` : ds.dataset_id}
                          {ds.suspect_root_lot ? ` • Root: ${ds.suspect_root_lot}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {onOpenImportModal && (
                <div style={{ padding: '8px 12px 4px 12px', borderTop: '1px solid var(--color-border)', marginTop: '4px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="publish"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setIsDatasetDropdownOpen(false);
                      onOpenImportModal();
                    }}
                  >
                    Import New Dataset...
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direct Import Button */}
        {onOpenImportModal && (
          <Button
            variant="secondary"
            icon="upload"
            size="md"
            onClick={onOpenImportModal}
            title="Import supply chain dataset (FSMA 204 JSON or CTE CSV)"
          >
            Import data
          </Button>
        )}

        <Button
          variant="primary"
          icon="add"
          size="md"
          onClick={onNewInvestigationClick}
        >
          New investigation
        </Button>

        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--color-border)',
          }}
        />

        {/* User Profile Avatar */}
        <div
          title="QA Food Safety Lead"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            person
          </span>
        </div>
      </div>
    </header>
  );
};
