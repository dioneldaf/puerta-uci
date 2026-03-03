-- =========================================================
-- Migración 005: Eliminar columna puerta_asignada de usuarios
-- =========================================================
-- Los guardias ya no tienen puerta fija asignada.
-- Cualquier guardia puede trabajar en cualquier puerta,
-- seleccionándola desde la pantalla de control de acceso.
-- =========================================================

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_puerta_asignada_fkey;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS puerta_asignada;
