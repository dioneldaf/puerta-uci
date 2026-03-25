import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CarFront, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { registrarLog } from '../lib/logger';
import { supabase } from '../lib/supabase';
import type { TipoVehiculo, VehiculoAutorizado } from '../types';

interface VehicleFormData {
  nombre: string;
  apellidos: string;
  carnet_identidad: string;
  tipo: TipoVehiculo;
  chapa: string;
  acceso_hasta: string;
}

const DEFAULT_FORM: VehicleFormData = {
  nombre: '',
  apellidos: '',
  carnet_identidad: '',
  tipo: 'auto',
  chapa: '',
  acceso_hasta: '',
};

function getTodayKey(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getVehicleStatus(vehicle: VehiculoAutorizado): 'vigente' | 'expirado' | 'inactivo' {
  if (!vehicle.activo) {
    return 'inactivo';
  }

  const hoy = getTodayKey();
  if (hoy > vehicle.acceso_hasta) {
    return 'expirado';
  }

  if (hoy === vehicle.acceso_hasta) {
    const ahora = new Date();
    const h = ahora.getHours();
    const min = ahora.getMinutes();
    const sec = ahora.getSeconds();
    if (h > 22 || (h === 22 && (min > 0 || sec > 0))) {
      return 'expirado';
    }
  }

  return 'vigente';
}

function normalizeVehicleIdentifier(tipo: TipoVehiculo, value: string): string {
  const trimmed = value.trim();
  if (tipo === 'auto') {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export default function VehiclesPage() {
  const { usuario } = useAuth();
  const [vehiculos, setVehiculos] = useState<VehiculoAutorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehiculoAutorizado | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState<VehicleFormData>(DEFAULT_FORM);

  const cargarVehiculos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vehiculos_autorizados')
      .select('*')
      .order('acceso_hasta', { ascending: false })
      .order('nombre');

    if (error) {
      toast.error('Error cargando vehiculos');
      console.error(error);
    } else {
      setVehiculos((data || []) as VehiculoAutorizado[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    cargarVehiculos();
  }, [cargarVehiculos]);

  const abrirCrear = () => {
    setEditingVehicle(null);
    setFormData(DEFAULT_FORM);
    setShowModal(true);
  };

  const abrirEditar = (vehicle: VehiculoAutorizado) => {
    setEditingVehicle(vehicle);
    setFormData({
      nombre: vehicle.nombre,
      apellidos: vehicle.apellidos,
      carnet_identidad: vehicle.carnet_identidad,
      tipo: vehicle.tipo,
      chapa: vehicle.chapa || '',
      acceso_hasta: vehicle.acceso_hasta,
    });
    setShowModal(true);
  };

  const validarFormulario = (): boolean => {
    if (
      !formData.nombre.trim() ||
      !formData.apellidos.trim() ||
      !formData.carnet_identidad.trim() ||
      !formData.acceso_hasta
    ) {
      toast.error('Todos los campos son obligatorios');
      return false;
    }

    if (formData.tipo === 'auto' && !formData.chapa.trim()) {
      toast.error('La chapa es obligatoria para autos');
      return false;
    }

    if (!/^\d{11}$/.test(formData.carnet_identidad.trim())) {
      toast.error('El CI debe tener exactamente 11 digitos');
      return false;
    }

    return true;
  };

  const guardarVehiculo = async () => {
    if (!validarFormulario() || !usuario) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        carnet_identidad: formData.carnet_identidad.trim(),
        tipo: formData.tipo,
        chapa: formData.chapa.trim() ? normalizeVehicleIdentifier(formData.tipo, formData.chapa) : null,
        acceso_hasta: formData.acceso_hasta,
        updated_by: usuario.id,
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehiculos_autorizados')
          .update(payload)
          .eq('id', editingVehicle.id);

        if (error) throw error;

        await registrarLog('vehiculo_editado', 'vehiculo', editingVehicle.id, payload);
        toast.success('Vehiculo actualizado');
      } else {
        const { data, error } = await supabase
          .from('vehiculos_autorizados')
          .insert({
            ...payload,
            created_by: usuario.id,
          })
          .select('id')
          .single();

        if (error) throw error;

        await registrarLog('vehiculo_creado', 'vehiculo', data.id, payload);
        toast.success('Vehiculo creado');
      }

      setShowModal(false);
      setFormData(DEFAULT_FORM);
      setEditingVehicle(null);
      cargarVehiculos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error guardando vehiculo: ${msg}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (vehicle: VehiculoAutorizado) => {
    try {
      const { error } = await supabase
        .from('vehiculos_autorizados')
        .update({ activo: !vehicle.activo, updated_by: usuario?.id || null })
        .eq('id', vehicle.id);

      if (error) throw error;

      await registrarLog(
        vehicle.activo ? 'vehiculo_desactivado' : 'vehiculo_activado',
        'vehiculo',
        vehicle.id,
        { chapa: vehicle.chapa, nuevoEstado: !vehicle.activo }
      );

      toast.success(vehicle.activo ? 'Vehiculo desactivado' : 'Vehiculo activado');
      cargarVehiculos();
    } catch (err) {
      toast.error('Error cambiando estado del vehiculo');
      console.error(err);
    }
  };

  const eliminarVehiculo = async (vehicle: VehiculoAutorizado) => {
    const referencia = vehicle.chapa || `${vehicle.nombre} ${vehicle.apellidos}`;
    if (!confirm(`¿Eliminar definitivamente el vehiculo ${referencia}?\n\nLos registros y logs se conservaran.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('vehiculos_autorizados')
        .delete()
        .eq('id', vehicle.id);

      if (error) throw error;

      await registrarLog('vehiculo_eliminado', 'vehiculo', vehicle.id, {
        chapa: vehicle.chapa,
        carnet_identidad: vehicle.carnet_identidad,
      });

      toast.success('Vehiculo eliminado');
      cargarVehiculos();
    } catch (err) {
      toast.error('Error eliminando vehiculo');
      console.error(err);
    }
  };

  const filteredVehicles = useMemo(() => {
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
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        return v.chapa || '—';
      },
    },
    {
      key: 'acceso_hasta',
      header: 'Vigencia',
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
      key: 'estado',
      header: 'Estado',
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        const status = getVehicleStatus(v);

        if (status === 'vigente') {
          return <StatusBadge status="success" label="Vigente" size="sm" />;
        }
        if (status === 'expirado') {
          return <StatusBadge status="warning" label="Expirado" size="sm" />;
        }
        return <StatusBadge status="danger" label="Inactivo" size="sm" />;
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (item: Record<string, unknown>) => {
        const v = item as unknown as VehiculoAutorizado;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                abrirEditar(v);
              }}
              className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-uci-primary transition-colors"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleActivo(v);
              }}
              className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-status-warning transition-colors"
              title={v.activo ? 'Desactivar' : 'Activar'}
            >
              {v.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eliminarVehiculo(v);
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-uci-gray-500 hover:text-status-danger transition-colors"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
            <CarFront size={26} className="text-uci-primary" />
            Vehiculos Autorizados
          </h2>
          <p className="text-sm sm:text-base text-uci-gray-500 mt-1">
            Gestion de vehiculos con acceso permitido hasta las 10:00 pm de la fecha definida
          </p>
        </div>
        <Button onClick={abrirCrear} icon={<Plus size={18} />}>
          Nuevo Vehiculo
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-uci-gray-200 p-4 mb-4 shadow-card">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, CI o chapa..."
          className="w-full px-3 py-2 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredVehicles as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No hay vehiculos registrados"
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVehicle ? 'Editar Vehiculo' : 'Nuevo Vehiculo'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">Apellidos *</label>
              <input
                type="text"
                value={formData.apellidos}
                onChange={(e) => setFormData((prev) => ({ ...prev, apellidos: e.target.value }))}
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">CI *</label>
              <input
                type="text"
                value={formData.carnet_identidad}
                onChange={(e) => setFormData((prev) => ({ ...prev, carnet_identidad: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                placeholder="11 digitos"
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData((prev) => ({ ...prev, tipo: e.target.value as TipoVehiculo }))}
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              >
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
                <option value="triciclo">Triciclo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
                {formData.tipo === 'auto' ? 'Chapa *' : 'Chapa o color'}
              </label>
              <input
                type="text"
                value={formData.chapa}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    chapa: prev.tipo === 'auto' ? e.target.value.toUpperCase() : e.target.value,
                  }))
                }
                placeholder={formData.tipo === 'auto' ? 'Ej: P123456' : 'Ej: Rojo o P123456'}
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">Acceso hasta *</label>
              <input
                type="date"
                value={formData.acceso_hasta}
                onChange={(e) => setFormData((prev) => ({ ...prev, acceso_hasta: e.target.value }))}
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
              <p className="text-xs text-uci-gray-500 mt-1">Vigente hasta las 10:00 pm de ese dia</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarVehiculo} loading={saving}>
              {editingVehicle ? 'Guardar Cambios' : 'Crear Vehiculo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
