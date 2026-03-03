import { supabase } from './supabase';
import type { LogSistema } from '../types';

type LogAccion =
  | 'login'
  | 'logout'
  | 'acceso_permitido'
  | 'acceso_denegado'
  | 'acceso_cancelado'
  | 'persona_creada'
  | 'persona_actualizada'
  | 'persona_buscada'
  | 'puerta_creada'
  | 'puerta_editada'
  | 'puerta_eliminada'
  | 'puerta_activada'
  | 'puerta_desactivada'
  | 'guardia_creado'
  | 'guardia_editado'
  | 'guardia_eliminado'
  | 'guardia_activado'
  | 'guardia_desactivado'
  | 'admin_creado'
  | 'admin_editado'
  | 'admin_eliminado'
  | 'exportacion_excel'
  | 'error_sistema';

type LogEntidad = 'puerta' | 'guardia' | 'admin' | 'acceso' | 'persona' | 'auth' | 'sistema';

/**
 * Registrar una acción en el log del sistema
 */
export async function registrarLog(
  accion: LogAccion,
  entidad: LogEntidad,
  entidadId?: string,
  detalles?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const logEntry: Partial<LogSistema> = {
      usuario_id: user?.id || null,
      accion,
      entidad,
      entidad_id: entidadId || null,
      detalles: detalles || {},
    };

    const { error } = await supabase
      .from('logs_sistema')
      .insert(logEntry);

    if (error) {
      console.error('Error registrando log:', error);
    }
  } catch (err) {
    console.error('Error en registrarLog:', err);
  }
}

/**
 * Obtener logs del sistema con paginación
 */
export async function obtenerLogs(
  page: number = 1,
  pageSize: number = 50,
  filtros?: {
    accion?: string;
    entidad?: string;
    usuario_id?: string;
    desde?: string;
    hasta?: string;
  }
): Promise<{ data: LogSistema[]; count: number }> {
  let query = supabase
    .from('logs_sistema')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filtros?.accion) {
    query = query.eq('accion', filtros.accion);
  }
  if (filtros?.entidad) {
    query = query.eq('entidad', filtros.entidad);
  }
  if (filtros?.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id);
  }
  if (filtros?.desde) {
    query = query.gte('created_at', filtros.desde);
  }
  if (filtros?.hasta) {
    query = query.lte('created_at', filtros.hasta);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  
  if (error) throw error;
  
  return { data: data || [], count: count || 0 };
}
