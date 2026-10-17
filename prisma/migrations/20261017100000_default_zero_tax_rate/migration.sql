UPDATE `TaxRate`
SET `isDefault` = FALSE
WHERE `isDefault` = TRUE;

INSERT INTO `TaxRate` (`id`, `storeId`, `name`, `rate`, `description`, `isDefault`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('zero_', REPLACE(UUID(), '-', '')),
  `Store`.`id`,
  'Zero Rated',
  0,
  'Exempt / zero-rated goods',
  TRUE,
  TRUE,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Store`
WHERE NOT EXISTS (
  SELECT 1
  FROM `TaxRate`
  WHERE `TaxRate`.`storeId` = `Store`.`id`
    AND `TaxRate`.`name` = 'Zero Rated'
);

UPDATE `TaxRate`
SET `isDefault` = TRUE, `isActive` = TRUE
WHERE `name` = 'Zero Rated';
