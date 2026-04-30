"use client";
import { useEffect, useState } from "react";

export function PWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed or permanently dismissed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    if (localStorage.getItem("kb_pwa_dismissed") === "1") return;

    // Skip on iOS and Windows — Android only
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    const win = /windows/i.test(navigator.userAgent);
    if (ios || win) return;

    // Android/Chrome install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    localStorage.setItem("kb_pwa_dismissed", "1");
    setShow(false);
  }

  if (isInstalled || !show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 72, left: 12, right: 12,
      background: "var(--surf)", border: "1px solid rgba(245,166,35,0.4)",
      borderRadius: 16, padding: "16px", zIndex: 999,
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 36, flexShrink: 0 }}>✦</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
          Install KNOWBOTH.AI
        </div>
        {isIOS
          ? <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for the best experience
            </div>
          : <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Install as app for faster access, offline support & home screen icon
            </div>
        }
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        {!isIOS && (
          <button onClick={install} style={{
            background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
            color: "#000", border: "none", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            Install
          </button>
        )}
        <button onClick={() => { localStorage.setItem("kb_pwa_dismissed","1"); setShow(false); }} style={{
          background: "none", border: "none",
          color: "var(--text-dim)", fontSize: 11, cursor: "pointer",
        }}>
          Not now
        </button>
      </div>
    </div>
  );
}
