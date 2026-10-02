import "dotenv/config";
import mysql from "mysql2/promise";

/**
 * Persists EXPIRED for subscriptions whose paid period has passed.
 *
 * Access is already blocked at read time (see `hasSubscriptionAccess`), but the stored
 * status is never mutated on expiry. Running this keeps the database in sync for
 * reporting, the platform metrics and `expiringSoon`/`EXPIRED` dashboards.
 *
 * Usage:     npm run subscriptions:expire
 * Production: schedule it (e.g. a daily cron job) alongside the app.
 */

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

/** Prisma stores MySQL datetimes as UTC, so format "now" the same way for a correct comparison. */
function utcTimestamp(date) {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to expire subscriptions.");

  const connection = await mysql.createConnection(parseDatabaseUrl(databaseUrl));
  try {
    const now = utcTimestamp(new Date());
    const [result] = await connection.query(
      `UPDATE StoreSubscription
          SET status = 'EXPIRED', updatedAt = ?
        WHERE status IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
          AND canceledAt IS NULL
          AND currentPeriodEnd < ?`,
      [now, now],
    );
    console.log(`Expired ${result.affectedRows} subscription(s) as of ${now} UTC.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});