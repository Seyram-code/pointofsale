import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { ApiError, created, handleApiError } from "@/lib/api/response";
import { DECIMAL_MONEY, DECIMAL_QTY } from "@/lib/services/cart.service";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PRODUCT_ROWS = 5_000;
const VALID_PRODUCT_TYPES = new Set(["UNIT", "WEIGHED", "SERVICE"]);

type ImportIssue = { row: number; message: string };

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function headerKey(value: string) {
  return normalized(value).replace(/[^a-z0-9]/g, "");
}

function cellText(value: ExcelJS.CellValue): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function cellNumber(value: ExcelJS.CellValue, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim()) return Number(value.trim());
  return fallback;
}

function cellBoolean(value: ExcelJS.CellValue, fallback: boolean): boolean {
  const text = cellText(value).toLocaleLowerCase();
  if (["yes", "true", "1"].includes(text)) return true;
  if (["no", "false", "0"].includes(text)) return false;
  return fallback;
}

function cellDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function parseBarcodes(value: ExcelJS.CellValue) {
  return cellText(value).split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const match = entry.match(/^(.*?)\s*(?:\(primary\))?\s*x\s*([\d.]+)$/i);
    const code = (match?.[1] ?? entry).replace(/\s*\(primary\)\s*$/i, "").trim();
    const packSize = match ? Number(match[2]) : 1;
    return { code, packSize, isPrimary: /\(primary\)/i.test(entry) };
  }).filter((barcode) => barcode.code && Number.isFinite(barcode.packSize) && barcode.packSize > 0);
}

