import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
    'Configúralas en el archivo .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cliente aislado solo para crear usuarios via signUp.
 * No persiste sesión ni afecta la sesión del admin actual.
 */
export const supabaseSignUp = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Cliente admin con service_role key para operaciones privilegiadas
 * (crear usuarios sin confirmación de email, etc.)
 * Solo disponible si se configura VITE_SUPABASE_SERVICE_ROLE_KEY en .env
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
