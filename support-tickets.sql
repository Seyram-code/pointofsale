-- MyPOS support ticket tables
-- Import this after the existing MyPOS schema has been created.
-- Existing tables and data are not modified.

CREATE TABLE IF NOT EXISTS `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`),
    INDEX `SupportTicket_storeId_status_updatedAt_idx` (`storeId`, `status`, `updatedAt`),
    INDEX `SupportTicket_status_priority_updatedAt_idx` (`status`, `priority`, `updatedAt`),
    CONSTRAINT `SupportTicket_storeId_fkey`
        FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SupportTicket_createdById_fkey`
        FOREIGN KEY (`createdById`) REFERENCES `User` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupportTicketMessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`),
    INDEX `SupportTicketMessage_ticketId_createdAt_idx` (`ticketId`, `createdAt`),
    CONSTRAINT `SupportTicketMessage_ticketId_fkey`
        FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SupportTicketMessage_authorId_fkey`
        FOREIGN KEY (`authorId`) REFERENCES `User` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
