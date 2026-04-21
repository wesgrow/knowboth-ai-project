import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
export const metadata: Metadata = { title:"KNOWBOTH.AI", description:"Know Your Savings. Know Your Spending." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster position="bottom-center" toastOptions={{style:{background:"var(--surf)",color:"var(--text)",border:"1px solid var(--border2)",fontSize:"13px"}}} />
      </body>
    </html>
  );
}
