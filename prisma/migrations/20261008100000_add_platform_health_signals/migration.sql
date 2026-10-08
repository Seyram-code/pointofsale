CREATE TABLE `PlatformHealthSignal` (
  `id` VARCHAR(191) NOT NULL,
  `signalKey` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastNotifiedAt` DATETIME(3) NULL,
  `resolvedAt` DATETIME(3) NULL,
  UNIQUE INDEX `PlatformHealthSignal_signalKey_key` (`signalKey`),
  INDEX `PlatformHealthSignal_isActive_lastSeenAt_idx` (`isActive`, `lastSeenAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
