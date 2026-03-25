import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CarFront, LogIn, LogOut, MapPin, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { registrarLog } from '../lib/logger';
import { supabase } from '../lib/supabase';
import type { AccionVehiculo, Puerta, RegistroVehiculo, VehiculoAutorizado } from '../types';

const VEHICLE_ACCESS_STORAGE_KEY = 'vehicle_access_page_state_v1';

interface VehicleAccessPersistedState {
  puertaSeleccionada: string;
}

function cargarEstadoPersistido(): VehicleAccessPersistedState {
  if (typeof window === 'undefined') {
    return { puertaSeleccionada: '' };
  }

  try {
    const raw = window.sessionStorage.getItem(VEHICLE_ACCESS_STORAGE_KEY);
    if (!raw) {
      return { puertaSeleccionada: '' };
    }

    const parsed = JSON.parse(raw) as Partial<VehicleAccessPersistedState>;
    return {
      puertaSeleccionada: parsed.puertaSeleccionada || '',
    };
  } catch {
    return { puertaSeleccionada: '' };
  }
}

function getTodayKey(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isVehicleAuthorizedNow(vehicle: VehiculoAutorizado): boolean {
  if (!vehicle.activo) {
    return false;
  }

  const hoy = getTodayKey();
  if (hoy > vehicle.acceso_hasta) {
    return false;
  }

  if (hoy === vehicle.acceso_hasta) {
    const ahora = new Date();
    const h = ahora.getHours();
    const min = ahora.getMinutes();
    const sec = ahora.getSeconds();
    if (h > 22 || (h === 22 && (min > 0 || sec > 0))) {
      return false;
    }
  }

  return true;
}

export default function VehicleAccessPage() {
  const estadoPersistido = cargarEstadoPersistido();
  const { usuario } = useAuth();
  const [vehiculos, setVehiculos] = useState<VehiculoAutorizado[]>([]);
  const [registrosHoy, setRegistrosHoy] = useState<RegistroVehiculo[]>([]);
  const [puertas, setPuertas] = useState<Puerta[]>([]);
  const [puertaSeleccionada, setPuertaSeleccionada] = useState(estadoPersistido.puertaSeleccionada);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [registrandoId, setRegistrandoId] = useState<string | null>(null);

  const cargarPuertas = useCallback(async () => {
    const { data, error } = await supabase
      .from('puertas')
      .select('*')
      .eq('activa', true)
      .order('nombre');

    if (error) {
      console.error(error);
      return;
    }

    setPuertas((data || []) as Puerta[]);
  }, []);

  const cargarVehiculosAutorizados = useCallback(async () => {
    setLoading(true);

    try {
      const hoy = getTodayKey();
      const { data, error } = await supabase
        .from('vehiculos_autorizados')
        .select('*')
        .eq('activo', true)
        .gte('acceso_hasta', hoy)
        .order('acceso_hasta')
        .order('nombre');

      if (error) throw error;

      const autorizados = ((data || []) as VehiculoAutorizado[]).filter(isVehicleAuthorizedNow);
      setVehiculos(autorizados);
    } catch (err) {
      toast.error('Error cargando vehiculos autorizados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarRegistrosHoy = useCallback(async () => {
    const hoy = getTodayKey();
    const { data, error } = await supabase
      .from('registros_vehiculos')
      .select('*')
      .gte('fecha_hora', `${hoy}T00:00:00`)
      .order('fecha_hora', { ascending: false })
      .limit(20);

    if (error) {
      console.error(error);
      return;
    }

    setRegistrosHoy((data || []) as RegistroVehiculo[]);
  }, []);

  const cargarTodo = useCallback(async () => {
    await Promise.all([cargarPuertas(), cargarVehiculosAutorizados(), cargarRegistrosHoy()]);
  }, [cargarPuertas, cargarVehiculosAutorizados, cargarRegistrosHoy]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(
        VEHICLE_ACCESS_STORAGE_KEY,
        JSON.stringify({ puertaSeleccionada })
      );
    } catch {
      // Ignorar errores de persistencia
    }
  }, [puertaSeleccionada]);

  const vehiculosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehiculos;

    return vehiculos.filter((v) => {
      const fullName = `${v.nombre} ${v.apellidos}`.toLowerCase();
      return (
        fullName.includes(term) ||
        v.carnet_identidad.includes(term) ||
        (v.chapa || '').toLowerCase().includes(term)
      );
    });
  }, [search, vehiculos]);

  const registrarMovimiento = async (vehiculo: VehiculoAutorizado, accion: AccionVehiculo) => {
    if (!usuario) {
      return;
    }

    if (!puertaSeleccionada) {
      toast.error('Seleccione una puerta antes de registrar movimientos');
      return;
    }

    if (!isVehicleAuthorizedNow(vehiculo)) {
      toast.error('Este vehiculo ya no esta autorizado en este momento');
      return;
    }

    setRegistrandoId(vehiculo.id);
    try {
      const payload = {
        vehiculo_id: vehiculo.id,
        conductor_nombre: vehiculo.nombre,
        conductor_apellidos: vehiculo.apellidos,
        carnet_identidad: vehiculo.carnet_identidad,
        tipo: vehiculo.tipo,
        chapa: vehiculo.chapa,
        puerta_id: puertaSeleccionada,
        guardia_id: usuario.id,
        accion,
      };

      const { data, error } = await supabase
        .from('registros_vehiculos')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      await registrarLog(
        accion === 'entrada' ? 'vehiculo_entrada' : 'vehiculo_salida',
        'vehiculo',
        vehiculo.id,
        {
          registro_id: data.id,
          chapa: vehiculo.chapa,
          puerta_id: puertaSeleccionada,
          accion,
        }
      );

      const referencia = vehiculo.chapa || `${vehiculo.nombre} ${vehiculo.apellidos}`;
      toast.success(`${accion === 'entrada' ? 'Entrada' : 'Salida'} registrada para ${referencia}`);
      cargarRegistrosHoy();
    } catch (err) {
      toast.error('Error registrando movimiento del vehiculo');
      console.error(err);
    } finally {
      setRegistrandoId(null);
    }
  };

  const columns = [
    {
      key: 'conductor',
      header: 'Conductor',
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        return (
          <div>
            <p className="font-medium text-uci-gray-800">{v.nombre} {v.apellidos}</p>
            <p className="text-xs text-uci-gray-500">CI: {v.carnet_identidad}</p>
          </div>
        );
      },
    },
    { key: 'tipo', header: 'Tipo' },
    {
      key: 'chapa',
      header: 'Chapa / Color',
      render: (item: Record<string, unknown>) => String(item.chapa || '—'),
    },
    {
      key: 'vigencia',
      header: 'Autorizado hasta',
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        return (
          <span>
            {format(new Date(`${v.acceso_hasta}T00:00:00`), 'dd/MM/yyyy', { locale: es })} 22:00
          </span>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        const loadingRow = registrandoId === v.id;

        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              loading={loadingRow}
              onClick={() => registrarMovimiento(v, 'entrada')}
              icon={<LogIn size={14} />}
            >
              Entrada
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={loadingRow}
              onClick={() => registrarMovimiento(v, 'salida')}
              icon={<LogOut size={14} />}
            >
              Salida
            </Button>
          </div>
        );
      },
    },
  ];

  const registrosColumns = [
    {
      key: 'fecha_hora',
      header: 'Fecha/Hora',
      render: (item: Record<string, unknown>) =>
        format(new Date(item.fecha_hora as string), 'dd/MM/yyyy HH:mm:ss', { locale: es }),
    },
    {
      key: 'chapa',
      header: 'Chapa / Color',
      render: (item: Record<string, unknown>) => String(item.chapa || '—'),
    },
    {
      key: 'conductor',
      header: 'Conductor',
      render: (item: Record<string, unknown>) =>
        `${String(item.conductor_nombre || '')} ${String(item.conductor_apellidos || '')}`.trim(),
    },
    {
      key: 'accion',
      header: 'Accion',
      render: (item: Record<string, unknown>) => (
        <StatusBadge
          status={item.accion === 'entrada' ? 'success' : 'danger'}
          label={item.accion === 'entrada' ? 'Entrada' : 'Salida'}
          size="sm"
        />
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
            <CarFront size={26} className="text-uci-primary" />
            Control de Vehiculos
          </h2>
          <p className="text-sm sm:text-base text-uci-gray-500 mt-1">
            Vehiculos autorizados hoy (vigencia hasta las 10:00 pm del dia definido)
          </p>
        </div>
        <Button variant="ghost" onClick={cargarTodo} icon={<RefreshCw size={16} />} size="sm">
          Actualizar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-uci-gray-200 p-4 mb-4 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-uci-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, CI, chapa o color..."
              className="w-full pl-9 pr-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-uci-primary" />
            <select
              value={puertaSeleccionada}
              onChange={(e) => setPuertaSeleccionada(e.target.value)}
              className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            >
              <option value="">Seleccione una puerta para registrar</option>
              {puertas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.ubicacion ? `- ${p.ubicacion}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={vehiculosFiltrados as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No hay vehiculos autorizados en este momento"
      />

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-uci-gray-900 mb-3">Ultimos movimientos del dia</h3>
        <DataTable
          columns={registrosColumns}
          data={registrosHoy as unknown as Record<string, unknown>[]}
          loading={false}
          emptyMessage="Sin movimientos registrados hoy"
        />
      </div>
    </div>
  );
}
