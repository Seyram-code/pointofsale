import ExcelJS from "exceljs";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, fail } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await authorize(PERMISSIONS.PRODUCTS_VIEW);
    if (!session.user.storeId) return fail("BAD_REQUEST", "Your account is not linked to a store.", 400);

    const storeId = session.user.storeId;
    const products = await prisma.product.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        sku: true,
        name: true,
        description: true,
        imageUrl: true,
        type: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        supplier: { select: { name: true } },
        unit: { select: { abbreviation: true } },
        barcodes: { orderBy: [{ isPrimary: "desc" }, { code: "asc" }], select: { code: true, packSize: true, isPrimary: true } },
        costPrice: true,
        sellingPrice: true,
        taxRate: { select: { name: true, rate: true } },
        isVatInclusive: true,
        inventoryLevels: {
          where: { storeId },
          take: 1,
          select: { quantity: true, reservedQty: true, averageCost: true, lastCountedAt: true },
        },
        reorderLevel: true,
        reorderQty: true,
        trackStock: true,
        allowDiscount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VidyPOS";
    workbook.created = new Date();
    workbook.subject = "Store product catalogue backup";
    workbook.title = "Product backup";

    const worksheet = workbook.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
    worksheet.columns = [
      { header: "SKU", key: "sku", width: 18 },
      { header: "Product name", key: "name", width: 30 },
      { header: "Description", key: "description", width: 36 },
      { header: "Product type", key: "type", width: 16 },
      { header: "Image URL", key: "imageUrl", width: 36 },
      { header: "Category", key: "category", width: 20 },
      { header: "Brand", key: "brand", width: 20 },
      { header: "Supplier", key: "supplier", width: 24 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Barcodes", key: "barcodes", width: 30 },
      { header: "Cost price (GHS)", key: "costPrice", width: 18 },
      { header: "Selling price (GHS)", key: "sellingPrice", width: 20 },
      { header: "Tax rate", key: "taxRate", width: 16 },
      { header: "VAT inclusive", key: "isVatInclusive", width: 16 },
      { header: "Stock quantity", key: "quantity", width: 18 },
      { header: "Reserved quantity", key: "reservedQty", width: 20 },
      { header: "Average cost (GHS)", key: "averageCost", width: 20 },
      { header: "Last counted", key: "lastCountedAt", width: 20 },
      { header: "Track stock", key: "trackStock", width: 14 },
      { header: "Reorder level", key: "reorderLevel", width: 16 },
      { header: "Reorder quantity", key: "reorderQty", width: 18 },
      { header: "Allow discount", key: "allowDiscount", width: 16 },
      { header: "Active", key: "isActive", width: 12 },
      { header: "Created at", key: "createdAt", width: 22 },
      { header: "Updated at", key: "updatedAt", width: 22 },
    ];
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
    worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(25).letter}1` };

    for (const product of products) {
      const inventory = product.inventoryLevels[0];
      worksheet.addRow({
        sku: product.sku,
        name: product.name,
        description: product.description,
        type: product.type,
        imageUrl: product.imageUrl,
        category: product.category?.name,
        brand: product.brand?.name,
        supplier: product.supplier?.name,
        unit: product.unit?.abbreviation,
        barcodes: product.barcodes.map((barcode) => `${barcode.code}${barcode.isPrimary ? " (primary)" : ""} x${Number(barcode.packSize)}`).join(", "),
        costPrice: Number(product.costPrice),
        sellingPrice: Number(product.sellingPrice),
        taxRate: product.taxRate ? `${product.taxRate.name} (${(Number(product.taxRate.rate) * 100).toFixed(2)}%)` : "",
        isVatInclusive: product.isVatInclusive ? "Yes" : "No",
        quantity: inventory ? Number(inventory.quantity) : 0,
        reservedQty: inventory ? Number(inventory.reservedQty) : 0,
        averageCost: inventory ? Number(inventory.averageCost) : 0,
        lastCountedAt: inventory?.lastCountedAt,
        trackStock: product.trackStock ? "Yes" : "No",
        reorderLevel: Number(product.reorderLevel),
        reorderQty: Number(product.reorderQty),
        allowDiscount: product.allowDiscount ? "Yes" : "No",
        isActive: product.isActive ? "Yes" : "No",
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      });
    }

    for (const key of ["costPrice", "sellingPrice", "averageCost"] as const) {
      worksheet.getColumn(key).numFmt = '"GHS "#,##0.00';
    }
    for (const key of ["quantity", "reservedQty", "reorderLevel", "reorderQty"] as const) {
      worksheet.getColumn(key).numFmt = "#,##0.###";
    }
    for (const key of ["lastCountedAt", "createdAt", "updatedAt"] as const) {
      worksheet.getColumn(key).numFmt = "yyyy-mm-dd hh:mm";
    }

    const file = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="vidypos-products-backup-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}