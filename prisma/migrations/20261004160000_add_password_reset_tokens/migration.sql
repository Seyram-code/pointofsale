ALTER TABLE `User`
ADD COLUMN `passwordResetTokenHash` VARCHAR(64) NULL,
ADD COLUMN `passwordResetExpiresAt` DATETIME(3) NULL,
ADD COLUMN `passwordResetSentAt` DATETIME(3) NULL,
ADD UNIQUE INDEX `User_passwordResetTokenHash_key` (`passwordResetTokenHash`);