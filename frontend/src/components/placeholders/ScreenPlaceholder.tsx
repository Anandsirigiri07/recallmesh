import React from 'react';
import { Button } from '../common/Button';

interface ScreenPlaceholderProps {
  title: string;
  icon: string;
  description: string;
  scheduledMilestone: string;
  onBackToOverview: () => void;
}

export const ScreenPlaceholder: React.FC<ScreenPlaceholderProps> = ({
  title,
  icon,
  description,
  scheduledMilestone,
  onBackToOverview,
}) => {
  return (
    <div
      className="stitch-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 24px',
        maxWidth: '640px',
        margin: '40px auto',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-surface-container)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
          {icon}
        </span>
      </div>

      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-primary)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-surface-low)',
          }}
        >
          {scheduledMilestone}
        </span>

        <h2 className="text-headline-lg" style={{ marginTop: '12px', color: 'var(--color-text-primary)' }}>
          {title}
        </h2>

        <p
          className="text-body-md"
          style={{ color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '8px auto 0 auto' }}
        >
          {description}
        </p>
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-canvas-bg)',
          border: '1px solid var(--color-border)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <strong>Scope boundary: </strong>
        In accordance with the project milestone plan, Milestone 4B.1 activates the Overview Dashboard and application shell. This screen is scheduled for subsequent milestones.
      </div>

      <Button variant="primary" icon="arrow_back" onClick={onBackToOverview}>
        Return to Overview Dashboard
      </Button>
    </div>
  );
};
