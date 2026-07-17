-- =============================================================================
-- POS Glasses — complete schema clone for ERD (MySQL Workbench)
-- Source database : defaultdb
-- Source MySQL    : 8.4.8
-- Source sql_mode : REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,IGNORE_SPACE,ONLY_FULL_GROUP_BY,ANSI,STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
-- Target database : pos_glasses
-- Generated at    : 2026-07-15T19:11:51.212Z
-- Generator       : scripts/export-erd-database-clone.js
--
-- How to use in MySQL Workbench:
--   1) File > New Model
--   2) File > Import > Reverse Engineer MySQL Create Script...
--   3) Select this file
--   4) Select schema/tables > Finish > Arrange Diagram
--
-- Or execute this script on a local MySQL 8.x instance, then:
--   Database > Reverse Engineer... (live connection)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
SET UNIQUE_CHECKS = 0;
SET SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

DROP DATABASE IF EXISTS `pos_glasses`;
CREATE DATABASE `pos_glasses` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pos_glasses`;

-- ------------------------------------------------------------
-- Table structure for `ai_feedback`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `ai_feedback`;
CREATE TABLE `ai_feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `response_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_feedback_user_response` (`user_id`,`response_id`)
);

-- ------------------------------------------------------------
-- Table structure for `ai_usage_logs`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `ai_usage_logs`;
CREATE TABLE `ai_usage_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `use_case` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_version` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_tokens` int NOT NULL DEFAULT '0',
  `output_tokens` int NOT NULL DEFAULT '0',
  `latency_ms` int NOT NULL DEFAULT '0',
  `tool_names_json` json DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_usage_created` (`created_at`),
  KEY `idx_ai_usage_user` (`user_id`)
);

-- ------------------------------------------------------------
-- Table structure for `audit_logs`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_id` int DEFAULT NULL,
  `action` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  `ip` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_logs_entity_id` (`entity_type`,`id`),
  KEY `idx_audit_logs_actor` (`actor_id`),
  KEY `idx_audit_logs_created_at` (`created_at`)
);

-- ------------------------------------------------------------
-- Table structure for `categories`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
);

-- ------------------------------------------------------------
-- Table structure for `checkout_idempotency`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `checkout_idempotency`;
CREATE TABLE `checkout_idempotency` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idempotency_key` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `response_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_checkout_idempotency_key_user` (`idempotency_key`,`user_id`)
);

-- ------------------------------------------------------------
-- Table structure for `customer_prescriptions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `customer_prescriptions`;
CREATE TABLE `customer_prescriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `measured_at` date DEFAULT NULL,
  `doctor_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clinic_name` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `od_sph` decimal(5,2) DEFAULT NULL,
  `od_cyl` decimal(5,2) DEFAULT NULL,
  `od_axis` int DEFAULT NULL,
  `os_sph` decimal(5,2) DEFAULT NULL,
  `os_cyl` decimal(5,2) DEFAULT NULL,
  `os_axis` int DEFAULT NULL,
  `pd` decimal(5,2) DEFAULT NULL,
  `add_power` decimal(5,2) DEFAULT NULL,
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rx_customer` (`customer_id`),
  KEY `idx_rx_active` (`is_active`),
  CONSTRAINT `fk_rx_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `customers`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_code` varchar(32) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `gender` varchar(16) NOT NULL DEFAULT 'unknown',
  `date_of_birth` date DEFAULT NULL,
  `notes` text,
  `membership_status` varchar(20) NOT NULL DEFAULT 'active',
  `membership_tier` varchar(20) NOT NULL DEFAULT 'standard',
  `member_since` datetime DEFAULT NULL,
  `registered_by` int DEFAULT NULL,
  `points_balance` int NOT NULL DEFAULT '0',
  `lifetime_spend` decimal(14,2) NOT NULL DEFAULT '0.00',
  `care_of_user_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customers_member_code` (`member_code`),
  UNIQUE KEY `idx_customers_phone` (`phone`),
  KEY `idx_customers_membership_status` (`membership_status`),
  KEY `idx_customers_membership_tier` (`membership_tier`)
);

