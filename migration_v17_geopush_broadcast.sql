-- =====================================================================
-- MIGRACIÓN V17: Configuración de Frecuencia de Notificaciones Geopush
-- =====================================================================

-- Agregar la columna frecuencia_minutos a la tabla configuracion_geopush
ALTER TABLE configuracion_geopush ADD COLUMN IF NOT EXISTS frecuencia_minutos INT DEFAULT 60;

-- Notificar a PostgREST para recargar la caché del esquema de Supabase
NOTIFY pgrst, 'reload schema';