function makeSku(name: string) {
  const prefix = name.normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "ITEM";
  return `AUTO-${prefix}-${randomInt(0, 100_000_000).toString().padStart(8, "0")}`;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function GET() {
  try {
    await authorize(PERMISSIONS.PRODUCTS_CREATE);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
    worksheet.columns = [
      { header: "Product name", key: "name", width: 30 },
      { header: "Barcode", key: "barcode", width: 22 },
      { header: "Cost price (GHS)", key: "costPrice", width: 18 },
      { header: "Selling price (GHS)", key: "sellingPrice", width: 20 },
      { header: "Opening quantity", key: "quantity", width: 18 },
      { header: "Expiry date", key: "expiryDate", width: 18 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
    worksheet.getColumn("costPrice").numFmt = '"GHS "#,##0.00';
    worksheet.getColumn("sellingPrice").numFmt = '"GHS "#,##0.00';
    worksheet.getColumn("quantity").numFmt = "#,##0.###";
    worksheet.getColumn("expiryDate").numFmt = "yyyy-mm-dd";
    const bytes = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="vidypos-product-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_CREATE);
    if (!session.user.storeId) throw ApiError.badRequest("Your account is not linked to a store.");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw ApiError.badRequest("Choose an .xlsx product backup file.");
    if (file.size === 0 || file.size > MAX_FILE_SIZE) throw ApiError.badRequest("The workbook must be between 1 byte and 10 MB.");
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) throw ApiError.badRequest("Only .xlsx workbooks are supported.");

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      throw ApiError.badRequest("The selected file is not a readable Excel workbook.");
    }

    const worksheet = workbook.getWorksheet("Products") ?? workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 1) throw ApiError.badRequest("The workbook must contain a worksheet with product headers in the first row.");
    if (worksheet.rowCount - 1 > MAX_PRODUCT_ROWS) throw ApiError.badRequest(`A workbook can contain at most ${MAX_PRODUCT_ROWS} product rows.`);

    const headers = new Map<string, number>();
    worksheet.getRow(1).eachCell((cell, columnNumber) => {
      const heading = headerKey(cellText(cell.value));
      if (heading) headers.set(heading, columnNumber);
    });
    const requiredHeaderGroups = [
      ["productname"],
      ["costpriceghs", "costpriceghc", "costpricegh", "costprice", "costghs", "costghc", "costgh", "cost", "buyingprice", "purchaseprice", "purchasecost", "unitcost"],
      ["sellingpriceghs", "sellingpriceghc", "sellingpricegh", "sellingprice", "selling", "unitprice", "retailprice", "saleprice", "salesprice", "price"],
      ["openingquantity", "stockquantity", "quantity"],
    ];
    const missingHeaders = requiredHeaderGroups
      .filter((group) => !group.some((heading) => headers.has(heading)))
      .map((group, index) => ["product name", "cost price", "selling price", "opening quantity"][index]);
    if (missingHeaders.length) {
      const detectedHeaders: string[] = [];
      worksheet.getRow(1).eachCell((cell) => {
        const heading = cellText(cell.value);
        if (heading) detectedHeaders.push(heading);
      });
      throw ApiError.badRequest(`Missing required columns: ${missingHeaders.join(", ")}. Detected headers: ${detectedHeaders.join(", ") || "none"}.`);
    }

    const readCell = (row: ExcelJS.Row, heading: string) => {
      const column = headers.get(headerKey(heading));
      return column ? row.getCell(column).value : null;
    };
    const readFirstCell = (row: ExcelJS.Row, headings: string[]) => {
      for (const heading of headings) {
        const value = readCell(row, heading);
        if (value !== null && value !== undefined && value !== "") return value;
      }
      return null;
    };
    const [storedProducts, storedBarcodes, categories, brands, units, suppliers, taxRates] = await Promise.all([
      prisma.product.findMany({ where: { storeId: session.user.storeId }, select: { sku: true, name: true } }),
      prisma.barcode.findMany({ where: { product: { storeId: session.user.storeId } }, select: { code: true } }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.unitOfMeasure.findMany({ select: { id: true, abbreviation: true } }),
      prisma.supplier.findMany({ where: { storeId: session.user.storeId, deletedAt: null }, select: { id: true, name: true } }),
      prisma.taxRate.findMany({ where: { storeId: session.user.storeId }, select: { id: true, name: true } }),
    ]);
    const knownSkus = new Set(storedProducts.map((product) => normalized(product.sku)));
    const knownNames = new Set(storedProducts.map((product) => normalized(product.name)));
    const knownBarcodes = new Set(storedBarcodes.map((barcode) => barcode.code));
    const categoryByName = new Map(categories.map((item) => [normalized(item.name), item.id]));
    const brandByName = new Map(brands.map((item) => [normalized(item.name), item.id]));
    const unitByName = new Map(units.map((item) => [normalized(item.abbreviation), item.id]));
    const supplierByName = new Map(suppliers.map((item) => [normalized(item.name), item.id]));
    const taxByName = new Map(taxRates.map((item) => [normalized(item.name), item.id]));
    const issues: ImportIssue[] = [];
    let imported = 0;
    let skipped = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const name = cellText(readCell(row, "Product name"));
      if (!name && !cellText(readCell(row, "SKU"))) continue;
      if (!name) {
        skipped += 1;
        issues.push({ row: rowNumber, message: "Product name is required." });
        continue;
      }
      const requestedSku = cellText(readCell(row, "SKU"));
      let sku = requestedSku || makeSku(name);
      while (!requestedSku && knownSkus.has(normalized(sku))) sku = makeSku(name);
      if (knownSkus.has(normalized(sku)) || knownNames.has(normalized(name))) {
        skipped += 1;
        issues.push({ row: rowNumber, message: `Skipped duplicate SKU or product name: ${sku} / ${name}.` });
        continue;
      }

      const costPrice = cellNumber(readFirstCell(row, ["Cost price (GHS)", "Cost price", "Cost GHS", "Cost", "Buying price", "Purchase price", "Purchase cost", "Unit cost"]), Number.NaN);
      const sellingPrice = cellNumber(readFirstCell(row, ["Selling price (GHS)", "Selling price", "Selling", "Unit price", "Retail price", "Sale price", "Sales price", "Price"]), Number.NaN);
      const quantityCell = readFirstCell(row, ["Opening quantity", "Stock quantity", "Quantity"]);
      const quantity = cellNumber(quantityCell, Number.NaN);
      const reorderLevel = cellNumber(readCell(row, "Reorder level"));
      const reorderQty = cellNumber(readCell(row, "Reorder quantity"));
      const averageCost = cellNumber(readCell(row, "Average cost (GHS)"), costPrice);
      if ([costPrice, sellingPrice, quantity, reorderLevel, reorderQty, averageCost].some((value) => !Number.isFinite(value) || value < 0)) {
        skipped += 1;
        issues.push({ row: rowNumber, message: "Prices and stock quantities must be valid non-negative numbers." });
        continue;
      }

      const productType = cellText(readCell(row, "Product type")).toUpperCase() || "UNIT";
      if (!VALID_PRODUCT_TYPES.has(productType)) {
        skipped += 1;
        issues.push({ row: rowNumber, message: `Unsupported product type: ${productType}.` });
        continue;
      }

      const barcodes = parseBarcodes(readFirstCell(row, ["Barcode", "Barcodes"]));
      const seenRowBarcodes = new Set<string>();
      const duplicateBarcode = barcodes.find((barcode) => {
        if (knownBarcodes.has(barcode.code) || seenRowBarcodes.has(barcode.code)) return true;
        seenRowBarcodes.add(barcode.code);
        return false;
      });
      if (duplicateBarcode) {
        skipped += 1;
        issues.push({ row: rowNumber, message: `Barcode ${duplicateBarcode.code} is already assigned to a product.` });
        continue;
      }

      const relationIds: Record<string, string> = {};
      const relationFields = [
        ["Category", "categoryId", categoryByName],
        ["Brand", "brandId", brandByName],
        ["Supplier", "supplierId", supplierByName],
        ["Unit", "unitId", unitByName],
      ] as const;
      for (const [heading, field, lookup] of relationFields) {
        const value = cellText(readCell(row, heading));
        if (!value) continue;
        const id = lookup.get(normalized(value));
        if (id) relationIds[field] = id;
        else issues.push({ row: rowNumber, message: `${heading} "${value}" was not found and was not assigned.` });
      }
      const taxLabel = cellText(readCell(row, "Tax rate"));
      const taxName = taxLabel.replace(/\s+\(\d+(?:\.\d+)?%\)$/, "");
      if (taxName) {
        const taxRateId = taxByName.get(normalized(taxName));
        if (taxRateId) relationIds.taxRateId = taxRateId;
        else issues.push({ row: rowNumber, message: `Tax rate "${taxName}" was not found and was not assigned.` });
      }

      const rowBarcodes = barcodes.map((barcode, index) => ({
        code: barcode.code,
        packSize: DECIMAL_QTY(barcode.packSize),
        isPrimary: barcode.isPrimary || index === 0,
      }));
      const expiryDateValue = readFirstCell(row, ["Expiry date", "Expiry"]);
      const expiryDate = cellDate(expiryDateValue);
      if (expiryDateValue !== null && expiryDateValue !== undefined && expiryDateValue !== "" && !expiryDate) {
        skipped += 1;
        issues.push({ row: rowNumber, message: "Expiry date is not a valid date." });
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              storeId: session.user.storeId!,
              sku,
              name,
              description: cellText(readCell(row, "Description")) || null,
              type: productType as "UNIT" | "WEIGHED" | "SERVICE",
              imageUrl: cellText(readCell(row, "Image URL")) || null,
              costPrice: DECIMAL_MONEY(costPrice),
              sellingPrice: DECIMAL_MONEY(sellingPrice),
              isVatInclusive: cellBoolean(readCell(row, "VAT inclusive"), false),
              reorderLevel: DECIMAL_QTY(reorderLevel),
              reorderQty: DECIMAL_QTY(reorderQty),
              trackStock: cellBoolean(readCell(row, "Track stock"), true),
              allowDiscount: cellBoolean(readCell(row, "Allow discount"), true),
              isActive: cellBoolean(readCell(row, "Active"), true),
              ...relationIds,
              ...(rowBarcodes.length ? { barcodes: { create: rowBarcodes } } : {}),
            },
            select: { id: true },
          });
          const inventory = await tx.inventoryLevel.create({
            data: {
              storeId: session.user.storeId!,
              productId: product.id,
              quantity: DECIMAL_QTY(quantity),
              reservedQty: DECIMAL_QTY(0),
              averageCost: DECIMAL_MONEY(averageCost),
              lastCountedAt: cellDate(readCell(row, "Last counted")),
            },
            select: { quantity: true },
          });
          let batchId: string | undefined;
          if (expiryDate || quantity > 0) {
            const batch = await tx.productBatch.create({
              data: {
                productId: product.id,
                batchNumber: `OPENING-${sku}`,
                expiryDate,
                quantity: DECIMAL_QTY(quantity),
                costPrice: DECIMAL_MONEY(costPrice),
              },
              select: { id: true },
            });
            batchId = batch.id;
          }
          if (quantity > 0) {
            await tx.stockMovement.create({
              data: {
                storeId: session.user.storeId!,
                productId: product.id,
                batchId,
                type: "PURCHASE_RECEIPT",
                quantity: DECIMAL_QTY(quantity),
                balanceAfter: DECIMAL_QTY(Number(inventory.quantity)),
                unitCost: DECIMAL_MONEY(costPrice),
                referenceType: "PRODUCT_IMPORT",
                reason: "Opening stock imported from product workbook",
                performedById: session.user.id,
              },
            });
          }
        });
        imported += 1;
        knownSkus.add(normalized(sku));
        knownNames.add(normalized(name));
        for (const barcode of barcodes) knownBarcodes.add(barcode.code);
      } catch (error) {
        skipped += 1;
        issues.push({ row: rowNumber, message: isUniqueConflict(error) ? "A SKU, name, or barcode conflicts with an existing product." : "The product could not be imported." });
      }
    }

    return created({ imported, skipped, issues });
  } catch (error) {
    return handleApiError(error);
  }
}