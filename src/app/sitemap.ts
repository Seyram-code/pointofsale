import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.NODE_ENV === "production" ? "https://vidyposgh.com" : "http://localhost:3000");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ["/", "/plans", "/privacy-policy", "/terms"].map((path) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "yearly",
    priority: path === "/" ? 1 : 0.5,
  }));
}