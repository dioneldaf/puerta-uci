import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-uci-primary text-white hover:bg-uci-dark focus:ring-uci-secondary shadow-sm hover:shadow',
    secondary:
      'bg-uci-gray-200 text-uci-gray-800 hover:bg-uci-gray-300 focus:ring-uci-gray-400',
    danger:
      'bg-status-danger text-white hover:bg-red-600 focus:ring-red-400 shadow-sm',
    success:
      'bg-status-success text-white hover:bg-emerald-600 focus:ring-emerald-400 shadow-sm',
    ghost:
      'bg-transparent text-uci-gray-600 hover:bg-uci-gray-100 hover:text-uci-gray-800 focus:ring-uci-gray-300',
    outline:
      'border-2 border-uci-primary text-uci-primary hover:bg-uci-primary hover:text-white focus:ring-uci-secondary',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
