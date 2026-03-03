-- ============================================================
-- MIGRACIÓN: Control de Acceso UCI
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de puertas (gates)
CREATE TABLE IF NOT EXISTS puertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de usuarios del sistema (guardias y admins)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'guardia')),
  activo BOOLEAN DEFAULT true,
  puerta_asignada UUID REFERENCES puertas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de personas (personas de la UCI buscadas)
CREATE TABLE IF NOT EXISTS personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  primer_apellido TEXT NOT NULL,
  segundo_apellido TEXT,
  carnet_identidad TEXT NOT NULL UNIQUE,
  numero_solapin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de registros de acceso
CREATE TABLE IF NOT EXISTS registros_acceso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  puerta_id UUID NOT NULL REFERENCES puertas(id) ON DELETE RESTRICT,
  guardia_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_hora TIMESTAMPTZ DEFAULT now(),
  tipo_acceso TEXT NOT NULL CHECK (tipo_acceso IN ('activo', 'inactivo')),
  estado TEXT NOT NULL CHECK (estado IN ('permitido', 'denegado')),
  motivo_acceso TEXT, -- solo para inactivos
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de logs del sistema
CREATE TABLE IF NOT EXISTS logs_sistema (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  entidad TEXT, -- 'puerta', 'guardia', 'admin', 'acceso', 'persona', 'auth'
  entidad_id TEXT,
  detalles JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_personas_carnet ON personas(carnet_identidad);
CREATE INDEX IF NOT EXISTS idx_personas_solapin ON personas(numero_solapin);
CREATE INDEX IF NOT EXISTS idx_registros_persona ON registros_acceso(persona_id);
CREATE INDEX IF NOT EXISTS idx_registros_puerta ON registros_acceso(puerta_id);
CREATE INDEX IF NOT EXISTS idx_registros_guardia ON registros_acceso(guardia_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros_acceso(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_registros_estado ON registros_acceso(estado);
CREATE INDEX IF NOT EXISTS idx_registros_tipo ON registros_acceso(tipo_acceso);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_accion ON logs_sistema(accion);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_sistema(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_puertas_activa ON puertas(activa);

-- ============================================================
-- FUNCIONES DE ACTUALIZACIÓN AUTOMÁTICA
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_puertas_updated_at
  BEFORE UPDATE ON puertas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE puertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;

-- Funciones SECURITY DEFINER para evitar recursión infinita
-- (estas funciones se ejecutan con privilegios del creador, bypaseando RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'admin'
      AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- === PUERTAS ===
CREATE POLICY "puertas_select"
  ON puertas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "puertas_insert"
  ON puertas FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "puertas_update"
  ON puertas FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "puertas_delete"
  ON puertas FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- === USUARIOS ===
CREATE POLICY "usuarios_select"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "usuarios_insert"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "usuarios_update"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "usuarios_delete"
  ON usuarios FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- === PERSONAS ===
CREATE POLICY "personas_select"
  ON personas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "personas_insert"
  ON personas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "personas_update"
  ON personas FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- === REGISTROS DE ACCESO ===
CREATE POLICY "registros_select"
  ON registros_acceso FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "registros_insert"
  ON registros_acceso FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- === LOGS ===
CREATE POLICY "logs_select"
  ON logs_sistema FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "logs_insert"
  ON logs_sistema FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================
CREATE OR REPLACE VIEW v_registros_completos AS
SELECT
  ra.id,
  ra.fecha_hora,
  ra.tipo_acceso,
  ra.estado,
  ra.motivo_acceso,
  ra.observaciones,
  p.nombre_completo,
  p.primer_apellido,
  p.segundo_apellido,
  p.carnet_identidad,
  p.numero_solapin,
  pu.nombre AS puerta_nombre,
  pu.ubicacion AS puerta_ubicacion,
  u.nombre AS guardia_nombre,
  u.email AS guardia_email
FROM registros_acceso ra
JOIN personas p ON ra.persona_id = p.id
JOIN puertas pu ON ra.puerta_id = pu.id
JOIN usuarios u ON ra.guardia_id = u.id
ORDER BY ra.fecha_hora DESC;

-- ============================================================
-- INSERTAR DATOS INICIALES
-- ============================================================
-- Insertar una puerta de ejemplo
INSERT INTO puertas (nombre, ubicacion, activa)
VALUES 
  ('Puerta Principal', 'Entrada principal de la UCI', true),
  ('Puerta 2', 'Entrada lateral este', true),
  ('Puerta 3', 'Entrada lateral oeste', true)
ON CONFLICT DO NOTHING;
