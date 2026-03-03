import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Shield, User } from 'lucide-react';

export default function Header() {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-uci-gray-200 shadow-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 h-16">
        {/* Logo y título */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img
            src="/logo-uci.png"
            alt="UCI"
            className="w-10 h-10"
          />
          <div>
            <h1 className="text-lg font-bold text-uci-primary tracking-tight">
              PuertaUCI
            </h1>
            <p className="text-xs text-uci-gray-500 -mt-0.5">
              Control de Acceso al Campus
            </p>
          </div>
        </div>

        {/* Info del usuario */}
        {usuario && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-uci-gray-50 rounded-lg border border-uci-gray-200">
              {usuario.rol === 'admin' ? (
                <Shield size={16} className="text-uci-primary" />
              ) : (
                <User size={16} className="text-uci-secondary" />
              )}
              <div className="text-sm">
                <span className="font-medium text-uci-gray-800">{usuario.nombre}</span>
                <span className="text-uci-gray-400 mx-1">·</span>
                <span className="text-uci-gray-500 capitalize">{usuario.rol}</span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-uci-gray-600 hover:text-status-danger hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
