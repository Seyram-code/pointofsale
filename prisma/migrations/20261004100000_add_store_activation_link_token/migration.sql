ALTER TABLE `Store`
ADD COLUMN `activationLinkTokenHash` VARCHAR(64) NULL,
ADD COLUMN `activationLinkExpiresAt` DATETIME(3) NULL,
ADD UNIQUE INDEX `Store_activationLinkTokenHash_key` (`activationLinkTokenHash`);
