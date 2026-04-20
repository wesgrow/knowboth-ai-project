"use client";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { CAT_ICONS } from "@/lib/utils";

const DEMO_BILLS = [
  { store: "Patel Brothers", cat: "Grocery", date: "2026-04-19", amount: 46.43, saved: 4.70, status: "saved", pts: 37 },
  { store: "Shell Gas", cat: "Gas", date: "2026-04-17", amount: 52.00, saved: 0, status: "even", pts: 12 },
  { store: "Biryani House", cat: "Restaurant", date: "2026-04-15", amount: 34.00, saved: -4.50, status: "overpaid", pts: 8 },
  { store: "CVS Pharmacy", cat: "Pharmacy", date: "2026-04-12", amount: 28.50, saved: -3.20, status: "overpaid", pts: 18 },
  { store: "India Bazaar", cat: "Grocery", date: "2026-04-10", amount: 38.20, saved: 6.40, status: "saved", pts: 29 },
  { store: "Patel Brothers", cat: "Grocery", date: "2026-03-28", amount: 52.10, saved: 5.20, status: "saved", pts: 31 },
  { store: "Walmart", cat: "Household", date: "2026-03-22", amount: 78.40, saved: -2.10, status: "overpaid", pts: 10 },
  { store: "Shell Gas", cat: "Gas", date: "2026-03-15", amount: 49.00, saved: 0, status: "even", pts: 8 },
];

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: -1 },
];

export default function ExpensesPage() {
  const { user } = useAppStore();
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [bills] = useState(DEMO_BILLS);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  function applyPreset(days: number) {
    if (days === -1) { setDateFrom(""); setDateTo(""); return; }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(from.toISOString().split("T")[0]);
    setDateTo(to.toISOString().split("T")[0]);
  }

  const filtered = bills.filter(b => {
    const mc = filterCat === "All" || b.cat === filterCat;
    const ms = filterStatus === "All" || b.status === filterStatus;
    const bDate = new Date(b.date);
    const mdf = !dateFrom || bDate >= new Date(dateFrom);
    const mdt = !dateTo || bDate <= new Date(dateTo);
    return mc && ms && mdf && mdt;
  });

  const total = filtered.reduce((s, b) => s + b.amount, 0);
  const saved = filtered.filter(b => b.status === "saved").reduce((s, b) => s + b.saved, 0);
  const overpaid = filtered.filter(b => b.status === "overpaid").reduce((s, b) => s + Math.abs(b.saved), 0);

  const cats = [...new Set(bills.map(b => b.cat))];
  const catTotals: Record<string, number> = {};
  filtered.forEach(b => { catTotals[b.cat] = (catTotals[b.cat] || 0) + b.amount; });
  const maxCat = Math.max(...Object.values(catTotals), 1);

  const activeFilters = [
    filterCat !== "All" && filterCat,
    filterStatus !== "All" && filterStatus,
    (dateFrom || dateTo) && `${dateFrom || "..."} → ${dateTo || "..."}`,
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>Expenses</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Track every bill by category</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
          {[
            { l: "Spent", v: fmt(total), c: "var(--gold)" },
            { l: "Saved", v: fmt(Math.max(0, saved)), c: "var(--teal)" },
            { l: "Overpaid", v: fmt(overpaid), c: "var(--red)" },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: s.c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          {/* Category filter */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1.2, marginBottom: 6 }}>CATEGORY</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
            {["All", ...cats].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", border: "none",
                background: filterCat === c ? "rgba(245,166,35,0.12)" : "var(--surf2)",
                color: filterCat === c ? "var(--gold)" : "var(--text-muted)",
                outline: filterCat === c ? "1px solid rgba(245,166,35,0.35)" : "1px solid var(--border)",
              }}>{c}</button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1.2, marginBottom: 6 }}>STATUS</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {["All", "saved", "even", "overpaid"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", border: "none",
                background: filterStatus === s ? "rgba(245,166,35,0.12)" : "var(--surf2)",
                color: filterStatus === s ? "var(--gold)" : "var(--text-muted)",
                outline: filterStatus === s ? "1px solid rgba(245,166,35,0.35)" : "1px solid var(--border)",
                textTransform: "capitalize" as const,
              }}>{s}</button>
            ))}
          </div>

          {/* Date Range */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1.2 }}>DATE RANGE</div>
            <button onClick={() => setShowDateFilter(!showDateFilter)} style={{
              background: "none", border: "none", fontSize: 11,
              color: "var(--gold)", cursor: "pointer", fontWeight: 700,
            }}>
              {showDateFilter ? "▲ Hide" : "▼ Expand"}
            </button>
          </div>

          {/* Preset buttons */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: showDateFilter ? 10 : 0 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.days)} style={{
                borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: "none",
                background: "var(--surf2)", color: "var(--text-muted)",
                outline: "1px solid var(--border)",
              }}>{p.label}</button>
            ))}
          </div>

          {/* Custom date inputs */}
          {showDateFilter && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>FROM</div>
                <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>TO</div>
                <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 13 }} />
              </div>
            </div>
          )}
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Filters:</span>
            {activeFilters.map((f, i) => (
              <span key={i} className="pill pill-gold" style={{ fontSize: 10 }}>{f as string}</span>
            ))}
            <button onClick={() => { setFilterCat("All"); setFilterStatus("All"); setDateFrom(""); setDateTo(""); }}
              style={{ background: "none", border: "none", fontSize: 11, color: "var(--red)", cursor: "pointer", fontWeight: 700 }}>
              Clear all
            </button>
          </div>
        )}

        {/* Category breakdown */}
        {Object.keys(catTotals).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 10 }}>By Category</div>
            <div style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              {Object.entries(catTotals).map(([cat, amt]) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{CAT_ICONS[cat] || "🛒"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{cat}</div>
                    <div style={{ height: 6, background: "var(--surf2)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,var(--gold),var(--gold-dim))", width: `${(amt / maxCat) * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", minWidth: 60, textAlign: "right" }}>{fmt(amt)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Bill History */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 10 }}>
          Bill History ({filtered.length})
        </div>
        <div style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No bills match your filters
            </div>
          )}
          {filtered.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{CAT_ICONS[b.cat] || "🛒"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.store}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{b.date} · {b.cat}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "var(--gold)" }}>{fmt(b.amount)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: b.status === "saved" ? "var(--teal)" : b.status === "even" ? "var(--gold)" : "var(--red)" }}>
                  {b.status === "saved" ? `+${fmt(b.saved)} saved` : b.status === "even" ? "Average" : `−${fmt(Math.abs(b.saved))} overpaid`}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-dim)" }}>+{b.pts} pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
