import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  CarFront,
  ScanLine,
  ClipboardList,
  DoorOpen,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  ScrollText,
  X,
} from 'lucide-react';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-uci-primary text-white shadow-sm'
      : 'text-uci-gray-600 hover:bg-uci-gray-100 hover:text-uci-gray-800'
  }`;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isAdmin } = useAuth();
  const location = useLocation();

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed md:static top-16 left-0 z-50 md:z-auto w-64 bg-white border-r border-uci-gray-200 h-[calc(100vh-4rem)] p-4 flex flex-col transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between md:hidden mb-2 px-1">
          <p className="text-sm font-semibold text-uci-gray-500">Navegación</p>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-uci-gray-600 hover:bg-uci-gray-100"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
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
        <NavLink to="/control-vehiculos" className={navItemClass}>
          <CarFront size={18} />
          Control de Vehiculos
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
            <NavLink to="/vehiculos" className={navItemClass}>
              <CarFront size={18} />
              Vehiculos
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
            <img src="/logo-puerta-uci.png" alt="Puerta UCI" className="h-9 w-auto object-contain opacity-75" />
            <span className="text-xs text-uci-gray-400">
              Sistema de Control v1.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
