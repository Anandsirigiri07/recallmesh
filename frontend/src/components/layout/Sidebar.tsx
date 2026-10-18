import React from 'react';

export type NavTab =
  | 'overview'
  | 'investigations'
  | 'traceability-graph'
  | 'action-plans'
  | 'agent-memory'
  | 'company-brain';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: string;
}

const navItems: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'investigations', label: 'Investigations', icon: 'search_insights' },
  { id: 'traceability-graph', label: 'Traceability Graph', icon: 'account_tree' },
  { id: 'action-plans', label: 'Action Plans', icon: 'assignment_turned_in' },
  { id: 'agent-memory', label: 'Agent Memory', icon: 'psychology' },
  { id: 'company-brain', label: 'Company Brain', icon: 'schema' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(36, 51, 47, 0.4)',
            zIndex: 49,
          }}
        />
      )}

      <aside
        className={`recallmesh-sidebar ${isMobileOpen ? 'open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--color-surface-card)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          transition: 'transform 0.25s ease-in-out',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--header-height)',
            padding: '0 var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          {/* Logo Icon */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              all_inclusive
            </span>
          </div>

          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--color-text-primary)',
              textTransform: 'uppercase',
            }}
          >
            RECALLMESH
          </span>
        </div>

        {/* Nav Items */}
        <nav
          style={{
            flex: 1,
            padding: 'var(--spacing-md) var(--spacing-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '20px',
                    color: isActive ? '#FFFFFF' : 'inherit',
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom FDA FSMA 204 Verified Node Badge */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-surface-low)',
              border: '1px solid var(--color-surface-dim)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-dark)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                verified_user
              </span>
            </div>

            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary-dark)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Synthetic Demo
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title="Synthetic Traceability Demo — Not FDA Certified"
              >
                Not FDA Certified
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
