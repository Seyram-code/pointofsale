import "server-only";

const LOCAL_APP_URL = "http://localhost:3000";

function isInternalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1";
}

export function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      const production = process.env.NODE_ENV === "production";
      if ((!production || url.protocol === "https:") && (!production || !isInternalHost(url.hostname))) {
        return url.origin;
      }
    } catch {
      // Use the environment-appropriate fallback below for invalid URLs.
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be set to the deployed HTTPS domain");
  }
  return LOCAL_APP_URL;
}