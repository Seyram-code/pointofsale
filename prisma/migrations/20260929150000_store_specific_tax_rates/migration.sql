ALTER TABLE `TaxRate`
ADD COLUMN `storeId` VARCHAR(191) NULL;

ALTER TABLE `TaxRate`
DROP INDEX `TaxRate_name_key`;

INSERT INTO `TaxRate` (`id`, `storeId`, `name`, `rate`, `description`, `isDefault`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('legacy_', REPLACE(UUID(), '-', '')),
  `Store`.`id`,
  `legacy`.`name`,
  `legacy`.`rate`,
  `legacy`.`description`,
  `legacy`.`isDefault`,
  `legacy`.`isActive`,
  `legacy`.`createdAt`,
  `legacy`.`updatedAt`
FROM `TaxRate` AS `legacy`
CROSS JOIN `Store`
WHERE `legacy`.`storeId` IS NULL;

UPDATE `Product`
INNER JOIN `TaxRate` AS `legacy` ON `Product`.`taxRateId` = `legacy`.`id` AND `legacy`.`storeId` IS NULL
INNER JOIN `TaxRate` AS `scoped` ON `scoped`.`storeId` = `Product`.`storeId` AND `scoped`.`name` = `legacy`.`name`
SET `Product`.`taxRateId` = `scoped`.`id`;

DELETE FROM `TaxRate` WHERE `storeId` IS NULL;

INSERT INTO `TaxRate` (`id`, `storeId`, `name`, `rate`, `description`, `isDefault`, `isActive`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('default_', REPLACE(UUID(), '-', '')),
  `Store`.`id`,
  'Ghana Standard (VAT + Levies)',
  0.21,
  'VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID-19 Levy 1%',
  TRUE,
  TRUE,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Store`
WHERE NOT EXISTS (SELECT 1 FROM `TaxRate` WHERE `TaxRate`.`storeId` = `Store`.`id`);

ALTER TABLE `TaxRate`
MODIFY COLUMN `storeId` VARCHAR(191) NOT NULL,
ADD INDEX `TaxRate_storeId_isActive_idx` (`storeId`, `isActive`),
ADD UNIQUE INDEX `TaxRate_storeId_name_key` (`storeId`, `name`),
ADD CONSTRAINT `TaxRate_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;