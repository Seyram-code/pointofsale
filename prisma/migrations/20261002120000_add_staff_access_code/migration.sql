ALTER TABLE `User`
ADD COLUMN `staffAccessCodeHash` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_staffAccessCodeHash_key`
ON `User` (`staffAccessCodeHash`);