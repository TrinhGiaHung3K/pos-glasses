-- POS Glasses Counter Checkout Migration
-- Purpose: Add payment and discount fields for atomic POS checkout.
USE `pos_glasses`;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
    IN table_name_value VARCHAR(64),
    IN column_name_value VARCHAR(64),
    IN ddl_value TEXT
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

DELIMITER ;

CALL add_column_if_missing('orders', 'subtotal_amount', 'ALTER TABLE `orders` ADD COLUMN `subtotal_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `status`');
CALL add_column_if_missing('orders', 'discount_amount', 'ALTER TABLE `orders` ADD COLUMN `discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `subtotal_amount`');
CALL add_column_if_missing('orders', 'manual_discount_type', 'ALTER TABLE `orders` ADD COLUMN `manual_discount_type` varchar(20) DEFAULT NULL AFTER `discount_percent`');
CALL add_column_if_missing('orders', 'manual_discount_value', 'ALTER TABLE `orders` ADD COLUMN `manual_discount_value` decimal(12,2) NOT NULL DEFAULT 0 AFTER `manual_discount_type`');
CALL add_column_if_missing('orders', 'payment_method', 'ALTER TABLE `orders` ADD COLUMN `payment_method` varchar(30) NOT NULL DEFAULT ''cash'' AFTER `manual_discount_value`');
CALL add_column_if_missing('orders', 'amount_paid', 'ALTER TABLE `orders` ADD COLUMN `amount_paid` decimal(12,2) NOT NULL DEFAULT 0 AFTER `payment_method`');
CALL add_column_if_missing('orders', 'change_amount', 'ALTER TABLE `orders` ADD COLUMN `change_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `amount_paid`');

UPDATE `orders`
SET `subtotal_amount` = CASE WHEN `subtotal_amount` = 0 THEN IFNULL(`total_amount`, 0) ELSE `subtotal_amount` END,
    `amount_paid` = CASE WHEN `amount_paid` = 0 THEN IFNULL(`total_amount`, 0) ELSE `amount_paid` END
WHERE `source` IS NOT NULL;

DROP PROCEDURE IF EXISTS add_column_if_missing;
