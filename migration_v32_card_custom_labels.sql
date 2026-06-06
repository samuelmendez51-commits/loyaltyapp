-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN v32: Dynamic Card Labels Customization
-- LoyaltyClub.mx — 2026
-- Ejecutar este script en el editor SQL de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- Agregar campo card_custom_labels a la tabla businesses de tipo JSONB con default
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS card_custom_labels JSONB DEFAULT '{
  "card_title": "TARJETA VIP DIGITAL",
  "reward_instruction": "¡ACUMULA {total_stamps} SELLOS Y OBTÉN TU PREMIO GRATIS!",
  "stamps_suffix": "SELLOS ACUMULADOS",
  "roulette_locked_title": "Ruleta VIP Bloqueada",
  "roulette_locked_desc": "¡Felicidades! Alcanzaste los sellos necesarios. Esta ruleta requiere una compra mínima de ${min_amount} MXN para activarse.",
  "footer_instruction": "Realiza un pedido desde el menú o en caja que iguale o supere este monto."
}'::jsonb;
