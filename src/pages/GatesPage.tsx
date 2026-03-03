import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import type { Puerta } from '../types';
import { DoorOpen, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GatesPage() {
  const [puertas, setPuertas] = useState<Puerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPuerta, setEditingPuerta] = useState<Puerta | null>(null);
  const [formData, setFormData] = useState({ nombre: '', ubicacion: '' });
  const [saving, setSaving] = useState(false);

  const cargarPuertas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('puertas')
      .select('*')
      .order('nombre');

    if (error) {
      toast.error('Error cargando puertas');
      console.error(error);
    } else {
      setPuertas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarPuertas();
  }, [cargarPuertas]);

  const abrirCrear = () => {
    setEditingPuerta(null);
    setFormData({ nombre: '', ubicacion: '' });
    setShowModal(true);
  };

  const abrirEditar = (puerta: Puerta) => {
    setEditingPuerta(puerta);
    setFormData({ nombre: puerta.nombre, ubicacion: puerta.ubicacion || '' });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      if (editingPuerta) {
        const { error } = await supabase
          .from('puertas')
          .update({ nombre: formData.nombre, ubicacion: formData.ubicacion || null })
          .eq('id', editingPuerta.id);

        if (error) throw error;
        await registrarLog('puerta_editada', 'puerta', editingPuerta.id, {
          nombre: formData.nombre,
          ubicacion: formData.ubicacion,
        });
        toast.success('Puerta actualizada');
      } else {
        const { data, error } = await supabase
          .from('puertas')
          .insert({ nombre: formData.nombre, ubicacion: formData.ubicacion || null })
          .select()
          .single();

        if (error) throw error;
        await registrarLog('puerta_creada', 'puerta', data.id, {
          nombre: formData.nombre,
          ubicacion: formData.ubicacion,
        });
        toast.success('Puerta creada');
      }

      setShowModal(false);
      cargarPuertas();
    } catch (err) {
      toast.error(editingPuerta ? 'Error actualizando puerta' : 'Error creando puerta');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActiva = async (puerta: Puerta) => {
    try {
      const { error } = await supabase
        .from('puertas')
        .update({ activa: !puerta.activa })
        .eq('id', puerta.id);

      if (error) throw error;

      const accion = puerta.activa ? 'puerta_desactivada' : 'puerta_activada';
      await registrarLog(accion, 'puerta', puerta.id, {
        nombre: puerta.nombre,
        nuevoEstado: !puerta.activa,
      });

      toast.success(puerta.activa ? 'Puerta desactivada' : 'Puerta activada');
      cargarPuertas();
    } catch (err) {
      toast.error('Error cambiando estado');
      console.error(err);
    }
  };

  const eliminar = async (puerta: Puerta) => {
    if (!confirm(`¿Está seguro de eliminar la puerta "${puerta.nombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('puertas')
        .delete()
        .eq('id', puerta.id);

      if (error) {
        if (error.message.includes('violates foreign key')) {
          toast.error('No se puede eliminar: tiene registros asociados');
        } else {
          throw error;
        }
        return;
      }

      await registrarLog('puerta_eliminada', 'puerta', puerta.id, {
        nombre: puerta.nombre,
      });
      toast.success('Puerta eliminada');
      cargarPuertas();
    } catch (err) {
      toast.error('Error eliminando puerta');
      console.error(err);
    }
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'ubicacion',
      header: 'Ubicación',
      render: (item: Record<string, unknown>) => (item.ubicacion as string) || '—',
    },
    {
      key: 'activa',
      header: 'Estado',
      render: (item: Record<string, unknown>) => (
        <StatusBadge
          status={item.activa ? 'success' : 'danger'}
          label={item.activa ? 'Activa' : 'Inactiva'}
          size="sm"
        />
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (item: Record<string, unknown>) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); abrirEditar(item as unknown as Puerta); }}
            className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-uci-primary transition-colors"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleActiva(item as unknown as Puerta); }}
            className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-status-warning transition-colors"
            title={item.activa ? 'Desactivar' : 'Activar'}
          >
            {item.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); eliminar(item as unknown as Puerta); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-uci-gray-500 hover:text-status-danger transition-colors"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-uci-gray-900 flex items-center gap-2">
            <DoorOpen size={28} className="text-uci-primary" />
            Gestión de Puertas
          </h2>
          <p className="text-uci-gray-500 mt-1">
            Administrar las puertas de acceso a la UCI
          </p>
        </div>
        <Button onClick={abrirCrear} icon={<Plus size={18} />}>
          Nueva Puerta
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={puertas as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No hay puertas registradas"
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPuerta ? 'Editar Puerta' : 'Nueva Puerta'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Nombre <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Puerta Principal"
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Ubicación
            </label>
            <input
              type="text"
              value={formData.ubicacion}
              onChange={(e) => setFormData(prev => ({ ...prev, ubicacion: e.target.value }))}
              placeholder="Ej: Entrada lateral este"
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={saving}>
              {editingPuerta ? 'Guardar Cambios' : 'Crear Puerta'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
