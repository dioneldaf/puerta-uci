import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import type { RegistroAccesoCompleto } from '../types';
import { ClipboardList, Search, Filter, RefreshCw } from 'lucide-react';
import Button from '../components/common/Button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PAGE_SIZE = 20;

export default function RecordsPage() {
  const [records, setRecords] = useState<RegistroAccesoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const cargarRegistros = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('registros_acceso')
        .select(
          `
          *,
          persona:personas(nombre_completo, primer_apellido, segundo_apellido, carnet_identidad, numero_solapin),
          puerta:puertas(nombre, ubicacion),
          guardia:usuarios(nombre, email)
        `,
          { count: 'exact' }
        )
        .order('fecha_hora', { ascending: false });

      if (filterEstado) {
        query = query.eq('estado', filterEstado);
      }
      if (filterTipo) {
        query = query.eq('tipo_acceso', filterTipo);
      }
      if (filterDesde) {
        query = query.gte('fecha_hora', filterDesde);
      }
      if (filterHasta) {
        query = query.lte('fecha_hora', filterHasta + 'T23:59:59');
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      // Filtrar por búsqueda en cliente (nombre/carnet)
      let filteredData = (data || []) as unknown as RegistroAccesoCompleto[];
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter((r) => {
          const p = r.persona as any;
          const fullName = `${p?.nombre_completo || ''} ${p?.primer_apellido || ''} ${p?.segundo_apellido || ''}`.toLowerCase();
          const carnet = p?.carnet_identidad || '';
          return fullName.includes(term) || carnet.includes(term);
        });
      }

      setRecords(filteredData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error cargando registros:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterEstado, filterTipo, filterDesde, filterHasta, searchTerm]);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  const columns = [
    {
      key: 'fecha_hora',
      header: 'Fecha/Hora',
      render: (item: Record<string, unknown>) =>
        format(new Date(item.fecha_hora as string), "dd/MM/yyyy HH:mm:ss", { locale: es }),
    },
    {
      key: 'persona',
      header: 'Persona',
      render: (item: Record<string, unknown>) => {
        const p = item.persona as any;
        return (
          <div>
            <p className="font-medium text-uci-gray-800">
              {p?.nombre_completo} {p?.primer_apellido} {p?.segundo_apellido || ''}
            </p>
            <p className="text-xs text-uci-gray-500">{p?.carnet_identidad}</p>
          </div>
        );
      },
    },
    {
      key: 'puerta',
      header: 'Puerta',
      render: (item: Record<string, unknown>) => (item.puerta as any)?.nombre || '—',
    },
    {
      key: 'tipo_acceso',
      header: 'Tipo',
      render: (item: Record<string, unknown>) => (
        <StatusBadge
          status={item.tipo_acceso === 'activo' ? 'info' : 'warning'}
          label={item.tipo_acceso === 'activo' ? 'Activo' : 'Inactivo'}
          size="sm"
        />
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: Record<string, unknown>) => (
        <StatusBadge
          status={item.estado === 'permitido' ? 'success' : 'danger'}
          label={item.estado === 'permitido' ? 'Permitido' : 'Denegado'}
          size="sm"
        />
      ),
    },
    {
      key: 'motivo_acceso',
      header: 'Motivo',
      render: (item: Record<string, unknown>) => (
        <span className="text-uci-gray-600 text-xs">
          {(item.motivo_acceso as string) || '—'}
        </span>
      ),
    },
    {
      key: 'guardia',
      header: 'Guardia',
      render: (item: Record<string, unknown>) => (item.guardia as any)?.nombre || '—',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
            <ClipboardList size={28} className="text-uci-primary" />
            Registro de Accesos
          </h2>
          <p className="text-uci-gray-500 mt-1">
            Historial completo de entradas y salidas
          </p>
        </div>
        <Button variant="ghost" onClick={cargarRegistros} icon={<RefreshCw size={16} />} size="sm">
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-uci-gray-200 p-4 mb-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-uci-gray-500" />
          <span className="text-sm font-medium text-uci-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-uci-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o CI..."
              className="w-full pl-9 pr-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="permitido">Permitido</option>
            <option value="denegado">Denegado</option>
          </select>
          <select
            value={filterTipo}
            onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <input
            type="date"
            value={filterDesde}
            onChange={(e) => { setFilterDesde(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            placeholder="Desde"
          />
          <input
            type="date"
            value={filterHasta}
            onChange={(e) => { setFilterHasta(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            placeholder="Hasta"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No hay registros de acceso"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
