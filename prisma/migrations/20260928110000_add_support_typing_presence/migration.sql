-- CreateTable
CREATE TABLE `SupportTicketPresence` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `SupportTicketPresence_ticketId_userId_key`(`ticketId`, `userId`),
    INDEX `SupportTicketPresence_ticketId_expiresAt_idx`(`ticketId`, `expiresAt`),
    CONSTRAINT `SupportTicketPresence_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SupportTicketPresence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
