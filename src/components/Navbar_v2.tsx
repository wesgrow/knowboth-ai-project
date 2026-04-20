"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function Navbar() {
  const pathname = usePathname();
  const { user, updateLocation, updateTheme } = useAppStore();
  const [editLoc, setEditLoc] = useState(false);
  const [locInput, setLocInput] = useState(
    user ? `${user.city || ""} ${user.zip || ""}`.trim() : ""
  );
  const cart = useAppStore(s => s.cart);
  const pending = cart.filter(i => !i.purchased).length;

  const tabs = [
    { href: "/deals", label: "Deals", icon: "🏷️" },
    { href: "/compare", label: "Compare", icon: "⚖️" },
    { href: "/cart", label: "Cart", icon: "🛒", badge: pending },
    { href: "/scan", label: "Scan", icon: "🧾" },
    { href: "/pantry", label: "Pantry", icon: "🏠" },
    { href: "/expenses", label: "Expenses", icon: "📊" },
  ];

  if (!user) return null;

  function saveLocation() {
    const parts = locInput.trim().split(/[\s,]+/);
    const zip = parts.find(p => /^\d{5}/.test(p)) || user?.zip || "";
    const city = parts.filter(p => !/^\d/.test(p)).join(" ") || user?.city || "";
    updateLocation(zip, city);
    setEditLoc(false);
  }

  return (
    <>
      <style>{`
        .navbar-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--surf);
          border-bottom: 1px solid var(--border);
          padding: 10px 16px;
        }
        .navbar-inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: nowrap;
        }
        .loc-btn {
          background: var(--surf2);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 11px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .theme-sel {
          background: var(--surf2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px 6px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
        }
        .pts-badge {
          background: rgba(245,166,35,0.12);
          border: 1px solid rgba(245,166,35,0.3);
          border-radius: 20px;
          padding: 4px 8px;
          font-size: 11px;
          color: var(--gold);
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .av-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(245,166,35,0.15);
          border: 1.5px solid rgba(245,166,35,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .loc-edit {
          max-width: 800px;
          margin: 8px auto 0;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: var(--surf);
          border-top: 1px solid var(--border);
          display: flex;
        }
        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 2px 6px;
          text-decoration: none;
          color: var(--text-dim);
          font-size: 10px;
          font-weight: 600;
          position: relative;
          transition: color 0.15s;
        }
        .nav-tab.active {
          color: var(--gold);
        }
        .nav-tab-icon {
          font-size: 20px;
          line-height: 1;
        }
        .nav-tab-label {
          font-size: 9px;
          letter-spacing: 0.2px;
        }
        .cart-badge {
          position: absolute;
          top: 4px;
          right: calc(50% - 18px);
          background: var(--gold);
          color: #000;
          font-size: 9px;
          font-weight: 900;
          border-radius: 10px;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          line-height: 1;
          border: 2px solid var(--bg);
        }
        .page-body {
          padding-bottom: 64px;
        }
        @media (max-width: 480px) {
          .navbar-header { padding: 8px 12px; }
          .pts-badge { display: none; }
          .loc-btn { max-width: 90px; font-size: 10px; }
          .nav-tab-label { font-size: 9px; }
          .nav-tab-icon { font-size: 18px; }
        }
        @media (min-width: 768px) {
          .nav-tab-label { font-size: 10px; }
          .nav-tab-icon { font-size: 20px; }
          .bottom-nav { 
            max-width: 800px;
            left: 50%;
            transform: translateX(-50%);
            border-left: 1px solid var(--border);
            border-right: 1px solid var(--border);
          }
        }
      `}</style>

      <header className="navbar-header">
        <div className="navbar-inner">
          <Link href="/deals" className="navbar-logo">
            <span style={{ fontSize: 18, color: "var(--gold)" }}>✦</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>KNOWBOTH</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--teal)" }}>.AI</span>
          </Link>

          <div className="navbar-right">
            <button className="loc-btn" onClick={() => setEditLoc(!editLoc)}>
              📍 {user.city || user.zip || "Location"}
            </button>

            <select
              className="theme-sel"
              value={user.theme}
              onChange={e => updateTheme(e.target.value as any)}
            >
              <option value="dark">🌙</option>
              <option value="light">☀️</option>
              <option value="auto">⚙️</option>
            </select>

            <div className="pts-badge">✦ {user.points || 0}</div>

            <div className="av-btn">{user.avatar}</div>
          </div>
        </div>

        {editLoc && (
          <div className="loc-edit">
            <input
              className="input"
              value={locInput}
              onChange={e => setLocInput(e.target.value)}
              placeholder="City, ZIP (e.g. Dallas 75074)"
              style={{ flex: 1 }}
              onKeyDown={e => e.key === "Enter" && saveLocation()}
            />
            <button className="btn-gold" onClick={saveLocation}
              style={{ padding: "8px 14px", fontSize: 12 }}>
              Save
            </button>
          </div>
        )}
      </header>

      <nav className="bottom-nav">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`nav-tab ${pathname === t.href ? "active" : ""}`}
          >
            <span className="nav-tab-icon">{t.icon}</span>
            <span className="nav-tab-label">{t.label}</span>
            {t.badge && t.badge > 0 && (
              <span className="cart-badge">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
