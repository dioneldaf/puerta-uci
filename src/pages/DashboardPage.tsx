import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import {
  ScanLine,
  Users,
  DoorOpen,
  ClipboardList,
  TrendingUp,
  Shield,
} from 'lucide-react';

interface Stats {
  totalAccesos: number;
  accesosHoy: number;
  permitidosHoy: number;
  denegadosHoy: number;
  puertasActivas: number;
  guardiasActivos: number;
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalAccesos: 0,
    accesosHoy: 0,
    permitidosHoy: 0,
    denegadosHoy: 0,
    puertasActivas: 0,
    guardiasActivos: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoyISO = hoy.toISOString();

        const [
          { count: totalAccesos },
          { count: accesosHoy },
          { count: permitidosHoy },
          { count: denegadosHoy },
          { count: puertasActivas },
          { count: guardiasActivos },
        ] = await Promise.all([
          supabase.from('registros_acceso').select('*', { count: 'exact', head: true }),
          supabase.from('registros_acceso').select('*', { count: 'exact', head: true }).gte('fecha_hora', hoyISO),
          supabase.from('registros_acceso').select('*', { count: 'exact', head: true }).gte('fecha_hora', hoyISO).eq('estado', 'permitido'),
          supabase.from('registros_acceso').select('*', { count: 'exact', head: true }).gte('fecha_hora', hoyISO).eq('estado', 'denegado'),
          supabase.from('puertas').select('*', { count: 'exact', head: true }).eq('activa', true),
          supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'guardia').eq('activo', true),
        ]);

        setStats({
          totalAccesos: totalAccesos || 0,
          accesosHoy: accesosHoy || 0,
          permitidosHoy: permitidosHoy || 0,
          denegadosHoy: denegadosHoy || 0,
          puertasActivas: puertasActivas || 0,
          guardiasActivos: guardiasActivos || 0,
        });
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarEstadisticas();
  }, []);

  const statCards = [
    {
      label: 'Accesos Hoy',
      value: stats.accesosHoy,
      icon: <ScanLine size={24} />,
      color: 'text-uci-primary',
      bg: 'bg-blue-50',
    },
    {
      label: 'Permitidos Hoy',
      value: stats.permitidosHoy,
      icon: <TrendingUp size={24} />,
      color: 'text-status-success',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Denegados Hoy',
      value: stats.denegadosHoy,
      icon: <Shield size={24} />,
      color: 'text-status-danger',
      bg: 'bg-red-50',
    },
    {
      label: 'Total Histórico',
      value: stats.totalAccesos,
      icon: <ClipboardList size={24} />,
      color: 'text-uci-secondary',
      bg: 'bg-blue-50',
    },
    {
      label: 'Puertas Activas',
      value: stats.puertasActivas,
      icon: <DoorOpen size={24} />,
      color: 'text-status-warning',
      bg: 'bg-amber-50',
    },
    {
      label: 'Guardias Activos',
      value: stats.guardiasActivos,
      icon: <Users size={24} />,
      color: 'text-uci-primary',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-uci-gray-900">
          Bienvenido, {usuario?.nombre}
        </h2>
        <p className="text-uci-gray-500 mt-1">
          Panel de control del sistema de acceso UCI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-uci-gray-200 p-6 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-uci-gray-500 font-medium">{card.label}</p>
                <p className="text-3xl font-bold text-uci-gray-900 mt-1">
                  {loading ? '...' : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
