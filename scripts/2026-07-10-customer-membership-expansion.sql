-- POS Glasses: membership expansion for explicit staff registration
-- Idempotent helpers; prefer server bootstrap (ensureCustomerMemberColumns) in app.
USE `pos_glasses`;

-- Profile
ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `gender` varchar(16) NOT NULL DEFAULT 'unknown' AFTER `address`,
  ADD COLUMN IF NOT EXISTS `date_of_birth` date DEFAULT NULL AFTER `gender`,
  ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL AFTER `date_of_birth`;

-- Membership lifecycle (extensible string codes, not rigid ENUMs)
ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `membership_status` varchar(20) NOT NULL DEFAULT 'active' AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `membership_tier` varchar(20) NOT NULL DEFAULT 'standard' AFTER `membership_status`,
  ADD COLUMN IF NOT EXISTS `member_since` datetime DEFAULT NULL AFTER `membership_tier`,
  ADD COLUMN IF NOT EXISTS `registered_by` int DEFAULT NULL AFTER `member_since`;

-- Indexes (run once; ignore if already exists in manual runs)
-- UNIQUE phone for duplicate prevention at quầy
-- CREATE UNIQUE INDEX idx_customers_phone ON customers (phone);
-- CREATE INDEX idx_customers_membership_status ON customers (membership_status);
-- CREATE INDEX idx_customers_membership_tier ON customers (membership_tier);

UPDATE `customers`
SET `member_since` = COALESCE(`member_since`, `created_at`, NOW())
WHERE `member_code` IS NOT NULL
  AND `member_since` IS NULL;

UPDATE `customers` SET `membership_status` = 'active' WHERE `membership_status` IS NULL OR `membership_status` = '';
UPDATE `customers` SET `membership_tier` = 'standard' WHERE `membership_tier` IS NULL OR `membership_tier` = '';
UPDATE `customers` SET `gender` = 'unknown' WHERE `gender` IS NULL OR `gender` = '';
