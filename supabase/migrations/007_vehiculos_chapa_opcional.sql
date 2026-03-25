-- ============================================================
-- MIGRACION 007: Chapa opcional para motos/triciclos
-- ============================================================

-- Permitir chapa nula en vehiculos autorizados
ALTER TABLE vehiculos_autorizados
  ALTER COLUMN chapa DROP NOT NULL;

-- Permitir chapa nula en registros
ALTER TABLE registros_vehiculos
  ALTER COLUMN chapa DROP NOT NULL;

-- Normalizar strings vacios a NULL para evitar basura de datos
UPDATE vehiculos_autorizados
SET chapa = NULL
WHERE chapa IS NOT NULL AND btrim(chapa) = '';

UPDATE registros_vehiculos
SET chapa = NULL
WHERE chapa IS NOT NULL AND btrim(chapa) = '';
