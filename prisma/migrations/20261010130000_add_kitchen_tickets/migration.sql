CREATE TABLE `KitchenTicket` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `saleId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `KitchenTicket_saleId_key` (`saleId`),
  INDEX `KitchenTicket_storeId_status_createdAt_idx` (`storeId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `KitchenTicket_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `KitchenTicket_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;