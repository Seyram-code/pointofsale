CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `expenseDate` DATETIME(3) NOT NULL,
    `paymentMethod` ENUM('CASH', 'MOMO', 'CARD', 'BANK_TRANSFER', 'OTHER') NOT NULL,
    `supplierName` VARCHAR(120) NULL,
    `receiptReference` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`),
    INDEX `Expense_storeId_expenseDate_idx`(`storeId`, `expenseDate`),
    INDEX `Expense_storeId_category_expenseDate_idx`(`storeId`, `category`, `expenseDate`),
    INDEX `Expense_createdById_idx`(`createdById`),
    CONSTRAINT `Expense_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
