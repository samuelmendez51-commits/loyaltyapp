-- ============================================================
-- SCRIPT DE LIMPIEZA DE DATOS DE PRUEBA (LoyaltyClub)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Eliminar historial de puntos de clientes de prueba
DELETE FROM historial_puntos
WHERE cliente_id IN (
  SELECT id FROM clientes 
  WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
     OR telefono IN ('3227654321', '3229876543', '3221234567')
);

-- 2. Eliminar eventos de tracking de clientes de prueba
DELETE FROM tracking_events
WHERE cliente_id IN (
  SELECT id FROM clientes 
  WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
     OR telefono IN ('3227654321', '3229876543', '3221234567')
);

-- 3. Eliminar canjes de premios de clientes de prueba
DELETE FROM premios_canjes
WHERE cliente_id IN (
  SELECT id FROM clientes 
  WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
     OR telefono IN ('3227654321', '3229876543', '3221234567')
);

-- 4. Eliminar giros de ruleta (spins) de clientes de prueba
DELETE FROM roulette_spins
WHERE cliente_id IN (
  SELECT id FROM clientes 
  WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
     OR telefono IN ('3227654321', '3229876543', '3221234567')
);

-- 5. Eliminar pedidos (orders) de clientes de prueba o vinculados a sus teléfonos
DELETE FROM orders
WHERE cliente_id IN (
  SELECT id FROM clientes 
  WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
     OR telefono IN ('3227654321', '3229876543', '3221234567')
) OR telefono_cliente IN ('3227654321', '3229876543', '3221234567');

-- 6. Eliminar clientes de prueba
DELETE FROM clientes
WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
   OR telefono IN ('3227654321', '3229876543', '3221234567');

-- 7. Eliminar logs de auditoría huérfanos o relacionados con los clientes de prueba (opcional)
DELETE FROM audit_logs
WHERE metadata->>'telefono' IN ('3227654321', '3229876543', '3221234567')
   OR metadata->>'cliente_id' IN (
     SELECT id::text FROM clientes 
     WHERE nombre IN ('Juan Pérez', 'María Rodríguez', 'Yareli Lozano')
   );

COMMIT;

-- Verificar limpieza
SELECT 'Clientes restantes' as reporte, count(*) FROM clientes;
SELECT 'Pedidos restantes' as reporte, count(*) FROM orders;
