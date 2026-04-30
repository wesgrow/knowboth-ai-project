import type { Metadata } from "next";
import "./globals.css";
import { AuthSync } from "@/components/AuthSync";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/ChatWidget";
import { Toaster } from "react-hot-toast";

export const viewport = { themeColor: "#FF9F0A" };

export const metadata: Metadata = {
  title: "KNOWBOTH.AI — Know Your Savings. Know Your Spending.",
  description: "Smart grocery price comparison and expense tracker for Indian households in DFW",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "KNOWBOTH.AI" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="apple-touch-icon" href="/icons/icon-192.png"/>
      </head>
      <body>
        <ThemeProvider>
          <AuthSync/>
          <Navbar/>
          <div className="main-content">
            {children}
          </div>
          <ChatWidget/>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 2500,
            style: {
              background: "var(--surf)",
              color: "var(--text)",
              border: "0.5px solid var(--border)",
              fontSize: "13px",
              boxShadow: "var(--shadow-md)",
              borderRadius: "12px",
              padding: "10px 14px",
            },
          }}
        />
        </ThemeProvider>
      </body>
    </html>
  );
}
