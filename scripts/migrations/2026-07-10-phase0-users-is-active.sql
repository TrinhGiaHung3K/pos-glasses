-- Phase 0: user disable flag (also applied by src/db/phase0Schema.js)
-- Safe if column already exists when run via bootstrap; migration runner skips if applied.

-- Note: MySQL has no IF NOT EXISTS for ADD COLUMN on older versions.
-- Prefer server bootstrap ensurePhase0Schema for idempotent deploy.
SELECT 1;
