ALTER TABLE `products`
  ADD COLUMN `original_price` decimal(12,2) DEFAULT NULL AFTER `price`,
  ADD COLUMN `original_cost_price` decimal(12,2) DEFAULT NULL AFTER `cost_price`;

UPDATE `products`
SET
  `original_price` = COALESCE(`original_price`, `price`),
  `original_cost_price` = COALESCE(`original_cost_price`, `cost_price`),
  `price` = GREATEST(1000, ROUND(`price` / 1000)),
  `cost_price` = GREATEST(0, ROUND(COALESCE(`cost_price`, 0) / 1000))
WHERE `price` >= 100000;
