-- Run this once against the VidyPOS database in phpMyAdmin.
-- It adds owner email verification and short-lived shop activation-code fields.
ALTER TABLE `Store`
ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
ADD COLUMN `activationCodeHash` VARCHAR(64) NULL,
ADD COLUMN `activationCodeExpiresAt` DATETIME(3) NULL,
ADD COLUMN `activationCodeSentAt` DATETIME(3) NULL,
ADD COLUMN `activationCodeAttempts` INTEGER NOT NULL DEFAULT 0;