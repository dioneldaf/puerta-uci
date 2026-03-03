-- =========================================================
-- Migración 004: Configurar zona horaria de Cuba
-- =========================================================
-- Establece la zona horaria por defecto a America/Havana
-- para que todas las funciones now() y current_timestamp
-- retornen la hora de Cuba.
-- =========================================================

-- Establecer la zona horaria del servidor a Cuba
ALTER DATABASE postgres SET timezone TO 'America/Havana';

-- Aplicar inmediatamente en la sesión actual
SET timezone = 'America/Havana';

-- Actualizar los defaults de las columnas fecha_hora para usar hora de Cuba explícitamente
ALTER TABLE registros_acceso
  ALTER COLUMN fecha_hora SET DEFAULT (now() AT TIME ZONE 'America/Havana');

ALTER TABLE logs_sistema
  ALTER COLUMN fecha_hora SET DEFAULT (now() AT TIME ZONE 'America/Havana');
