-- =====================================================================
-- MIGRACIÓN V25: Configuración de Frecuencia de Notificaciones Geopush y Filtro Anti-Vecinos
-- Ejecuta este script en el editor SQL de Supabase
-- =====================================================================

-- 1. Agregar las nuevas columnas a la tabla configuracion_geopush
ALTER TABLE configuracion_geopush ADD COLUMN IF NOT EXISTS evitar_molestar_vecinos BOOLEAN DEFAULT true;
ALTER TABLE configuracion_geopush ADD COLUMN IF NOT EXISTS frecuencia_minutos INT DEFAULT 60;

-- 2. Agregar columnas de tracking de ubicación a la tabla clientes para detectar vecinos en registro
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lat_registro NUMERIC;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lng_registro NUMERIC;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_vecino BOOLEAN DEFAULT false;

-- Notificar a PostgREST para recargar la caché del esquema de Supabase
NOTIFY pgrst, 'reload schema';
