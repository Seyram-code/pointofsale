# Hostinger Deployment

## 1. Create the database

Create a MySQL database and database user in Hostinger. Import `mypos-hostinger.sql` in phpMyAdmin, or run the committed Prisma migration from the application environment.

Do not use `prisma db push` for production.

## 2. Configure environment variables

In Hostinger's Node.js environment variables, configure the values from `.env.example`:

- `DATABASE_URL`: use the Hostinger database name, user, password, and `127.0.0.1:3306`.
- `AUTH_SECRET`: generate a unique secret with `openssl rand -base64 48`.
- `AUTH_SESSION_TTL_HOURS`: use `12` unless a different session lifetime is required.
- `AUTH_COOKIE_NAME`: use `mypos_session`.
- `NODE_ENV`: set to `production`.
- `NEXT_PUBLIC_APP_URL`: set to the deployed HTTPS domain.
- `PAYMENT_DRIVER`: use `mock` for the current deployment.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: use unique production values.
- `SEED_DEMO_USERS`: keep set to `false`.

Keep `.env` out of Git. Never put database passwords or `AUTH_SECRET` in source files.

## 3. Build and start commands

Use Node.js 20 or newer.

Build command:

```bash
npm ci
npm run build
```

The `npm run build` script generates the Prisma client, checks for an imported MyPOS schema that has no Prisma migration history, applies pending database migrations, and then builds Next.js. For an existing imported database, the migration runner records the original schema as the baseline and recognizes support or tax schema changes already present. Ensure Hostinger's `DATABASE_URL` is available to the build process and points to the production database, and back up the database before deploying schema changes.

Start command:

```bash
npm run start
```

Set the application port using Hostinger's assigned `PORT` value if Hostinger does not inject it automatically. Next.js uses port 3000 by default.

## 4. First login

After deployment, open the production URL and sign in with the seeded admin credentials. Change the password immediately, then remove or rotate the seed credentials in the hosting environment.

## 5. Payment mode

The current deployment uses mock payments. The POS can be tested without live gateway credentials. Before switching to live payments, configure the provider credentials, webhook URLs, and HTTPS domain, then change `PAYMENT_DRIVER` to `live` and redeploy.
