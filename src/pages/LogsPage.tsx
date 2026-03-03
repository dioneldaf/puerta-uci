import React, { useEffect, useState, useCallback } from 'react';
import { obtenerLogs } from '../lib/logger';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import type { LogSistema } from '../types';
import { ScrollText, Filter, RefreshCw } from 'lucide-react';
import Button from '../components/common/Button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PAGE_SIZE = 30;

const ACCION_LABELS: Record<string, { label: string; status: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  login: { label: 'Inicio de sesión', status: 'info' },
  logout: { label: 'Cierre de sesión', status: 'neutral' },
  acceso_permitido: { label: 'Acceso permitido', status: 'success' },
  acceso_denegado: { label: 'Acceso denegado', status: 'danger' },
  acceso_cancelado: { label: 'Acceso cancelado', status: 'warning' },
  persona_creada: { label: 'Persona creada', status: 'info' },
  persona_buscada: { label: 'Persona buscada', status: 'neutral' },
  puerta_creada: { label: 'Puerta creada', status: 'info' },
  puerta_editada: { label: 'Puerta editada', status: 'info' },
  puerta_eliminada: { label: 'Puerta eliminada', status: 'danger' },
  puerta_activada: { label: 'Puerta activada', status: 'success' },
  puerta_desactivada: { label: 'Puerta desactivada', status: 'warning' },
  guardia_creado: { label: 'Guardia creado', status: 'info' },
  guardia_editado: { label: 'Guardia editado', status: 'info' },
  guardia_eliminado: { label: 'Guardia eliminado', status: 'danger' },
  guardia_activado: { label: 'Guardia activado', status: 'success' },
  guardia_desactivado: { label: 'Guardia desactivado', status: 'warning' },
  admin_creado: { label: 'Admin creado', status: 'info' },
  admin_editado: { label: 'Admin editado', status: 'info' },
  admin_eliminado: { label: 'Admin eliminado', status: 'danger' },
  exportacion_excel: { label: 'Exportación Excel', status: 'info' },
  error_sistema: { label: 'Error del sistema', status: 'danger' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterAccion, setFilterAccion] = useState('');
  const [filterEntidad, setFilterEntidad] = useState('');

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const cargarLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await obtenerLogs(page, PAGE_SIZE, {
        accion: filterAccion || undefined,
        entidad: filterEntidad || undefined,
      });
      setLogs(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Error cargando logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAccion, filterEntidad]);

  useEffect(() => {
    cargarLogs();
  }, [cargarLogs]);

  const columns = [
    {
      key: 'created_at',
      header: 'Fecha/Hora',
      render: (item: Record<string, unknown>) =>
        format(new Date(item.created_at as string), "dd/MM/yyyy HH:mm:ss", { locale: es }),
      className: 'whitespace-nowrap',
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (item: Record<string, unknown>) => {
        const accion = item.accion as string;
        const info = ACCION_LABELS[accion] || { label: accion, status: 'neutral' as const };
        return <StatusBadge status={info.status} label={info.label} size="sm" />;
      },
    },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (item: Record<string, unknown>) => (
        <span className="capitalize text-uci-gray-600">
          {(item.entidad as string) || '—'}
        </span>
      ),
    },
    {
      key: 'entidad_id',
      header: 'ID Entidad',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs font-mono text-uci-gray-500">
          {((item.entidad_id as string) || '—').substring(0, 12)}
          {(item.entidad_id as string)?.length > 12 ? '...' : ''}
        </span>
      ),
    },
    {
      key: 'detalles',
      header: 'Detalles',
      render: (item: Record<string, unknown>) => {
        const detalles = item.detalles as Record<string, unknown>;
        if (!detalles || Object.keys(detalles).length === 0) return '—';
        const entries = Object.entries(detalles).slice(0, 3);
        return (
          <div className="text-xs text-uci-gray-500 space-y-0.5">
            {entries.map(([key, val]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span> {String(val)}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
            <ScrollText size={28} className="text-uci-primary" />
            Logs del Sistema
          </h2>
          <p className="text-uci-gray-500 mt-1">
            Registro detallado de todas las acciones en el sistema
          </p>
        </div>
        <Button variant="ghost" onClick={cargarLogs} icon={<RefreshCw size={16} />} size="sm">
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-uci-gray-200 p-4 mb-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-uci-gray-500" />
          <span className="text-sm font-medium text-uci-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={filterAccion}
            onChange={(e) => { setFilterAccion(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filterEntidad}
            onChange={(e) => { setFilterEntidad(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
          >
            <option value="">Todas las entidades</option>
            <option value="auth">Autenticación</option>
            <option value="acceso">Acceso</option>
            <option value="persona">Persona</option>
            <option value="puerta">Puerta</option>
            <option value="guardia">Guardia</option>
            <option value="admin">Admin</option>
            <option value="sistema">Sistema</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No hay logs registrados"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
