import React from 'react';

export const PathLegendCard: React.FC = () => {
  return (
    <div
      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
      style={{
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="pb-space-sm mb-space-sm" style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--color-border)' }}>
        <span
          className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          Path Legend
        </span>
      </div>

      <div className="flex flex-col gap-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Affected Path */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-status-affected-tint)',
            color: 'var(--color-status-affected-text)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-affected-solid)',
                flexShrink: 0,
              }}
            />
            <span>Affected path</span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
            crisis_alert
          </span>
        </div>

        {/* Record Verified */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-status-verified-tint)',
            color: 'var(--color-status-verified-text)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-verified-solid)',
                flexShrink: 0,
              }}
            />
            <span>Record verified</span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
            check_circle
          </span>
        </div>

        {/* Needs Review */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-status-review-tint)',
            color: 'var(--color-status-review-text)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-review-solid)',
                flexShrink: 0,
              }}
            />
            <span>Needs review</span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
            pending_actions
          </span>
        </div>

        {/* Unknown Link / Gap Detected */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-status-unknown-tint)',
            color: 'var(--color-status-unknown-text)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-unknown-solid)',
                flexShrink: 0,
              }}
            />
            <span>Unknown link (Gap)</span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
            help_outline
          </span>
        </div>
      </div>
    </div>
  );
};
