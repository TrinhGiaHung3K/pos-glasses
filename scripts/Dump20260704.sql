-- ============================================================
-- MySQL Database Script for POS Glasses
-- Database: pos_glasses
-- Server version: 8.0.46
-- Generated: 2026-07-04 (Fixed: 2026-07-07)
-- ============================================================
-- Fixes applied:
--   1. Correct table creation order (dependency-safe)
--   2. Correct DROP TABLE order (children first)
--   3. Fixed duplicate categories → 4 distinct categories
--   4. All products assigned valid category_id
--   5. Rebalanced retail pricing (1,690,000 to 9,490,000 VND)
--   6. UNIQUE constraints on username, sku, promotion code
--   7. Added timestamps (created_at, updated_at) to products/customers
--   8. Added email to customers, description/dates to promotions
--   9. Complete order_details for all 6 orders
--  10. All changes compatible with the current application schema bootstrap
--  11. Removed restaurant table/QR ordering objects from the retail schema
--  12. Added customer member barcode schema/data for POS scanning
--  13. Switched to utf8mb4_unicode_ci for MySQL/MariaDB portability
--  14. Removed LOCK TABLES/UNLOCK TABLES so imports do not need lock privilege
--  15. Removed seeded login credentials; first admin is bootstrapped from env
-- ============================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- ============================================================
-- Create database (if not exists)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `pos_glasses`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pos_glasses`;

-- ============================================================
-- DROP TABLES in reverse-dependency order (children first)
-- ============================================================

DROP TABLE IF EXISTS `order_details`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `promotions`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

-- ============================================================
-- 1. Table: users (no FK dependencies)
-- ============================================================

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'staff',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users are intentionally not seeded. The application creates the first
-- administrator from BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD.

-- ============================================================
-- 2. Table: categories (no FK dependencies)
-- ============================================================

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` (`id`, `name`) VALUES
  (1, 'Kính mát'),
  (2, 'Kính cận'),
  (3, 'Gọng kính'),
  (4, 'Kính râm thể thao');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;

-- ============================================================
-- 3. Table: customers (no FK dependencies)
-- ============================================================

CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_code` varchar(32) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customers_member_code` (`member_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` (`id`, `member_code`, `name`, `phone`, `email`, `address`) VALUES
  (1, '2900000000018', 'Nguyen Van A', '0901234567', 'nguyenvana@gmail.com',  'Ha Noi'),
  (2, '2900000000025', 'Tran Thi B',   '0912345678', 'tranthib@gmail.com',    'TP HCM'),
  (5, '2900000000056', 'Huynh Van C',  '0123456789', 'huynhvanc@gmail.com',   'Ba Ria');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;

-- ============================================================
-- 4. Table: products (FK → categories)
-- ============================================================

CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT 0,
  `image` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku` (`sku`),
  KEY `idx_products_category_id` (`category_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` (`id`, `category_id`, `name`, `sku`, `price`, `quantity`, `image`) VALUES
  -- RayBan (category 1: Kính mát)
  (1,  1, 'RayBan RB3025 Aviator',          'RB3025', 2990000.00, 6,  'https://images.ray-ban.com/is/image/RayBan/805289602057__STD__shad__qt.png'),
  (7,  1, 'RayBan Aviator Classic',          'RB001',  2890000.00, 20, 'https://images.ray-ban.com/is/image/RayBan/805289602057__STD__shad__qt.png'),
  (20, 1, 'RayBan Clubmaster',               'RBCLB',  2690000.00, 15, 'images/clubmaster.jpg'),
  (21, 1, 'RayBan Wayfarer',                 'RBWAY',  2790000.00, 18, 'images/wayfarer.jpg'),
  (34, 1, 'RayBan Erika RB4171',             'RB4171', 2490000.00, 20, 'images/rayban_erika_rb4171.jpg'),
  (35, 1, 'RayBan Justin RB4165',            'RB4165', 2590000.00, 18, 'images/rayban_justin_rb4165.jpg'),
  (36, 1, 'RayBan Hexagonal RB3548',         'RB3548', 2990000.00, 15, 'images/rayban_hexagonal_rb3548.jpg'),
  (37, 1, 'RayBan Caravan RB3136',           'RB3136', 2790000.00, 22, 'images/rayban_caravan_rb3136.jpg'),
  (38, 1, 'RayBan Round Metal RB3447',       'RB3447', 2690000.00, 16, 'images/rayban_roundmetal_rb3447.jpg'),

  -- Oakley (category 4: Kính râm thể thao)
  (22, 4, 'Oakley Holbrook',                 'OH001',  3290000.00, 12, 'images/oakley_holbrook.jpg'),
  (23, 4, 'Oakley Frogskins',                'OF001',  2890000.00, 10, 'images/oakley_frogskins.jpg'),
  (39, 4, 'Oakley Sutro',                    'OK003',  3890000.00, 25, 'images/oakley_sutro.jpg'),
  (40, 4, 'Oakley Radar EV Path',            'OK004',  4590000.00, 18, 'images/oakley_radar_ev_path.jpg'),
  (41, 4, 'Oakley Flak 2.0 XL',             'OK005',  4290000.00, 20, 'images/oakley_flak2_xl.jpg'),
  (42, 4, 'Oakley Gibston',                  'OK006',  3190000.00, 15, 'images/oakley_gibston.jpg'),
  (43, 4, 'Oakley Encoder',                  'OK007',  4890000.00, 19, 'images/oakley_encoder.jpg'),

  -- Gucci (category 1: Kính mát)
  (24, 1, 'Gucci GG001',                     'GG001',  6490000.00, 8,  'images/gucci_gg001.jpg'),
  (25, 1, 'Gucci GG0061',                    'GG061',  6990000.00, 7,  'images/gucci_gg0061.jpg'),
  (44, 1, 'Gucci GG0396S',                   'GG003',  6790000.00, 12, 'images/gucci_gg0396s.jpg'),
  (45, 1, 'Gucci GG0748S',                   'GG004',  7290000.00, 10, 'images/gucci_gg0748s.jpg'),
  (46, 1, 'Gucci GG0811S',                   'GG005',  7590000.00, 14, 'images/gucci_gg0811s.jpg'),
  (47, 1, 'Gucci GG1221S',                   'GG006',  7990000.00, 13, 'images/gucci_gg1221s.jpg'),

  -- Prada (category 1: Kính mát)
  (26, 1, 'Prada PR17WS',                    'PR17',   5990000.00, 6,  'images/prada_pr17ws.jpg'),
  (27, 1, 'Prada Linea Rossa',               'PRLR',   5490000.00, 9,  'images/prada_linea.jpg'),
  (48, 1, 'Prada Symbole',                   'PR003',  6290000.00, 15, 'images/prada_symbole.jpg'),
  (49, 1, 'Prada PR16WS',                    'PR004',  6090000.00, 17, 'images/prada_pr16ws.jpg'),
  (50, 1, 'Prada PR26ZS',                    'PR005',  6490000.00, 18, 'images/prada_pr26zs.jpg'),
  (51, 1, 'Prada PR19YS',                    'PR006',  5990000.00, 16, 'images/prada_pr19ys.jpg'),

  -- Dior (category 1: Kính mát)
  (28, 1, 'Dior So Real',                    'DSR01', 7490000.00, 5,  'images/dior_soreal.jpg'),
  (52, 1, 'Dior BlackSuit',                  'DR002', 8290000.00, 12, 'images/dior_blacksuit.jpg'),
  (53, 2, 'Dior Homme 010',                  'DR003', 6990000.00, 10, 'images/dior_homme010.jpg'),
  (54, 1, 'Dior CD Diamond',                 'DR004', 9490000.00, 11, 'images/dior_cd_diamond.jpg'),

  -- Versace (category 1: Kính mát)
  (29, 1, 'Versace VE4361',                  'VE4361', 5990000.00, 8,  'images/versace_ve4361.jpg'),
  (55, 1, 'Versace VE2232',                  'VS002',  6390000.00, 17, 'images/versace_ve2232.jpg'),
  (56, 1, 'Versace VE4405',                  'VS003',  5790000.00, 18, 'images/versace_ve4405.jpg'),
  (57, 1, 'Versace VE2198',                  'VS004',  6190000.00, 16, 'images/versace_ve2198.jpg'),

  -- Tom Ford (category 1: Kính mát)
  (30, 1, 'Tom Ford FT0237',                 'TF237',  6990000.00, 10, 'images/tomford_ft0237.jpg'),
  (58, 1, 'Tom Ford FT0906',                 'TF002',  7590000.00, 15, 'images/tomford_ft0906.jpg'),
  (59, 1, 'Tom Ford FT0711',                 'TF003',  6690000.00, 13, 'images/tomford_ft0711.jpg'),
  (60, 1, 'Tom Ford Snowdon',                'TF004',  7990000.00, 12, 'images/tomford_snowdon.jpg'),

  -- Police (category 1: Kính mát)
  (31, 1, 'Police SPL872',                   'PL872',  1890000.00, 20, 'images/police_spl872.jpg'),
  (61, 1, 'Police SPLA28',                   'PL002',  2090000.00, 18, 'images/police_spla28.jpg'),
  (62, 1, 'Police Origins',                  'PL003',  1990000.00, 20, 'images/police_origins.jpg'),
  (63, 2, 'Police VPLD94',                   'PL004',  1690000.00, 14, 'images/police_vpld94.jpg'),

  -- Moscot (category 2: Kính cận)
  (32, 2, 'Moscot Lemtosh',                  'MOS01',  4890000.00, 11, 'images/moscot_lemtosh.jpg'),
  (67, 2, 'Moscot Dahven',                   'MS002',  4690000.00, 16, 'images/moscot_dahven.jpg'),
  (68, 2, 'Moscot Zolman',                   'MS003',  4390000.00, 15, 'images/moscot_zolman.jpg'),

  -- Persol (category 1: Kính mát)
  (33, 1, 'Persol PO0714',                   'PS714',  3990000.00, 13, 'images/persol_po0714.jpg'),
  (64, 1, 'Persol PO3019S',                  'PS002',  3790000.00, 18, 'images/persol_po3019s.jpg'),
  (65, 1, 'Persol PO9649S',                  'PS003',  4290000.00, 17, 'images/persol_po9649s.jpg'),
  (66, 1, 'Persol PO3272S',                  'PS004',  3690000.00, 15, 'images/persol_po3272s.jpg'),

  -- Gentle Monster (category 1: Kính mát)
  (69, 1, 'Gentle Monster Her',              'GM001',  5490000.00, 20, 'images/gentlemonster_her.jpg'),
  (70, 1, 'Gentle Monster Lang',             'GM002',  5990000.00, 18, 'images/gentlemonster_lang.jpg');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;

-- ============================================================
-- 5. Table: promotions (no FK dependencies)
-- ============================================================

CREATE TABLE `promotions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `discount_percent` int NOT NULL DEFAULT 0,
  `description` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotions_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `promotions` DISABLE KEYS */;
INSERT INTO `promotions` (`id`, `code`, `discount_percent`, `description`, `start_date`, `end_date`) VALUES
  (1, 'SALE10', 10, 'Giảm 10% cho khách mới',        '2026-06-01', '2026-12-31'),
  (2, 'SALE20', 20, 'Giảm 20% mùa hè',               '2026-06-01', '2026-08-31'),
  (3, 'VIP30',  30, 'Giảm 30% cho khách VIP',         '2026-01-01', '2026-12-31');
/*!40000 ALTER TABLE `promotions` ENABLE KEYS */;

-- ============================================================
-- 6. Table: orders (FK → customers, users)
-- ============================================================

CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'staff',
  `status` varchar(20) NOT NULL DEFAULT 'completed',
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `coupon_code` varchar(50) DEFAULT NULL,
  `discount_percent` int NOT NULL DEFAULT 0,
  `manual_discount_type` varchar(20) DEFAULT NULL,
  `manual_discount_value` decimal(12,2) NOT NULL DEFAULT 0,
  `payment_method` varchar(30) NOT NULL DEFAULT 'cash',
  `amount_paid` decimal(12,2) NOT NULL DEFAULT 0,
  `change_amount` decimal(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_orders_customer_id` (`customer_id`),
  KEY `idx_orders_user_id` (`user_id`),
  KEY `idx_orders_source_status` (`source`, `status`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` (`id`, `customer_id`, `user_id`, `source`, `status`, `subtotal_amount`, `discount_amount`, `total_amount`, `created_at`, `coupon_code`, `discount_percent`, `manual_discount_type`, `manual_discount_value`, `payment_method`, `amount_paid`, `change_amount`) VALUES
  -- Order 1: RB3025 x2 = 3,500,000 x 2 = 7,000,000 (no discount)
  (1, 1, NULL, 'staff', 'completed', 7000000.00, 0.00, 7000000.00,  '2026-06-16 22:54:19', NULL,     0, NULL, 0.00, 'cash', 7000000.00, 0.00),
  -- Order 2: Wayfarer(3,000,000) + Clubmaster(2,800,000) = 5,800,000 (no discount)
  (2, 1, NULL, 'staff', 'completed', 5800000.00, 0.00, 5800000.00,  '2026-06-24 23:50:35', NULL,     0, NULL, 0.00, 'cash', 5800000.00, 0.00),
  -- Order 3: Oakley Holbrook x2 = 3,800,000 x 2 = 7,600,000 (no discount)
  (3, 2, NULL, 'staff', 'completed', 7600000.00, 0.00, 7600000.00,  '2026-06-25 00:34:59', NULL,     0, NULL, 0.00, 'cash', 7600000.00, 0.00),
  -- Order 4: Dior So Real(8,500,000) + Police SPL872(2,200,000) = 10,700,000 (no discount)
  (4, 2, NULL, 'staff', 'completed', 10700000.00, 0.00, 10700000.00, '2026-06-25 00:36:16', NULL,     0, NULL, 0.00, 'cash', 10700000.00, 0.00),
  -- Order 5: Gucci GG0748S(8,500,000) + Prada Symbole(7,000,000) = 15,500,000 x 80% = 12,400,000
  (5, 1, NULL, 'staff', 'completed', 15500000.00, 3100000.00, 12400000.00, '2026-06-25 07:44:33', 'SALE20', 20, NULL, 0.00, 'cash', 12400000.00, 0.00),
  -- Order 6: Police Origins(2,300,000) + Police SPLA28(2,500,000) = 4,800,000 x 90% = 4,320,000
  (6, 5, NULL, 'staff', 'completed', 4800000.00, 480000.00, 4320000.00,  '2026-06-25 07:51:31', 'SALE10', 10, NULL, 0.00, 'cash', 4320000.00, 0.00);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;

-- ============================================================
-- 7. Table: order_details (FK → orders, products)
-- ============================================================

CREATE TABLE `order_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  `price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_od_order_id` (`order_id`),
  KEY `idx_od_product_id` (`product_id`),
  CONSTRAINT `fk_od_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_od_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40000 ALTER TABLE `order_details` DISABLE KEYS */;
INSERT INTO `order_details` (`id`, `order_id`, `product_id`, `quantity`, `price`) VALUES
  -- Order 1: RB3025 Aviator x2 = 3,500,000 x 2 = 7,000,000
  (1,  1, 1,  2, 3500000.00),
  -- Order 2: Wayfarer x1 (3,000,000) + Clubmaster x1 (2,800,000) = 5,800,000
  (2,  2, 21, 1, 3000000.00),
  (3,  2, 20, 1, 2800000.00),
  -- Order 3: Oakley Holbrook x2 = 3,800,000 x 2 = 7,600,000
  (4,  3, 22, 2, 3800000.00),
  -- Order 4: Dior So Real x1 (8,500,000) + Police SPL872 x1 (2,200,000) = 10,700,000
  (5,  4, 28, 1, 8500000.00),
  (6,  4, 31, 1, 2200000.00),
  -- Order 5: Gucci GG0748S x1 (8,500,000) + Prada Symbole x1 (7,000,000) = 15,500,000 pre-discount
  (7,  5, 45, 1, 8500000.00),
  (8,  5, 48, 1, 7000000.00),
  -- Order 6: Police Origins x1 (2,300,000) + Police SPLA28 x1 (2,500,000) = 4,800,000 pre-discount
  (9,  6, 62, 1, 2300000.00),
  (10, 6, 61, 1, 2500000.00);
/*!40000 ALTER TABLE `order_details` ENABLE KEYS */;

-- ============================================================
-- Restore settings
-- ============================================================

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-05
