-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v24: Corrección de Restricción Única de Teléfono de Clientes
-- LoyaltyClub.mx — 2026
-- ═══════════════════════════════════════════════════════════════════

-- 1. Eliminar la restricción de teléfono global única que causa conflictos
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefono_key;

-- 2. Asegurar que la restricción única sea por negocio y teléfono
-- Primero eliminamos si existiera una restricción previa con el mismo nombre para evitar conflictos
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_business_id_telefono_key;
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_business_id_telefono_uq;

-- Agregar la restricción compuesta correcta
ALTER TABLE clientes ADD CONSTRAINT clientes_business_id_telefono_key UNIQUE(business_id, telefono);
