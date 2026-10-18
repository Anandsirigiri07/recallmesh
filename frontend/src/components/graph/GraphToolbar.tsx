import React from 'react';

interface GraphToolbarProps {
  pathFilter: 'affected' | 'all';
  onPathFilterChange: (filter: 'affected' | 'all') => void;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onReset: () => void;
}

const CATEGORIES = ['Lots', 'Shipments', 'Suppliers', 'Evidence', 'Locations'];

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  pathFilter,
  onPathFilterChange,
  selectedCategories,
  onToggleCategory,
  searchQuery,
  onSearchChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onReset,
}) => {
  return (
    <div className="flex flex-col w-full mb-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header Row */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              lineHeight: '32px',
              fontWeight: 700,
              color: '#24332F',
              letterSpacing: '-0.015em',
            }}
          >
            Traceability Graph
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#69736E',
              marginTop: '2px',
            }}
          >
            See how every lot, shipment and place is connected.
          </p>
        </div>

        {/* Path Filter Toggle */}
        <div
          role="group"
          aria-label="Path visibility filter"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E7E3D9',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(36, 51, 47, 0.04)',
          }}
        >
          <button
            type="button"
            id="toggle-affected"
            onClick={() => onPathFilterChange('affected')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              backgroundColor: pathFilter === 'affected' ? '#337A68' : 'transparent',
              color: pathFilter === 'affected' ? '#FFFFFF' : '#69736E',
              boxShadow: pathFilter === 'affected' ? '0 1px 4px rgba(36, 51, 47, 0.12)' : 'none',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#E77861',
                display: 'inline-block',
              }}
            />
            Affected paths only
          </button>

          <button
            type="button"
            id="toggle-all"
            onClick={() => onPathFilterChange('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              backgroundColor: pathFilter === 'all' ? '#337A68' : 'transparent',
              color: pathFilter === 'all' ? '#FFFFFF' : '#69736E',
              boxShadow: pathFilter === 'all' ? '0 1px 4px rgba(36, 51, 47, 0.12)' : 'none',
              cursor: 'pointer',
            }}
          >
            All records
          </button>
        </div>
      </div>

      {/* Slim Toolbar Card */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E7E3D9',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(36, 51, 47, 0.04)',
        }}
      >
        {/* Filter Chips Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            padding: '2px 0',
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleCategory(cat)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  backgroundColor: isSelected ? '#EBF4F1' : '#FFFFFF',
                  color: isSelected ? '#337A68' : '#69736E',
                  border: isSelected ? '1px solid rgba(51, 122, 104, 0.35)' : '1px solid #E7E3D9',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSelected && (
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', lineHeight: 1 }}>
                    check
                  </span>
                )}
                {cat}
              </button>
            );
          })}
        </div>

        {/* Center Search Input */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 260px',
            maxWidth: '340px',
            minWidth: '200px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#69736E',
              fontSize: '18px',
              pointerEvents: 'none',
            }}
          >
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Find a lot or shipment..."
            style={{
              width: '100%',
              height: '36px',
              paddingLeft: '34px',
              paddingRight: '12px',
              borderRadius: '8px',
              border: '1px solid #E7E3D9',
              backgroundColor: 'rgba(250, 246, 236, 0.45)',
              fontSize: '13px',
              color: '#24332F',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Canvas Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom in"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#69736E',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              add
            </span>
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom out"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#69736E',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              remove
            </span>
          </button>
          <button
            type="button"
            onClick={onFitToScreen}
            title="Fit to screen"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#69736E',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              crop_free
            </span>
          </button>

          <div
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: '#E7E3D9',
              margin: '0 4px',
            }}
          />

          <button
            type="button"
            onClick={onReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#69736E',
              backgroundColor: 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              refresh
            </span>
            Reset ({Math.round(zoom * 100)}%)
          </button>
        </div>
      </div>
    </div>
  );
};
