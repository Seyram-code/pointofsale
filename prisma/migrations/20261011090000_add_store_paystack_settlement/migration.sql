ALTER TABLE `Store`
  ADD COLUMN `paystackSubaccountCode` VARCHAR(80) NULL,
  ADD COLUMN `paystackSettlementStatus` VARCHAR(32) NULL,
  ADD COLUMN `paystackSettlementBankCode` VARCHAR(32) NULL,
  ADD COLUMN `paystackSettlementBankName` VARCHAR(120) NULL,
  ADD COLUMN `paystackSettlementName` VARCHAR(160) NULL,
  ADD COLUMN `paystackSettlementLast4` VARCHAR(4) NULL,
  ADD COLUMN `paystackSettlementVerifiedAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `Store_paystackSubaccountCode_key` (`paystackSubaccountCode`);
