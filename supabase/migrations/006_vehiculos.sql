-- ============================================================
-- MIGRACION: Modulo de Vehiculos
-- ============================================================

-- 1. Tabla de vehiculos autorizados
CREATE TABLE IF NOT EXISTS vehiculos_autorizados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  carnet_identidad TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('auto', 'moto', 'triciclo')),
  chapa TEXT UNIQUE,
  acceso_hasta DATE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Registros de entradas/salidas de vehiculos
-- Nota: se guardan campos snapshot para conservar historial
-- aunque el vehiculo se elimine definitivamente.
CREATE TABLE IF NOT EXISTS registros_vehiculos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id UUID REFERENCES vehiculos_autorizados(id) ON DELETE SET NULL,
  conductor_nombre TEXT NOT NULL,
  conductor_apellidos TEXT NOT NULL,
  carnet_identidad TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('auto', 'moto', 'triciclo')),
  chapa TEXT,
  puerta_id UUID NOT NULL REFERENCES puertas(id) ON DELETE RESTRICT,
  guardia_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  accion TEXT NOT NULL CHECK (accion IN ('entrada', 'salida')),
  fecha_hora TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vehiculos_chapa ON vehiculos_autorizados(chapa);
CREATE INDEX IF NOT EXISTS idx_vehiculos_ci ON vehiculos_autorizados(carnet_identidad);
CREATE INDEX IF NOT EXISTS idx_vehiculos_hasta ON vehiculos_autorizados(acceso_hasta);
CREATE INDEX IF NOT EXISTS idx_vehiculos_activo ON vehiculos_autorizados(activo);

CREATE INDEX IF NOT EXISTS idx_reg_vehiculos_fecha ON registros_vehiculos(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_reg_vehiculos_chapa ON registros_vehiculos(chapa);
CREATE INDEX IF NOT EXISTS idx_reg_vehiculos_guardia ON registros_vehiculos(guardia_id);
CREATE INDEX IF NOT EXISTS idx_reg_vehiculos_puerta ON registros_vehiculos(puerta_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER tr_vehiculos_updated_at
  BEFORE UPDATE ON vehiculos_autorizados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE vehiculos_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_vehiculos ENABLE ROW LEVEL SECURITY;

-- Vehiculos autorizados: todos pueden leer, solo admin modifica
CREATE POLICY "vehiculos_select"
  ON vehiculos_autorizados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "vehiculos_insert"
  ON vehiculos_autorizados FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "vehiculos_update"
  ON vehiculos_autorizados FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "vehiculos_delete"
  ON vehiculos_autorizados FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Registros vehiculos: guardias y admins pueden crear/leer
CREATE POLICY "registros_vehiculos_select"
  ON registros_vehiculos FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY "registros_vehiculos_insert"
  ON registros_vehiculos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());
