// ============================================================
// Tipos globales de la aplicación
// ============================================================

// --- Supabase / DB ---
export interface Puerta {
  id: string;
  nombre: string;
  ubicacion: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'guardia';
  activo: boolean;
  puerta_asignada: string | null;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  nombre_completo: string;
  primer_apellido: string;
  segundo_apellido: string | null;
  carnet_identidad: string;
  numero_solapin: string | null;
  created_at: string;
  updated_at: string;
}

export type TipoAcceso = 'activo' | 'inactivo';
export type EstadoAcceso = 'permitido' | 'denegado';

export interface RegistroAcceso {
  id: string;
  persona_id: string;
  puerta_id: string;
  guardia_id: string;
  fecha_hora: string;
  tipo_acceso: TipoAcceso;
  estado: EstadoAcceso;
  motivo_acceso: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface RegistroAccesoCompleto extends RegistroAcceso {
  persona?: Persona;
  puerta?: Puerta;
  guardia?: Usuario;
  // From view
  nombre_completo?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  carnet_identidad?: string;
  numero_solapin?: string;
  puerta_nombre?: string;
  puerta_ubicacion?: string;
  guardia_nombre?: string;
  guardia_email?: string;
}

export interface LogSistema {
  id: string;
  usuario_id: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalles: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// --- UCI API ---
export interface UCIPersonaAPI {
  nombre_completo: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  carnet_identidad: string;
  numero_solapin: string;
  solapin_codigobarra: string;
  nombre_rol_universitario: string;
  nombre_estructura_credencial: string;
  nombre_responsabilidad: string;
  interno: boolean;
  baja: boolean;
  apartamento_uci: string | null;
  correo_electronico: string;
  nombre_sexo: string;
  fecha_nacimiento: string;
  edificio_uci: string | null;
}

export interface UCISearchResponse {
  took: number;
  timed_out: boolean;
  hits: {
    total: {
      value: number;
      relation: string;
    };
    hits: Array<{
      _id: string;
      _score: number;
      _source: UCIPersonaAPI;
    }>;
  };
}

// --- UI State ---
export interface PersonaLookupResult {
  found: boolean;
  persona: UCIPersonaAPI | null;
  isActive: boolean; // !baja && found
}

export interface AccessFormData {
  motivo_acceso: string;
  observaciones: string;
}
