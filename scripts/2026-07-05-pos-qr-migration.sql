-- ============================================================
-- POS Glasses QR Ordering Migration
-- Date: 2026-07-05
-- Purpose: Add fixed table QR ordering without dropping data.
-- ============================================================

USE `pos_glasses`;

CREATE TABLE IF NOT EXISTS `store_tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `qr_token` varchar(80) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_tables_code` (`code`),
  UNIQUE KEY `uq_store_tables_qr_token` (`qr_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `store_tables` (`id`, `code`, `name`, `qr_token`, `is_active`) VALUES
  (1, 'T01', 'Bàn tư vấn 01', 'table-t01-20260705-pos-glasses', 1),
  (2, 'T02', 'Bàn tư vấn 02', 'table-t02-20260705-pos-glasses', 1),
  (3, 'T03', 'Bàn tư vấn 03', 'table-t03-20260705-pos-glasses', 1);

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_value varchar(64),
  IN column_name_value varchar(64),
  IN ddl_value text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND COLUMN_NAME = column_name_value
  ) THEN
    SET @ddl = ddl_value;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN table_name_value varchar(64),
  IN index_name_value varchar(64),
  IN ddl_value text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @ddl = ddl_value;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_fk_if_missing $$
CREATE PROCEDURE add_fk_if_missing(
  IN table_name_value varchar(64),
  IN fk_name_value varchar(64),
  IN ddl_value text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND CONSTRAINT_NAME = fk_name_value
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @ddl = ddl_value;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing('orders', 'table_id', 'ALTER TABLE `orders` ADD COLUMN `table_id` int DEFAULT NULL AFTER `user_id`');
CALL add_column_if_missing('orders', 'table_order_id', 'ALTER TABLE `orders` ADD COLUMN `table_order_id` int DEFAULT NULL AFTER `table_id`');
CALL add_column_if_missing('orders', 'source', 'ALTER TABLE `orders` ADD COLUMN `source` varchar(20) NOT NULL DEFAULT ''staff'' AFTER `table_order_id`');
CALL add_column_if_missing('orders', 'status', 'ALTER TABLE `orders` ADD COLUMN `status` varchar(20) NOT NULL DEFAULT ''completed'' AFTER `source`');

CALL add_index_if_missing('orders', 'idx_orders_table_id', 'ALTER TABLE `orders` ADD INDEX `idx_orders_table_id` (`table_id`)');
CALL add_index_if_missing('orders', 'idx_orders_table_order_id', 'ALTER TABLE `orders` ADD INDEX `idx_orders_table_order_id` (`table_order_id`)');
CALL add_index_if_missing('orders', 'idx_orders_source_status', 'ALTER TABLE `orders` ADD INDEX `idx_orders_source_status` (`source`, `status`)');
CALL add_fk_if_missing('orders', 'fk_orders_store_table', 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_store_table` FOREIGN KEY (`table_id`) REFERENCES `store_tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE');

CREATE TABLE IF NOT EXISTS `table_orders` (
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
  CONSTRAINT `fk_table_orders_table` FOREIGN KEY (`table_id`) REFERENCES `store_tables` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_table_orders_confirmed_order` FOREIGN KEY (`confirmed_order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `table_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  `unit_price_snapshot` decimal(12,2) NOT NULL,
  `product_name_snapshot` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_table_order_items_order_id` (`table_order_id`),
  KEY `idx_table_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_table_order_items_order` FOREIGN KEY (`table_order_id`) REFERENCES `table_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_table_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS add_fk_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_column_if_missing;
