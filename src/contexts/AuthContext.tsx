import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/logger';
import type { Usuario } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  session: Session | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isGuardia: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const initDone = useRef(false);
  const usuarioRef = useRef<Usuario | null>(null);

  // Cargar perfil de usuario desde la tabla usuarios
  const cargarPerfil = async (userId: string): Promise<boolean> => {
    try {
      setProfileError(null);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error cargando perfil:', error);
        if (error.code === 'PGRST116') {
          setProfileError('Su usuario no tiene perfil en el sistema. Contacte al administrador.');
        } else {
          setProfileError(`Error cargando perfil: ${error.message}`);
        }
        setUsuario(null);
        usuarioRef.current = null;
        return false;
      }

      if (data && !data.activo) {
        setProfileError('Su cuenta está desactivada. Contacte al administrador.');
        await supabase.auth.signOut();
        setUsuario(null);
        usuarioRef.current = null;
        return false;
      }

      setUsuario(data);
      usuarioRef.current = data;
      return true;
    } catch (err) {
      console.error('Error en cargarPerfil:', err);
      setProfileError('Error inesperado cargando perfil.');
      setUsuario(null);
      usuarioRef.current = null;
      return false;
    }
  };

  useEffect(() => {
    // Obtener sesión actual
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await cargarPerfil(currentSession.user.id);
        }
      } catch (err) {
        console.error('Error en initAuth:', err);
      } finally {
        setLoading(false);
        initDone.current = true;
      }
    };

    initAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Ignorar eventos hasta que la init termine, para evitar race conditions
        if (!initDone.current) return;

        // Si ya tenemos un perfil cargado y la sesión sigue siendo del mismo usuario,
        // no hacer nada (evita pantalla en blanco al cambiar de pestaña)
        if (newSession?.user && usuarioRef.current && newSession.user.id === usuarioRef.current.id) {
          setSession(newSession);
          setUser(newSession.user);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setLoading(true);
          await cargarPerfil(newSession.user.id);
          setLoading(false);
        } else {
          setUsuario(null);
          usuarioRef.current = null;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setProfileError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Cargar perfil inmediatamente después del login
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setUser(authUser);
      const ok = await cargarPerfil(authUser.id);
      if (ok) {
        // Log en background, no bloquear la UI
        registrarLog('login', 'auth', undefined, { email }).catch(() => {});
      }
    }
  };

  const signOut = async () => {
    registrarLog('logout', 'auth').catch(() => {});
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUsuario(null);
    usuarioRef.current = null;
    setUser(null);
    setSession(null);
    setProfileError(null);
  };

  const value: AuthContextType = {
    user,
    usuario,
    session,
    loading,
    profileError,
    signIn,
    signOut,
    isAdmin: usuario?.rol === 'admin',
    isGuardia: usuario?.rol === 'guardia',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
