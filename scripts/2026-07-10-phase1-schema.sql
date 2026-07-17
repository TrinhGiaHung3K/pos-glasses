-- Phase 1 operational schema (also applied idempotently by src/db/phase1Schema.js on server start)
-- stock ledger, cost, void/refund metadata, promotions admin fields, audit, idempotency

CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `type` varchar(30) NOT NULL,
  `qty` int NOT NULL,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0,
  `ref_type` varchar(40) DEFAULT NULL,
  `ref_id` int DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_product_id` (`product_id`),
  KEY `idx_stock_movements_type` (`type`),
  KEY `idx_stock_movements_ref` (`ref_type`, `ref_id`),
  KEY `idx_stock_movements_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_id` int DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `entity_type` varchar(60) NOT NULL,
  `entity_id` int DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_logs_entity_id` (`entity_type`, `id`),
  KEY `idx_audit_logs_actor` (`actor_id`),
  KEY `idx_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `checkout_idempotency` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idempotency_key` varchar(80) NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `response_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_checkout_idempotency_key_user` (`idempotency_key`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
