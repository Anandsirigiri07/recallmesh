import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';

interface StatCardProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  value: number | string;
  label: string;
  footerLeft: React.ReactNode;
  footerRight?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconColor,
  iconBg,
  badgeLabel,
  badgeVariant,
  value,
  label,
  footerLeft,
  footerRight,
}) => {
  return (
    <div
      className="stitch-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '180px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
            {icon}
          </span>
        </div>

        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div
          className="tabular-nums"
          style={{
            fontSize: '36px',
            lineHeight: '44px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--color-text-secondary)',
            marginTop: '4px',
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>{footerLeft}</span>
        {footerRight && <span>{footerRight}</span>}
      </div>
    </div>
  );
};
