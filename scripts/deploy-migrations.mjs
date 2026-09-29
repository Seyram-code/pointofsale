import "dotenv/config";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
const BASELINE = "00000000000000_init";
const SUPPORT_TICKETS = "20260928090000_add_support_tickets";
const SUPPORT_PRESENCE = "20260928110000_add_support_typing_presence";
const SUPPORT_READ_AT = "20260928130000_add_support_message_read_at";
const STORE_TAX_RATES = "20260929150000_store_specific_tax_rates";
let connection;

async function query(sql) {
  const [rows] = await connection.query(sql);
  return rows;
}

function resolveMigration(migration, action = "applied") {
  execFileSync(process.execPath, [prismaCli, "migrate", "resolve", `--${action}`, migration], { stdio: "inherit" });
}

function deployMigrations() {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit" });
}

async function getTables() {
  const rows = await query("SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  return new Set(rows.map((row) => row.tableName));
}

async function getAppliedMigrations(tables) {
  if (!tables.has("_prisma_migrations")) return new Set();
  const rows = await query("SELECT migration_name AS migrationName FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL");
  return new Set(rows.map((row) => row.migrationName));
}

async function reconcileImportedSupportSchema(tables, applied) {
  const hasTicket = tables.has("SupportTicket");
  const hasMessages = tables.has("SupportTicketMessage");
  const hasPresence = tables.has("SupportTicketPresence");

  if (hasTicket !== hasMessages || (hasPresence && !hasTicket)) {
    throw new Error("Production has a partial support-ticket schema; inspect it before deploying migrations.");
  }

  if (hasTicket && !applied.has(SUPPORT_TICKETS)) {
    resolveMigration(SUPPORT_TICKETS);
    applied.add(SUPPORT_TICKETS);
  }
  if (hasPresence && !applied.has(SUPPORT_PRESENCE)) {
    resolveMigration(SUPPORT_PRESENCE);
    applied.add(SUPPORT_PRESENCE);
  }

  if (hasMessages) {
    const columns = await query("SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupportTicketMessage'");
    if (columns.some((column) => column.columnName === "readAt") && !applied.has(SUPPORT_READ_AT)) {
      resolveMigration(SUPPORT_READ_AT);
      applied.add(SUPPORT_READ_AT);
    }
  }
}

async function reconcileImportedTaxSchema(tables, applied) {
  const columns = await query("SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TaxRate'");
  const hasStoreId = columns.some((column) => column.columnName === "storeId");

  if (!hasStoreId) {
    if (applied.has(STORE_TAX_RATES)) {
      throw new Error("The store-specific tax migration is recorded as applied, but TaxRate.storeId is missing.");
    }
    return;
  }

  const [indexes, foreignKeys, nullRows] = await Promise.all([
    query("SELECT INDEX_NAME AS indexName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TaxRate' GROUP BY INDEX_NAME"),
    query("SELECT CONSTRAINT_NAME AS constraintName FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TaxRate' AND COLUMN_NAME = 'storeId' AND REFERENCED_TABLE_NAME = 'Store'"),
    query("SELECT COUNT(*) AS count FROM TaxRate WHERE storeId IS NULL"),
  ]);
  const indexNames = new Set(indexes.map((index) => index.indexName));
  const isComplete = indexNames.has("TaxRate_storeId_name_key")
    && indexNames.has("TaxRate_storeId_isActive_idx")
    && foreignKeys.length > 0
    && Number(nullRows[0].count) === 0;

  if (!isComplete) {
    throw new Error("TaxRate.storeId exists but the store-specific tax migration is incomplete; inspect the production schema before deploying.");
  }
  if (!applied.has(STORE_TAX_RATES)) resolveMigration(STORE_TAX_RATES);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to deploy database migrations.");
  const parsedUrl = new URL(databaseUrl);
  connection = await mysql.createConnection({
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 3306),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: decodeURIComponent(parsedUrl.pathname.slice(1)),
  });

  let tables = await getTables();
  const coreTables = ["Store", "User", "Product", "TaxRate"];
  const existingCoreTables = coreTables.filter((table) => tables.has(table));
  const applied = await getAppliedMigrations(tables);

  if (existingCoreTables.length > 0 && existingCoreTables.length !== coreTables.length) {
    throw new Error("The database has a partial MyPOS core schema; refusing to mark its baseline as applied.");
  }

  if (existingCoreTables.length === coreTables.length && !applied.has(BASELINE)) {
    const migrationRows = tables.has("_prisma_migrations")
      ? await query("SELECT migration_name AS migrationName, finished_at AS finishedAt, rolled_back_at AS rolledBackAt FROM _prisma_migrations")
      : [];
    const successful = migrationRows.filter((row) => row.finishedAt && !row.rolledBackAt);
    const unfinished = migrationRows.filter((row) => !row.finishedAt && !row.rolledBackAt);

    if (successful.length > 0 || unfinished.some((row) => row.migrationName !== BASELINE)) {
      throw new Error("Existing migration history does not match the imported database schema; resolve it manually before deploying.");
    }
    if (unfinished.some((row) => row.migrationName === BASELINE)) resolveMigration(BASELINE, "rolled-back");

    resolveMigration(BASELINE);
    tables = await getTables();
  }

  const currentApplied = await getAppliedMigrations(tables);
  await reconcileImportedSupportSchema(tables, currentApplied);
  await reconcileImportedTaxSchema(tables, currentApplied);
  deployMigrations();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection?.end();
  });
