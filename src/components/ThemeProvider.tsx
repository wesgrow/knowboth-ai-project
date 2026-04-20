"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAppStore(s=>s.user);
  useEffect(()=>{
    const theme = user?.theme||"dark";
    const root = document.documentElement;
    if(theme==="dark") root.classList.add("dark");
    else if(theme==="light") root.classList.remove("dark");
    else { const d=window.matchMedia("(prefers-color-scheme: dark)").matches; d?root.classList.add("dark"):root.classList.remove("dark"); }
  },[user?.theme]);
  return <>{children}</>;
}
