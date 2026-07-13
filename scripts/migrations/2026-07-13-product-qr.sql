CREATE TABLE IF NOT EXISTS `product_qr_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `public_code` varchar(64) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `version` int NOT NULL DEFAULT 1,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_qr_public_code` (`public_code`),
  KEY `idx_product_qr_product_status` (`product_id`, `status`),
  CONSTRAINT `fk_product_qr_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
