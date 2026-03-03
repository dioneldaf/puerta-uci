-- ============================================================
-- MIGRACIÓN 003: Corregir recursión infinita en RLS
-- 
-- El problema: las políticas de "usuarios" consultan la propia
-- tabla "usuarios" para verificar el rol, causando recursión.
-- Solución: usar una función SECURITY DEFINER que bypasee RLS.
-- ============================================================

-- 1. Función SECURITY DEFINER para verificar rol de admin
--    (se ejecuta como superuser, sin pasar por RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND rol = 'admin'
      AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Función SECURITY DEFINER para verificar si es usuario activo
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. ELIMINAR políticas problemáticas
-- ============================================================

-- Puertas
DROP POLICY IF EXISTS "Usuarios autenticados ven puertas" ON puertas;
DROP POLICY IF EXISTS "Admins gestionan puertas" ON puertas;

-- Usuarios
DROP POLICY IF EXISTS "Usuarios autenticados ven usuarios" ON usuarios;
DROP POLICY IF EXISTS "Admins gestionan usuarios" ON usuarios;

-- Personas
DROP POLICY IF EXISTS "Autenticados ven personas" ON personas;
DROP POLICY IF EXISTS "Autenticados crean personas" ON personas;
DROP POLICY IF EXISTS "Admins actualizan personas" ON personas;

-- Registros
DROP POLICY IF EXISTS "Autenticados ven registros" ON registros_acceso;
DROP POLICY IF EXISTS "Autenticados crean registros" ON registros_acceso;

-- Logs
DROP POLICY IF EXISTS "Autenticados ven logs" ON logs_sistema;
DROP POLICY IF EXISTS "Autenticados crean logs" ON logs_sistema;

-- ============================================================
-- 4. RECREAR políticas usando las funciones SECURITY DEFINER
-- ============================================================

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
-- Todos los autenticados pueden leer su propio perfil y el de otros
CREATE POLICY "usuarios_select"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

-- Solo admins pueden insertar nuevos usuarios
CREATE POLICY "usuarios_insert"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Solo admins pueden actualizar usuarios
CREATE POLICY "usuarios_update"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Solo admins pueden eliminar usuarios
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
