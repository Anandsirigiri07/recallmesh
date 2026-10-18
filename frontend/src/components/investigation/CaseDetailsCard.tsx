import React from 'react';
import type { CaseSummary } from '../../types/api';

interface CaseDetailsCardProps {
  currentCase?: CaseSummary | null;
  selectedRootLot: string;
  onSelectRootLot: (lot: string) => void;
  impactedLocationsCount?: number;
}

export const CaseDetailsCard: React.FC<CaseDetailsCardProps> = ({
  currentCase,
  selectedRootLot,
  onSelectRootLot,
  impactedLocationsCount = 2,
}) => {
  const suspectLot = currentCase?.suspect_raw_lot || 'LOT-CUM-2026-088';
  const isDemo = suspectLot === 'LOT-CUM-2026-088';
  const isAffectedLot = selectedRootLot === suspectLot;

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
      <div
        className="flex items-center justify-between pb-space-sm mb-space-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <span
          className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          Case Reference
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-surface-container)',
            color: 'var(--color-primary)',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
            timelapse
          </span>
          In progress
        </span>
      </div>

      <h2
        className="font-headline-sm text-headline-sm text-on-surface mb-1.5"
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          margin: '0 0 6px 0',
        }}
      >
        {isAffectedLot ? 'Cumin lot LOT-CUM-2026-088' : 'Clean Control Lot LOT-CUM-2026-090'}
      </h2>

      <p
        className="font-body-sm text-body-sm text-on-surface-variant mb-space-md leading-relaxed"
        style={{
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          margin: '0 0 var(--spacing-md) 0',
          lineHeight: '1.4',
        }}
      >
        {isAffectedLot
          ? 'Investigating potential Salmonella enterica contamination originating from harvest facility TX-4.'
          : 'Negative control lot: Sourced from Summit Organics; verified separate processing run with zero contamination.'}
      </p>

      {/* Lot Comparison Switcher (Requirement 6: Affected-lot investigation & control-lot comparison) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-low)',
          padding: '8px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '6px',
          }}
        >
          Root Lot Investigation Focus
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: isDemo ? '1fr 1fr' : '1fr', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onSelectRootLot(suspectLot)}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isAffectedLot ? '1px solid var(--color-status-affected-solid)' : '1px solid var(--color-border)',
              backgroundColor: isAffectedLot ? 'var(--color-surface-card)' : 'transparent',
              color: isAffectedLot ? 'var(--color-status-affected-text)' : 'var(--color-text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {isDemo ? 'Suspect Lot (088)' : `Suspect Root (${suspectLot})`}
          </button>
          {isDemo && (
            <button
              type="button"
              onClick={() => onSelectRootLot('LOT-CUM-2026-090')}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: !isAffectedLot ? '1px solid var(--color-status-verified-solid)' : '1px solid var(--color-border)',
                backgroundColor: !isAffectedLot ? 'var(--color-surface-card)' : 'transparent',
                color: !isAffectedLot ? 'var(--color-status-verified-text)' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Control Lot (090)
            </button>
          )}
        </div>
      </div>

      <div
        className="space-y-2 pt-space-xs text-body-sm font-body-sm text-on-surface-variant"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          borderTop: '1px solid var(--color-border)',
          paddingTop: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Case Docket</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {currentCase?.case_id || 'INC-2026-088'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Opened</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {currentCase?.opened_at ? new Date(currentCase.opened_at).toLocaleTimeString() : '2h ago'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Lead</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {currentCase?.lead_investigator || 'Dr. Elena Vance (QA Lead)'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Impact Area</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {isAffectedLot ? `${impactedLocationsCount} Distribution Centers` : '0 Affected Centers (Isolated)'}
          </span>
        </div>
      </div>
    </div>
  );
};
