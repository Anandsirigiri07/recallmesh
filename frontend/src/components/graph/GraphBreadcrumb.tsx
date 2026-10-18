import React from 'react';

export interface BreadcrumbItem {
  id: string;
  label: string;
  isDestination?: boolean;
}

interface GraphBreadcrumbProps {
  items: BreadcrumbItem[];
  onSelectNode: (nodeId: string) => void;
  shipmentCount?: number;
}

export const GraphBreadcrumb: React.FC<GraphBreadcrumbProps> = ({
  items,
  onSelectNode,
  shipmentCount = 2,
}) => {
  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#FDF0ED',
        border: '1px solid #F8D2CB',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '12px',
      }}
    >
      {/* Path List */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          color: '#24332F',
        }}
      >
        <span
          style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#E77861',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          PATH
        </span>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={item.id + '-' + idx}>
              <span
                onClick={() => onSelectNode(item.id)}
                style={{
                  fontWeight: isLast || item.isDestination ? 700 : 500,
                  color: isLast || item.isDestination ? '#8E2F1C' : '#24332F',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {item.label}
              </span>

              {!isLast && (
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '14px',
                    color: '#8E2F1C',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  chevron_right
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Warning Count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#8E2F1C',
          fontWeight: 600,
          fontSize: '12px',
          flexShrink: 0,
          paddingLeft: '8px',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          warning
        </span>
        <span>{shipmentCount} {shipmentCount === 1 ? 'shipment' : 'shipments'} reached</span>
      </div>
    </div>
  );
};
