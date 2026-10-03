import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PwaRegistration } from "@/components/providers/PwaRegistration";
import { ToastProvider } from "@/components/ui/Toast";
import { publicEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: {
    default: `${publicEnv.appName} — Point of Sale`,
    template: `%s · ${publicEnv.appName}`,
  },
  description: "Point of sale and retail management for shops and pharmacies in Ghana.",
  applicationName: publicEnv.appName,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/vidypos-cart.png",
    shortcut: "/icons/vidypos-cart.png",
    apple: "/icons/vidypos-cart.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#12181f" },
  ],
};

const themeBootstrap = `
  try {
    var stored = localStorage.getItem("mypos.theme");
    var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          <PwaRegistration />
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
