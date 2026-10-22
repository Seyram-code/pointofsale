CREATE TABLE `SubscriptionExpiryReminder` (
  `id` VARCHAR(191) NOT NULL,
  `subscriptionId` VARCHAR(191) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `daysBefore` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'SENDING', 'SENT') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastAttemptAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  UNIQUE INDEX `SubscriptionExpiryReminder_subscriptionId_periodEnd_daysBefore_key` (`subscriptionId`, `periodEnd`, `daysBefore`),
  INDEX `SubscriptionExpiryReminder_status_lastAttemptAt_idx` (`status`, `lastAttemptAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SubscriptionExpiryReminder_subscriptionId_fkey`
    FOREIGN KEY (`subscriptionId`) REFERENCES `StoreSubscription`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
