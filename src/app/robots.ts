import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.NODE_ENV === "production" ? "https://vidyposgh.com" : "http://localhost:3000");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/plans", "/privacy-policy", "/terms", "/contact"],
      disallow: ["/api/", "/dashboard", "/pos", "/products", "/sales", "/reports", "/customers", "/employees", "/inventory", "/settings", "/profile", "/shifts", "/returns", "/purchase-orders", "/platform", "/system-staff", "/support", "/login", "/register", "/activate", "/reset-password", "/subscription", "/offline", "/forbidden"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: new URL(siteUrl).host,
  };
}