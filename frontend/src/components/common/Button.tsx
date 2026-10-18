import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconTrailing?: string;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconTrailing,
  isLoading = false,
  className = '',
  style,
  disabled,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-on-primary)',
          border: 'none',
          boxShadow: 'var(--shadow-card)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--color-surface-card)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text-secondary)',
          border: 'none',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--color-status-affected-solid)',
          color: '#FFFFFF',
          border: 'none',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          height: '34px',
          padding: '0 12px',
          fontSize: '12px',
          borderRadius: 'var(--radius-md)',
          gap: '6px',
        };
      case 'lg':
        return {
          height: '44px',
          padding: '0 24px',
          fontSize: '15px',
          borderRadius: 'var(--radius-lg)',
          gap: '8px',
        };
      case 'md':
      default:
        return {
          height: '40px',
          padding: '0 18px',
          fontSize: '14px',
          borderRadius: 'var(--radius-lg)',
          gap: '8px',
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...getSizeStyles(),
    ...getVariantStyles(),
    ...style,
  };

  return (
    <button
      className={`stitch-btn ${className}`}
      style={baseStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span
          className="material-symbols-outlined animate-spin"
          style={{ fontSize: size === 'sm' ? '16px' : '18px' }}
        >
          progress_activity
        </span>
      ) : icon ? (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: size === 'sm' ? '16px' : '18px' }}
        >
          {icon}
        </span>
      ) : null}

      <span>{children}</span>

      {!isLoading && iconTrailing && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: size === 'sm' ? '16px' : '18px' }}
        >
          {iconTrailing}
        </span>
      )}
    </button>
  );
};
