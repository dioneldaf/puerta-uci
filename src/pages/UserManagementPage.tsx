import React, { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin, supabaseSignUp } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import type { Usuario } from '../types';
import { Users, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  rol: 'guardia' | 'admin';
}

export default function UserManagementPage({ rol }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const isGuardia = rol === 'guardia';
  const titulo = isGuardia ? 'Gestión de Guardias' : 'Gestión de Administradores';
  const singular = isGuardia ? 'Guardia' : 'Administrador';

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const { data: users } = await supabase
      .from('usuarios')
      .select('*')
      .eq('rol', rol)
      .order('nombre');
    setUsuarios(users || []);
    setLoading(false);
  }, [rol]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirCrear = () => {
    setEditingUser(null);
    setFormData({ nombre: '', email: '', password: '' });
    setShowModal(true);
  };

  const abrirEditar = (user: Usuario) => {
    setEditingUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: '',
    });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!formData.nombre.trim() || !formData.email.trim()) {
      toast.error('Nombre y email son obligatorios');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Actualizar datos en tabla usuarios
        const updateData: Partial<Usuario> = {
          nombre: formData.nombre,
        };

        const { error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;

        const accionLog = isGuardia ? 'guardia_editado' : 'admin_editado';
        await registrarLog(accionLog, isGuardia ? 'guardia' : 'admin', editingUser.id, {
          nombre: formData.nombre,
          email: formData.email,
        });
        toast.success(`${singular} actualizado`);
      } else {
        // Crear usuario en Supabase Auth
        if (!formData.password || formData.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          setSaving(false);
          return;
        }

        let authUserId: string;

        if (supabaseAdmin) {
          // Usar admin API: crea el usuario con email ya confirmado (sin enviar correo)
          const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
            email: formData.email,
            password: formData.password,
            email_confirm: true,
            user_metadata: {
              nombre: formData.nombre,
              rol: rol,
            },
          });

          if (adminError) throw adminError;
          if (!adminData.user) throw new Error('No se pudo crear el usuario');
          authUserId = adminData.user.id;
        } else {
          // Fallback: signUp con cliente aislado (no afecta la sesión del admin)
          const { data: authData, error: authError } = await supabaseSignUp.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                nombre: formData.nombre,
                rol: rol,
              },
            },
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error('No se pudo crear el usuario');
          authUserId = authData.user.id;
        }

        // Crear perfil en tabla usuarios
        const { error: profileError } = await supabase.from('usuarios').insert({
          id: authUserId,
          nombre: formData.nombre,
          email: formData.email,
          rol,
          activo: true,
        });

        if (profileError) throw profileError;

        const accionLog = isGuardia ? 'guardia_creado' : 'admin_creado';
        await registrarLog(accionLog, isGuardia ? 'guardia' : 'admin', authUserId, {
          nombre: formData.nombre,
          email: formData.email,
        });
        toast.success(`${singular} creado exitosamente`);
      }

      setShowModal(false);
      cargarDatos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error: ${msg}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (user: Usuario) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: !user.activo })
        .eq('id', user.id);

      if (error) throw error;

      const accion = user.activo
        ? (isGuardia ? 'guardia_desactivado' : 'admin_eliminado')
        : (isGuardia ? 'guardia_activado' : 'admin_creado');

      await registrarLog(accion, isGuardia ? 'guardia' : 'admin', user.id, {
        nombre: user.nombre,
        nuevoEstado: !user.activo,
      });

      toast.success(user.activo ? `${singular} desactivado` : `${singular} activado`);
      cargarDatos();
    } catch (err) {
      toast.error('Error cambiando estado');
      console.error(err);
    }
  };

  const eliminar = async (user: Usuario) => {
    if (!confirm(`¿Está seguro de eliminar a "${user.nombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', user.id);

      if (error) {
        if (error.message.includes('violates foreign key')) {
          toast.error('No se puede eliminar: tiene registros asociados. Puede desactivarlo.');
        } else {
          throw error;
        }
        return;
      }

      const accionLog = isGuardia ? 'guardia_eliminado' : 'admin_eliminado';
      await registrarLog(accionLog, isGuardia ? 'guardia' : 'admin', user.id, {
        nombre: user.nombre,
        email: user.email,
      });
      toast.success(`${singular} eliminado`);
      cargarDatos();
    } catch (err) {
      toast.error('Error eliminando usuario');
      console.error(err);
    }
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: Record<string, unknown>) => (
        <StatusBadge
          status={item.activo ? 'success' : 'danger'}
          label={item.activo ? 'Activo' : 'Inactivo'}
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
            onClick={(e) => { e.stopPropagation(); abrirEditar(item as unknown as Usuario); }}
            className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-uci-primary transition-colors"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleActivo(item as unknown as Usuario); }}
            className="p-1.5 rounded-lg hover:bg-uci-gray-100 text-uci-gray-500 hover:text-status-warning transition-colors"
            title={item.activo ? 'Desactivar' : 'Activar'}
          >
            {item.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); eliminar(item as unknown as Usuario); }}
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
            <Users size={28} className="text-uci-primary" />
            {titulo}
          </h2>
          <p className="text-uci-gray-500 mt-1">
            {isGuardia
              ? 'Administrar los guardias del sistema de acceso'
              : 'Administrar los administradores del sistema'}
          </p>
        </div>
        <Button onClick={abrirCrear} icon={<Plus size={18} />}>
          Nuevo {singular}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={usuarios as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage={`No hay ${isGuardia ? 'guardias' : 'administradores'} registrados`}
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? `Editar ${singular}` : `Nuevo ${singular}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Nombre completo <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Nombre y apellidos"
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
              Correo electrónico <span className="text-status-danger">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@uci.cu"
              disabled={!!editingUser}
              className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none disabled:bg-uci-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-uci-gray-700 mb-1.5">
                Contraseña <span className="text-status-danger">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={saving}>
              {editingUser ? 'Guardar Cambios' : `Crear ${singular}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
