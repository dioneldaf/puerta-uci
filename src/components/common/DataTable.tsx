import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos para mostrar',
  page,
  totalPages,
  onPageChange,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-xl border border-uci-gray-200 overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-uci-gray-50 border-b border-uci-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-semibold text-uci-gray-600 uppercase tracking-wider text-xs ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-uci-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-uci-gray-500">
                    <div className="w-5 h-5 border-2 border-uci-gray-300 border-t-uci-primary rounded-full animate-spin" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-uci-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={(item.id as string) || idx}
                  onClick={() => onRowClick?.(item)}
                  className={`hover:bg-uci-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-uci-gray-700 ${col.className || ''}`}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Paginación */}
      {page !== undefined && totalPages !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-uci-gray-200 bg-uci-gray-50">
          <span className="text-sm text-uci-gray-600">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-uci-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-uci-gray-600"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-uci-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-uci-gray-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
