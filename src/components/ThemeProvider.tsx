"use client";
import { useEffect } from "react";

export function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("kb-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  return null;
}
