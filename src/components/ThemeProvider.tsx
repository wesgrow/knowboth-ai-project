"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light"|"dark";
interface ThemeCtx { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void; }

const Ctx = createContext<ThemeCtx>({ theme:"dark", toggle:()=>{}, setTheme:()=>{} });

export function useTheme() { return useContext(Ctx); }

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("kb-theme") as Theme|null;
    const preferred = window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
    const initial = stored || preferred;
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("kb-theme", t);
  }

  return (
    <Ctx.Provider value={{ theme, toggle:()=>setTheme(theme==="dark"?"light":"dark"), setTheme }}>
      {children}
    </Ctx.Provider>
  );
}
