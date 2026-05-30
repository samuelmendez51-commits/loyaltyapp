-- =====================================================================
-- MIGRACIÓN V15: Personalización Estética de Tarjetas y Ticket de Ruleta
-- =====================================================================

-- 1. Agregar soporte para Logotipo y Banner Portada específicos por programa
ALTER TABLE programas_fidelidad ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE programas_fidelidad ADD COLUMN IF NOT EXISTS portada_url TEXT;

-- 2. Agregar monto mínimo de compra para poder girar la ruleta
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS monto_minimo_ruleta DECIMAL(10,2) DEFAULT 0.00;
