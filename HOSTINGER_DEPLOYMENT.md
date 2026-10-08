# Hostinger Deployment

## 1. Create the database

Create a MySQL database and database user in Hostinger. Import `mypos-hostinger.sql` in phpMyAdmin, or run the committed Prisma migration from the VidyPOS application environment.

Do not use `prisma db push` for production.

## 2. Configure environment variables

In Hostinger's Node.js environment variables, configure the values from `.env.example`:

- `DATABASE_URL`: use the Hostinger database name, user, password, and `127.0.0.1:3306`.
- `AUTH_SECRET`: generate a unique secret with `openssl rand -base64 48`.
- `AUTH_SESSION_TTL_HOURS`: use `12` as the absolute maximum session lifetime. The dashboard separately logs out after five minutes of inactivity.
- `AUTH_COOKIE_NAME`: use `mypos_session`.
- `NODE_ENV`: set to `production`.
- `NEXT_PUBLIC_APP_URL`: set to the deployed HTTPS domain.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM`: configure a verified SMTP mailbox. Hostinger SMTP commonly uses port `587` with `SMTP_SECURE=false`; use the exact values shown in your email hosting panel.
- `SMTP_SECURE`: set `true` only when using implicit TLS (commonly port `465`).
- `PAYMENT_DRIVER`: use `mock` for the current deployment.
- `CRON_SECRET`: generate a unique random secret for scheduled tasks (for example, `openssl rand -hex 32`).
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: use unique production values.
- `SEED_DEMO_USERS`: keep set to `false`.

Keep `.env` out of Git. Never put database passwords or `AUTH_SECRET` in source files.

New shops remain inactive until the owner enters the six-digit code emailed to the owner email address. Codes expire after 30 minutes; the activation page can request another code, with a one-minute resend cooldown. Test SMTP delivery before opening public registration.

## 3. Build and start commands

Use Node.js 20 or newer.

Build command:

```bash
npm ci
npm run build
```

The `npm run build` script generates the Prisma client, checks for an imported VidyPOS schema that has no Prisma migration history, applies pending database migrations, and then builds Next.js. For an existing imported database, the migration runner records the original schema as the baseline and recognizes support or tax schema changes already present. Ensure Hostinger's `DATABASE_URL` is available to the build process and points to the production database, and back up the database before deploying schema changes.

Start command:

```bash
npm run start
```

Set the application port using Hostinger's assigned `PORT` value if Hostinger does not inject it automatically. Next.js uses port 3000 by default.

## 4. First login

After deployment, open the production URL and sign in with the seeded admin credentials. Change the password immediately, then remove or rotate the seed credentials in the hosting environment.

## 5. Payment mode

The current deployment uses mock payments. The POS can be tested without live gateway credentials. Before switching to live payments, configure the provider credentials, webhook URLs, and HTTPS domain, then change `PAYMENT_DRIVER` to `live` and redeploy.

## 6. Reconcile pending Paystack payments

Paystack webhooks and the open POS checkout reconcile payments immediately. Configure a Hostinger cron job to call the fallback endpoint once per minute so pending payments are still reconciled if the till closes before the provider callback arrives.

Request:

```bash
curl --fail --silent --show-error \
	-H "Authorization: Bearer $CRON_SECRET" \
	https://your-domain.example/api/cron/reconcile-payments
```

The endpoint checks pending CARD and MoMo payments at least two minutes old, up to 50 per run. It releases stock only after Paystack verification confirms failure/cancellation, and completes the sale and receipt only after a successful amount-matched verification. Transient errors remain pending for a later run. Store `CRON_SECRET` in Hostinger environment variables and configure the cron service to send it as the bearer token; never place it in a public URL.

## 7. Super Admin email alerts

Configure the SMTP variables above and create a second Hostinger cron job to check platform health signals every five minutes:

```bash
curl --fail --silent --show-error \
	-H "Authorization: Bearer $CRON_SECRET" \
	https://your-domain.example/api/cron/platform-health-alerts
```

Active Super Admin accounts with an email address receive alerts for new business registrations and support tickets. The scheduled health check emails new platform notices and later recovery notices; active signals are deduplicated and retried if SMTP delivery fails. Apply the `20261008100000_add_platform_health_signals` Prisma migration before enabling the cron job.
