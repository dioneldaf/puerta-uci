import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertCircle } from 'lucide-react';
import Button from '../components/common/Button';

export default function LoginPage() {
  const { signIn, profileError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const displayError = error || profileError || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message === 'Invalid login credentials'
            ? 'Credenciales inválidas. Verifique su email y contraseña.'
            : err.message
          : 'Error al iniciar sesión'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-uci-gray-100 via-white to-uci-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-2xl shadow-lg mb-4">
            <img src="/logo-uci.png" alt="PuertaUCI" className="w-28 h-28" />
          </div>
          <h1 className="text-2xl font-bold text-uci-gray-900 tracking-tight">
            PuertaUCI
          </h1>
          <p className="text-uci-gray-500 mt-1">
            Control de Acceso al Campus
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-card border border-uci-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-uci-gray-100">
            <Shield size={20} className="text-uci-primary" />
            <h2 className="text-lg font-semibold text-uci-gray-800">
              Iniciar Sesión
            </h2>
          </div>

          {displayError && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={18} className="text-status-danger mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-uci-gray-700 mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@uci.cu"
                className="w-full px-4 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none transition-all placeholder:text-uci-gray-400"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-uci-gray-700 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-uci-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-uci-secondary focus:border-uci-secondary outline-none transition-all placeholder:text-uci-gray-400"
              />
            </div>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Iniciar Sesión
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-uci-gray-400 mt-6">
          Universidad de las Ciencias Informáticas · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
