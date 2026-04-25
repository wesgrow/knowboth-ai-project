import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthSync } from "@/components/AuthSync";
import { PWAInstall } from "@/components/PWAInstall";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "KNOWBOTH.AI — Know Your Savings. Know Your Spending.",
  description: "Scan any bill. Compare grocery prices. Track all expenses. Globally.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KNOWBOTH.AI",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: "KNOWBOTH.AI",
    description: "Know Your Savings. Know Your Spending.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F5A623",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider>
          <AuthSync />
          {children}
          <PWAInstall />
        </ThemeProvider>
    <Toaster 
  position="top-right"
  toastOptions={{
    duration: 2000,
    style: {
      background: "#fff",
      color: "#1C1C1E",
      border: "1px solid #F2F2F7",
      fontSize: "13px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      borderRadius: "12px",
      padding: "10px 14px",
    },
  }}
/>
      </body>
    </html>
  );
}