-- ------------------------------------------------------------
-- Table structure for `order_details`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `order_details`;
CREATE TABLE `order_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `line_type` varchar(20) NOT NULL DEFAULT 'product',
  `variant_id` int DEFAULT NULL,
  `prescription_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `price` decimal(12,2) NOT NULL,
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `refunded_quantity` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_od_order_id` (`order_id`),
  KEY `idx_od_product_id` (`product_id`),
  CONSTRAINT `fk_od_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_od_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `orders`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `shift_id` int DEFAULT NULL,
  `table_id` int DEFAULT NULL,
  `table_order_id` int DEFAULT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'staff',
  `status` varchar(20) NOT NULL DEFAULT 'completed',
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `coupon_code` varchar(50) DEFAULT NULL,
  `discount_percent` int NOT NULL DEFAULT '0',
  `manual_discount_type` varchar(20) DEFAULT NULL,
  `manual_discount_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(30) NOT NULL DEFAULT 'cash',
  `payment_status` varchar(20) NOT NULL DEFAULT 'paid',
  `amount_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `change_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `void_reason` varchar(500) DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL,
  `voided_by` int DEFAULT NULL,
  `refunded_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `points_earned` int NOT NULL DEFAULT '0',
  `points_redeemed` int NOT NULL DEFAULT '0',
  `points_discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_orders_customer_id` (`customer_id`),
  KEY `idx_orders_user_id` (`user_id`),
  KEY `idx_orders_table_id` (`table_id`),
  KEY `idx_orders_table_order_id` (`table_order_id`),
  KEY `idx_orders_source_status` (`source`,`status`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_store_table` FOREIGN KEY (`table_id`) REFERENCES `store_tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `payment_intents`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `payment_intents`;
CREATE TABLE `payment_intents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `public_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` int DEFAULT NULL,
  `provider` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'order',
  `is_test` tinyint(1) NOT NULL DEFAULT '0',
  `currency` char(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VND',
  `expected_amount` bigint NOT NULL,
  `received_amount` bigint NOT NULL DEFAULT '0',
  `transfer_content` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number_masked` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `expires_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_intents_public_id` (`public_id`),
  UNIQUE KEY `uq_payment_intents_transfer_content` (`transfer_content`),
  KEY `idx_payment_intents_status_expiry` (`status`,`expires_at`),
  KEY `idx_payment_intents_order` (`order_id`)
);

-- ------------------------------------------------------------
-- Table structure for `payment_transactions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `payment_transactions`;
CREATE TABLE `payment_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_transaction_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_intent_id` bigint DEFAULT NULL,
  `account_number_masked` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transfer_type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint NOT NULL,
  `transfer_content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_reference` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_at` datetime DEFAULT NULL,
  `signature_valid` tinyint(1) NOT NULL DEFAULT '0',
  `match_status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unmatched',
  `raw_payload_json` json DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_provider_transaction` (`provider`,`provider_transaction_id`),
  KEY `idx_payment_transactions_intent` (`payment_intent_id`),
  KEY `idx_payment_transactions_match` (`match_status`)
);

-- ------------------------------------------------------------
-- Table structure for `payment_webhook_deliveries`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `payment_webhook_deliveries`;
CREATE TABLE `payment_webhook_deliveries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `signature_valid` tinyint(1) NOT NULL DEFAULT '0',
  `processing_status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_code` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_webhook_delivery` (`provider`,`delivery_key`)
);

-- ------------------------------------------------------------
-- Table structure for `points_ledger`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `points_ledger`;
CREATE TABLE `points_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `delta` int NOT NULL,
  `balance_after` int NOT NULL DEFAULT '0',
  `reason` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` int DEFAULT NULL,
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_points_ledger_customer` (`customer_id`),
  KEY `idx_points_ledger_order` (`order_id`),
  CONSTRAINT `fk_points_ledger_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `product_qr_codes`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `product_qr_codes`;
CREATE TABLE `product_qr_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `public_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_qr_public_code` (`public_code`),
  KEY `idx_product_qr_product_status` (`product_id`,`status`),
  CONSTRAINT `fk_product_qr_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `product_variants`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `product_variants`;
