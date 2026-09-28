import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before seeding");
  }

  const store = await prisma.store.upsert({
    where: { branchCode: "MAIN" },
    update: {},
    create: {
      businessId: `BUS-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
      name: "Main Branch",
      branchCode: "MAIN",
      city: "Accra",
      region: "Greater Accra",
      currency: "GHS",
      timezone: "Africa/Accra",
      receiptFooter: "Thank you for shopping with us!",
      subscriptions: {
        create: {
          plan: "PROFESSIONAL",
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  await prisma.register.upsert({
    where: { storeId_code: { storeId: store.id, code: "TILL-1" } },
    update: {},
    create: { storeId: store.id, name: "Till 1", code: "TILL-1" },
  });

  await prisma.taxRate.upsert({
    where: { name: "Ghana Standard (VAT + Levies)" },
    update: {},
    create: {
      name: "Ghana Standard (VAT + Levies)",
      rate: 0.21,
      description: "VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID-19 Levy 1%",
      isDefault: true,
    },
  });

  await prisma.taxRate.upsert({
    where: { name: "Zero Rated" },
    update: {},
    create: { name: "Zero Rated", rate: 0, description: "Exempt / zero-rated goods" },
  });

  const units = [
    { name: "Piece", abbreviation: "pc", isDecimal: false },
    { name: "Kilogram", abbreviation: "kg", isDecimal: true },
    { name: "Litre", abbreviation: "L", isDecimal: true },
    { name: "Box", abbreviation: "box", isDecimal: false },
    { name: "Pack", abbreviation: "pack", isDecimal: false },
  ];
  for (const unit of units) {
    await prisma.unitOfMeasure.upsert({
      where: { abbreviation: unit.abbreviation },
      update: {},
      create: unit,
    });
  }

  const categories = [
    "Groceries",
    "Beverages",
    "Fresh Produce",
    "Meat & Fish",
    "Dairy & Eggs",
    "Bakery",
    "Frozen Foods",
    "Household",
    "Personal Care",
    "Baby Products",
  ];
  for (const [index, name] of categories.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sortOrder: index },
    });
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
      storeId: store.id,
      staffCode: "ADM001",
      fullName: "System Administrator",
      email: adminEmail.toLowerCase(),
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    });
  }

  await seedDemoUsers(store.id);

  console.log("Seed complete. Sign in with the seeded admin and change the password immediately.");
}

/**
 * Optional staff accounts for testing each role. Guarded by an env flag so a
 * production seed can never create shared-password logins.
 */
async function seedDemoUsers(storeId: string) {
  if (process.env.SEED_DEMO_USERS !== "true") return;

  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    throw new Error("SEED_DEMO_PASSWORD must be set when SEED_DEMO_USERS=true");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to create demo users in production");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pinHash = await bcrypt.hash("1234", 12);

  const staff = [
    { staffCode: "MGR001", fullName: "Kwame Mensah", email: "manager@mypos.local", role: "MANAGER" as const },
    { staffCode: "SUP001", fullName: "Akosua Danso", email: "supervisor@mypos.local", role: "SUPERVISOR" as const },
    { staffCode: "CSH001", fullName: "Ama Owusu", email: "cashier1@mypos.local", role: "CASHIER" as const },
    { staffCode: "CSH002", fullName: "Kojo Asante", email: "cashier2@mypos.local", role: "CASHIER" as const },
    { staffCode: "STK001", fullName: "Yaw Boateng", email: "stock@mypos.local", role: "STOCK_KEEPER" as const },
    { staffCode: "ACC001", fullName: "Adjoa Frimpong", email: "accounts@mypos.local", role: "ACCOUNTANT" as const },
  ];

  for (const member of staff) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: {
        storeId,
        staffCode: member.staffCode,
        fullName: member.fullName,
        email: member.email,
        passwordHash,
        pinHash,
        role: member.role,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
  }

  console.log(`Created ${staff.length} demo staff accounts (SEED_DEMO_USERS=true).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
