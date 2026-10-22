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
- `PAYSTACK_PLATFORM_PERCENTAGE_CHARGE`: platform share of each Paystack split, from `0` to `100`. Set this to `3` to reserve 2% for Paystack processing and 1% for VidyPOS; this leaves 97% of the customer charge for the shop, matching the checkout gross-up. This value is applied when creating a Paystack subaccount and does not change the percentage on an already-created subaccount.
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

**Do not enable live Paystack payments until the reconciliation cron job is configured and tested.** Paystack webhooks and the open POS checkout reconcile payments immediately, but the scheduled call is required to recover payments after the till closes or loses connection.

In Hostinger hPanel, open **Advanced → Cron Jobs** and create a job with the schedule set to **Every minute** (`* * * * *`). Use the command below, replacing the domain and bearer-secret placeholders with the production HTTPS domain and the exact `CRON_SECRET` configured in the Node.js app. Keep the secret in the private cron command configuration; never put it in the URL, source code, or a committed file.

Request:

```bash
curl --fail --silent --show-error \
	-H "Authorization: Bearer $CRON_SECRET" \
	https://your-domain.example/api/cron/reconcile-payments
```

For the Hostinger job, use this complete command template (replace both placeholders):

```bash
curl --fail --silent --show-error --max-time 50 \
	-H "Authorization: Bearer REPLACE_WITH_CRON_SECRET" \
	https://your-domain.example/api/cron/reconcile-payments
```

The endpoint checks pending CARD and MoMo payments at least one minute old, up to 50 per run. It completes the sale and receipt only after a successful amount-matched verification. A verified unresolved Paystack payment is marked failed and its stock reservation is released after one minute; this timeout does not prove that a MoMo debit will never arrive. The POS Failed sales list also lets staff explicitly release a still-unresolved payment after rechecking its status and confirming a warning. A late successful webhook is recorded in the audit log for refund review. Transient verification API errors remain pending for a later run.

After saving the job, run the command once from hPanel and confirm it returns HTTP 200 with a JSON response containing `"success": true`. An unauthorized response means the bearer secret does not match `CRON_SECRET`; a 503 means the app has no `CRON_SECRET` configured. Confirm the job's execution history shows a successful run every minute. This fallback does not run on a developer's local machine unless they configure a scheduler to call that local server.

## 7. Super Admin email alerts

Configure the SMTP variables above and create a second Hostinger cron job to check platform health signals every five minutes:

```bash
curl --fail --silent --show-error \
	-H "Authorization: Bearer $CRON_SECRET" \
	https://your-domain.example/api/cron/platform-health-alerts
```

Active Super Admin accounts with an email address receive alerts for new business registrations and support tickets. The scheduled health check emails new platform notices and later recovery notices; active signals are deduplicated and retried if SMTP delivery fails. Apply the `20261008100000_add_platform_health_signals` Prisma migration before enabling the cron job.

## 8. Subscription expiry reminder emails

Configure SMTP and `CRON_SECRET`, then apply the `20261022200000_add_subscription_expiry_reminders` Prisma migration. Create a daily Hostinger cron job (for example, `0 9 * * *`) to call the protected endpoint:

```bash
curl --fail --silent --show-error --max-time 50 \
	-H "Authorization: ******" \
	https://your-domain.example/api/cron/subscription-expiry-reminders
```

The endpoint sends one reminder per shop per day when its active, trialing, or past-due subscription has 5, 4, 3, 2, or 1 calendar days remaining in the shop's timezone. It uses the shop email, falling back to the first active administrator email. Successful reminders are deduplicated for that subscription period and day; failed attempts remain eligible for retry. Shops without an email address are reported as skipped. The response includes counts for eligible, sent, skipped, missing-email, and failed reminders.
