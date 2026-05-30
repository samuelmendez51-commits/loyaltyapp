-- ==============================================================
-- MIGRACIÓN V16: Agregar requiere_motivo_sello a la tabla businesses
-- ==============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS requiere_motivo_sello BOOLEAN DEFAULT FALSE;