CREATE TABLE `product_variants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `sku` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_override` decimal(12,2) DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_variants_sku` (`sku`),
  KEY `idx_product_variants_product` (`product_id`),
  KEY `idx_product_variants_barcode` (`barcode`),
  CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `products`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `brand` varchar(80) DEFAULT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `original_price` decimal(12,2) DEFAULT NULL,
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `original_cost_price` decimal(12,2) DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `image` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku` (`sku`),
  KEY `idx_products_category_id` (`category_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `promotions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `promotions`;
CREATE TABLE `promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `discount_type` varchar(20) NOT NULL DEFAULT 'percent',
  `discount_percent` int NOT NULL DEFAULT '0',
  `discount_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `min_order_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `max_uses` int DEFAULT NULL,
  `used_count` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `description` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotions_code` (`code`)
);

-- ------------------------------------------------------------
-- Table structure for `purchase_order_items`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE `purchase_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty_ordered` int NOT NULL DEFAULT '0',
  `qty_received` int NOT NULL DEFAULT '0',
  `unit_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_poi_po` (`purchase_order_id`),
  KEY `idx_poi_product` (`product_id`),
  CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `purchase_orders`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ordered_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_supplier` (`supplier_id`),
  KEY `idx_po_status` (`status`),
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `schema_migrations`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `schema_migrations`;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schema_migrations_name` (`name`)
);

-- ------------------------------------------------------------
-- Table structure for `shifts`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `opened_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` datetime DEFAULT NULL,
  `opening_cash` decimal(14,2) NOT NULL DEFAULT '0.00',
  `closing_cash` decimal(14,2) DEFAULT NULL,
  `expected_cash` decimal(14,2) DEFAULT NULL,
  `cash_sales` decimal(14,2) NOT NULL DEFAULT '0.00',
  `card_sales` decimal(14,2) NOT NULL DEFAULT '0.00',
  `bank_sales` decimal(14,2) NOT NULL DEFAULT '0.00',
  `order_count` int NOT NULL DEFAULT '0',
  `void_count` int NOT NULL DEFAULT '0',
  `variance` decimal(14,2) DEFAULT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_shifts_user` (`user_id`),
  KEY `idx_shifts_status` (`status`),
  KEY `idx_shifts_opened` (`opened_at`)
);

-- ------------------------------------------------------------
-- Table structure for `stock_movements`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` int NOT NULL,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `ref_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ref_id` int DEFAULT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_product_id` (`product_id`),
  KEY `idx_stock_movements_type` (`type`),
  KEY `idx_stock_movements_ref` (`ref_type`,`ref_id`),
  KEY `idx_stock_movements_created_at` (`created_at`),
  CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `store_tables`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `store_tables`;
CREATE TABLE `store_tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `qr_token` varchar(80) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_tables_code` (`code`),
  UNIQUE KEY `uq_store_tables_qr_token` (`qr_token`)
);

-- ------------------------------------------------------------
-- Table structure for `suppliers`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_name` (`name`)
);

-- ------------------------------------------------------------
-- Table structure for `table_order_items`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `table_order_items`;
CREATE TABLE `table_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price_snapshot` decimal(12,2) NOT NULL,
  `product_name_snapshot` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_table_order_items_order_id` (`table_order_id`),
  KEY `idx_table_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_table_order_items_order` FOREIGN KEY (`table_order_id`) REFERENCES `table_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_table_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `table_orders`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `table_orders`;
CREATE TABLE `table_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `confirmed_order_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_table_orders_table_id` (`table_id`),
  KEY `idx_table_orders_status` (`status`),
  KEY `idx_table_orders_confirmed_order_id` (`confirmed_order_id`),
  CONSTRAINT `fk_table_orders_confirmed_order` FOREIGN KEY (`confirmed_order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_table_orders_table` FOREIGN KEY (`table_id`) REFERENCES `store_tables` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Table structure for `users`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'staff',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
);

-- ------------------------------------------------------------
-- Table structure for `warranties`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `warranties`;
CREATE TABLE `warranties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `serial_number` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `months` int NOT NULL DEFAULT '12',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warranty_serial` (`serial_number`),
  KEY `idx_warranty_customer` (`customer_id`),
  KEY `idx_warranty_order` (`order_id`),
  KEY `idx_warranty_end` (`end_date`)
);

SET FOREIGN_KEY_CHECKS = 1;
SET UNIQUE_CHECKS = 1;

-- End of schema for `pos_glasses` (28 tables)
