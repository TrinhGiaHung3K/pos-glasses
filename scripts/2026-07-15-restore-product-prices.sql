USE `pos_glasses`;

START TRANSACTION;

UPDATE `products`
SET
  `price` = `original_price`,
  `cost_price` = COALESCE(`original_cost_price`, `cost_price`)
WHERE `original_price` IS NOT NULL;

COMMIT;
