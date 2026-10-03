-- Import into the selected VidyPOS database in phpMyAdmin.
-- Existing activation fields are skipped, so this is safe to run more than once.
SET @activation_schema = DATABASE();

SET @activation_sql = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @activation_schema AND TABLE_NAME = 'Store' AND COLUMN_NAME = 'emailVerifiedAt') = 0,
	'ALTER TABLE `Store` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)',
	'SELECT ''Store.emailVerifiedAt already exists'''
);
PREPARE activation_statement FROM @activation_sql;
EXECUTE activation_statement;
DEALLOCATE PREPARE activation_statement;

SET @activation_sql = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @activation_schema AND TABLE_NAME = 'Store' AND COLUMN_NAME = 'activationCodeHash') = 0,
	'ALTER TABLE `Store` ADD COLUMN `activationCodeHash` VARCHAR(64) NULL',
	'SELECT ''Store.activationCodeHash already exists'''
);
PREPARE activation_statement FROM @activation_sql;
EXECUTE activation_statement;
DEALLOCATE PREPARE activation_statement;

SET @activation_sql = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @activation_schema AND TABLE_NAME = 'Store' AND COLUMN_NAME = 'activationCodeExpiresAt') = 0,
	'ALTER TABLE `Store` ADD COLUMN `activationCodeExpiresAt` DATETIME(3) NULL',
	'SELECT ''Store.activationCodeExpiresAt already exists'''
);
PREPARE activation_statement FROM @activation_sql;
EXECUTE activation_statement;
DEALLOCATE PREPARE activation_statement;

SET @activation_sql = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @activation_schema AND TABLE_NAME = 'Store' AND COLUMN_NAME = 'activationCodeSentAt') = 0,
	'ALTER TABLE `Store` ADD COLUMN `activationCodeSentAt` DATETIME(3) NULL',
	'SELECT ''Store.activationCodeSentAt already exists'''
);
PREPARE activation_statement FROM @activation_sql;
EXECUTE activation_statement;
DEALLOCATE PREPARE activation_statement;

SET @activation_sql = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @activation_schema AND TABLE_NAME = 'Store' AND COLUMN_NAME = 'activationCodeAttempts') = 0,
	'ALTER TABLE `Store` ADD COLUMN `activationCodeAttempts` INTEGER NOT NULL DEFAULT 0',
	'SELECT ''Store.activationCodeAttempts already exists'''
);
PREPARE activation_statement FROM @activation_sql;
EXECUTE activation_statement;
DEALLOCATE PREPARE activation_statement;