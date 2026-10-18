import React from 'react';

export type BadgeVariant = 'affected' | 'verified' | 'review' | 'unknown' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  affected: {
    bg: 'var(--color-status-affected-tint)',
    text: 'var(--color-status-affected-text)',
    dot: 'var(--color-status-affected-solid)',
  },
  verified: {
    bg: 'var(--color-status-verified-tint)',
    text: 'var(--color-status-verified-text)',
    dot: 'var(--color-status-verified-solid)',
  },
  review: {
    bg: 'var(--color-status-review-tint)',
    text: 'var(--color-status-review-text)',
    dot: 'var(--color-status-review-solid)',
  },
  unknown: {
    bg: 'var(--color-status-unknown-tint)',
    text: 'var(--color-status-unknown-text)',
    dot: 'var(--color-status-unknown-solid)',
  },
  neutral: {
    bg: 'var(--color-surface-high)',
    text: 'var(--color-text-secondary)',
    dot: 'var(--color-border-subtle)',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant,
  children,
  showDot = true,
  className = '',
  size = 'sm',
}) => {
  const style = variantStyles[variant] || variantStyles.neutral;

  const padding = size === 'sm' ? '4px 10px' : '6px 12px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className={`stitch-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: 'var(--radius-full)',
        padding,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {showDot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: style.dot,
            flexShrink: 0,
          }}
        />
      )}
      <span>{children}</span>
    </span>
  );
};
