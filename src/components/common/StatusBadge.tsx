import React from 'react';

interface StatusBadgeProps {
  status: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  label: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colors[status]} ${sizeClasses[size]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'success'
            ? 'bg-emerald-500'
            : status === 'danger'
            ? 'bg-red-500'
            : status === 'warning'
            ? 'bg-amber-500'
            : status === 'info'
            ? 'bg-blue-500'
            : 'bg-gray-400'
        }`}
      />
      {label}
    </span>
  );
}
