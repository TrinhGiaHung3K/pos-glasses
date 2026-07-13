-- POS Glasses Customer Member Barcode Migration
-- Purpose: Add customer member barcodes for POS counter scanning.
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

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
    IN table_name_value VARCHAR(64),
    IN index_name_value VARCHAR(64),
    IN ddl_value TEXT
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

DELIMITER ;

CALL add_column_if_missing('customers', 'member_code', 'ALTER TABLE `customers` ADD COLUMN `member_code` varchar(32) DEFAULT NULL AFTER `id`');

UPDATE `customers`
JOIN (
    SELECT source.`id`,
           CONCAT(
               source.body,
               MOD(10 - MOD(
                   CAST(SUBSTRING(source.body, 1, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 2, 1) AS UNSIGNED) * 3 +
                   CAST(SUBSTRING(source.body, 3, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 4, 1) AS UNSIGNED) * 3 +
                   CAST(SUBSTRING(source.body, 5, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 6, 1) AS UNSIGNED) * 3 +
                   CAST(SUBSTRING(source.body, 7, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 8, 1) AS UNSIGNED) * 3 +
                   CAST(SUBSTRING(source.body, 9, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 10, 1) AS UNSIGNED) * 3 +
                   CAST(SUBSTRING(source.body, 11, 1) AS UNSIGNED) +
                   CAST(SUBSTRING(source.body, 12, 1) AS UNSIGNED) * 3,
                   10
               ), 10)
           ) AS member_code
    FROM (
        SELECT `id`, CONCAT('29', LPAD(`id`, 10, '0')) AS body
        FROM `customers`
    ) source
) member_codes ON member_codes.`id` = `customers`.`id`
SET `customers`.`member_code` = member_codes.member_code
WHERE `customers`.`member_code` IS NULL
   OR `customers`.`member_code` <> member_codes.member_code;

CALL add_index_if_missing('customers', 'idx_customers_member_code', 'ALTER TABLE `customers` ADD UNIQUE INDEX `idx_customers_member_code` (`member_code`)');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
