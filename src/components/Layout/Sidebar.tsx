import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ScanLine,
  ClipboardList,
  DoorOpen,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  ScrollText,
} from 'lucide-react';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-uci-primary text-white shadow-sm'
      : 'text-uci-gray-600 hover:bg-uci-gray-100 hover:text-uci-gray-800'
  }`;

export default function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-uci-gray-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col">
      <nav className="flex-1 space-y-1">
        {/* Sección: Operaciones */}
        <p className="px-4 py-2 text-xs font-semibold text-uci-gray-400 uppercase tracking-wider">
          Operaciones
        </p>
        <NavLink to="/control-acceso" className={navItemClass}>
          <ScanLine size={18} />
          Control de Acceso
        </NavLink>
        <NavLink to="/registros" className={navItemClass}>
          <ClipboardList size={18} />
          Registro de Accesos
        </NavLink>

        {/* Sección: Administración (solo admin) */}
        {isAdmin && (
          <>
            <div className="pt-4" />
            <p className="px-4 py-2 text-xs font-semibold text-uci-gray-400 uppercase tracking-wider">
              Administración
            </p>
            <NavLink to="/puertas" className={navItemClass}>
              <DoorOpen size={18} />
              Puertas
            </NavLink>
            <NavLink to="/guardias" className={navItemClass}>
              <Users size={18} />
              Guardias
            </NavLink>
            <NavLink to="/admins" className={navItemClass}>
              <ShieldCheck size={18} />
              Administradores
            </NavLink>
            <NavLink to="/exportar" className={navItemClass}>
              <FileSpreadsheet size={18} />
              Exportar Datos
            </NavLink>
            <NavLink to="/logs" className={navItemClass}>
              <ScrollText size={18} />
              Logs del Sistema
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer del sidebar */}
      <div className="mt-auto pt-4 border-t border-uci-gray-200">
        <div className="flex items-center gap-2 px-4 py-2">
          <img src="/logo-uci.png" alt="UCI" className="w-6 h-6 opacity-40" />
          <span className="text-xs text-uci-gray-400">
            Sistema de Control v1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
