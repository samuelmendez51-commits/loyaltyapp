-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v31: Semáforo de Demanda y Despacho Semiautomático
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear tipo de ENUM para demand_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status_enum') THEN
        CREATE TYPE demand_status_enum AS ENUM ('NORMAL', 'MODERADO', 'SATURADO');
    END IF;
END$$;

-- 2. Crear tipo de ENUM para delivery_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status_enum') THEN
        CREATE TYPE delivery_status_enum AS ENUM ('PENDING', 'SHIPPED_SCHEDULED', 'SHIPPED_IMMEDIATE', 'DELIVERED', 'CANCELLED');
    END IF;
END$$;

-- 3. Agregar campo demand_status a la tabla businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS demand_status demand_status_enum DEFAULT 'NORMAL';

-- 4. Agregar campos para control logístico a la tabla orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status delivery_status_enum DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_pickup_time TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_token TEXT DEFAULT NULL;

-- 5. Agregar campo is_active a la tabla businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
