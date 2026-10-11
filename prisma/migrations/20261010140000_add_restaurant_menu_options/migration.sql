CREATE TABLE `MenuOption` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `priceDelta` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `MenuOption_productId_isActive_sortOrder_idx` (`productId`, `isActive`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MenuOption_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SaleItem` ADD COLUMN `optionsJson` TEXT NULL;