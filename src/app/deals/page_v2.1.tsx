"use client";
import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   🏷️ DEALS PAGE v3 — with PriceSource icons (receipt/flyer/manual)
═══════════════════════════════════════════════════════════════ */

// ── Shared storage helpers ──────────────────────────────────
async function sharedGet(key: string) {
  try { const r = await (window as any).storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function sharedSet(key: string, value: any) {
  try { await (window as any).storage.set(key, JSON.stringify(value), true); return true; } catch { return false; }
}
const lsGet = (k: string, d: any) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; } };
const lsSet = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── Types ────────────────────────────────────────────────────
type SourceType = "receipt" | "flyer" | "manual";

interface Deal {
  id: string;
  item: string;
  store: string;
  branch: string;
  salePrice: number;
  regularPrice?: number;
  unit?: string;
  category: string;
  source: SourceType;
  verifiedAt: number; // timestamp
  expiresAt?: string; // ISO date string
  postedBy: string;
  upvotes: number;
  upvotedBy: string[];
}

// ── Source config ────────────────────────────────────────────
const SOURCE_CONFIG: Record<SourceType, { icon: string; label: string; color: string; bg: string }> = {
  receipt: { icon: "🧾", label: "Receipt", color: "#16a34a", bg: "#dcfce7" },
  flyer:   { icon: "📰", label: "Flyer",   color: "#0369a1", bg: "#e0f2fe" },
  manual:  { icon: "✏️",  label: "Manual",  color: "#b45309", bg: "#fef3c7" },
};

// ── Seed data ────────────────────────────────────────────────
const SEED_DEALS: Deal[] = [
  { id:"d1", item:"Basmati Rice 20lb", store:"H-E-B", branch:"Coppell", salePrice:14.99, regularPrice:18.49, unit:"bag", category:"Grains", source:"flyer",   verifiedAt:Date.now()-3600000*2,  expiresAt:"2026-04-27", postedBy:"Priya", upvotes:7, upvotedBy:[] },
  { id:"d2", item:"Whole Milk 1 Gal",  store:"Costco", branch:"Grapevine", salePrice:3.49, regularPrice:4.29, unit:"gal", category:"Dairy",  source:"receipt", verifiedAt:Date.now()-3600000*5,  postedBy:"Kumar", upvotes:4, upvotedBy:[] },
  { id:"d3", item:"Chicken Breast",    store:"Kroger", branch:"Lewisville", salePrice:1.99, regularPrice:3.49, unit:"lb",  category:"Meat",   source:"flyer",   verifiedAt:Date.now()-3600000*10, expiresAt:"2026-04-22", postedBy:"Ananya", upvotes:12, upvotedBy:[] },
  { id:"d4", item:"Organic Spinach",   store:"Whole Foods", branch:"Southlake", salePrice:2.99, regularPrice:4.49, unit:"bag", category:"Produce", source:"manual", verifiedAt:Date.now()-3600000*1, postedBy:"Ravi", upvotes:3, upvotedBy:[] },
  { id:"d5", item:"Greek Yogurt 32oz", store:"Target", branch:"Coppell", salePrice:4.49, regularPrice:5.99, unit:"tub", category:"Dairy", source:"receipt", verifiedAt:Date.now()-86400000, postedBy:"Deepa", upvotes:6, upvotedBy:[] },
];

const CATEGORIES = ["All", "Grains", "Dairy", "Meat", "Produce", "Snacks", "Beverages", "Frozen", "Other"];
const SOURCES: SourceType[] = ["receipt", "flyer", "manual"];

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const daysLeft = (iso?: string) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

const savePct = (sale: number, reg?: number) =>
  reg && reg > sale ? Math.round((1 - sale / reg) * 100) : null;

// ── PriceSource badge ─────────────────────────────────────────
function PriceSourceBadge({ source }: { source: SourceType }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Deal card ─────────────────────────────────────────────────
function DealCard({ deal, myId, onUpvote }: { deal: Deal; myId: string; onUpvote: (id: string) => void }) {
  const pct  = savePct(deal.salePrice, deal.regularPrice);
  const days = daysLeft(deal.expiresAt);
  const voted = deal.upvotedBy.includes(myId);

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "1px solid #e5e7eb",
      padding: "16px 18px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Top row: item + save badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", lineHeight: 1.3 }}>{deal.item}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{deal.store} · {deal.branch}</div>
        </div>
        {pct && (
          <span style={{
            background: "#dc2626", color: "#fff",
            fontWeight: 800, fontSize: 13, padding: "3px 9px",
            borderRadius: 8, whiteSpace: "nowrap",
          }}>
            -{pct}%
          </span>
        )}
      </div>

      {/* Price row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>
          ${deal.salePrice.toFixed(2)}
        </span>
        {deal.unit && <span style={{ fontSize: 12, color: "#9ca3af" }}>/{deal.unit}</span>}
        {deal.regularPrice && (
          <span style={{ fontSize: 13, color: "#9ca3af", textDecoration: "line-through" }}>
            ${deal.regularPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Source + expiry row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <PriceSourceBadge source={deal.source} />

        {days !== null && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
            background: days <= 2 ? "#fef2f2" : "#f0fdf4",
            color: days <= 2 ? "#dc2626" : "#15803d",
            border: `1px solid ${days <= 2 ? "#fca5a5" : "#86efac"}`,
          }}>
            ⏰ {days <= 0 ? "Expires today" : `${days}d left`}
          </span>
        )}

        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
          {timeAgo(deal.verifiedAt)} · {deal.postedBy}
        </span>
      </div>

      {/* Upvote */}
      <button
        onClick={() => onUpvote(deal.id)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: voted ? "#f0fdf4" : "#f9fafb",
          border: `1px solid ${voted ? "#86efac" : "#e5e7eb"}`,
          borderRadius: 8, padding: "6px 12px",
          cursor: "pointer", fontSize: 13, fontWeight: 600,
          color: voted ? "#15803d" : "#374151",
          alignSelf: "flex-start", transition: "all 0.15s",
        }}
      >
        👍 {deal.upvotes} {voted ? "Thanks!" : "Helpful"}
      </button>
    </div>
  );
}

// ── Add deal form ─────────────────────────────────────────────
function AddDealForm({ onAdd, onClose }: { onAdd: (d: Deal) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    item: "", store: "", branch: "", salePrice: "", regularPrice: "",
    unit: "", category: "Grains", source: "receipt" as SourceType, expiresAt: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.item || !form.store || !form.salePrice) return;
    onAdd({
      id: Date.now().toString(36),
      item: form.item, store: form.store, branch: form.branch,
      salePrice: parseFloat(form.salePrice),
      regularPrice: form.regularPrice ? parseFloat(form.regularPrice) : undefined,
      unit: form.unit || undefined,
      category: form.category,
      source: form.source,
      verifiedAt: Date.now(),
      expiresAt: form.expiresAt || undefined,
      postedBy: "You",
      upvotes: 0, upvotedBy: [],
    });
    onClose();
  };

  const field = (label: string, key: string, placeholder?: string, type = "text") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</label>
      <input
        type={type} value={(form as any)[key]} placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
        style={{
          border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px",
          fontSize: 14, outline: "none", background: "#fff",
        }}
      />
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 999, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 20,
        width: "100%", maxWidth: 480,
        display: "flex", flexDirection: "column", gap: 14,
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>📢 Post a Deal</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        {field("Item Name *", "item", "e.g. Basmati Rice 20lb")}
        {field("Store *", "store", "e.g. H-E-B")}
        {field("Branch / Location", "branch", "e.g. Coppell")}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {field("Sale Price *", "salePrice", "0.00", "number")}
          {field("Regular Price", "regularPrice", "0.00", "number")}
        </div>
        {field("Unit", "unit", "lb / bag / gal")}

        {/* Source selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Price Source *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {SOURCES.map(s => {
              const cfg = SOURCE_CONFIG[s];
              const active = form.source === s;
              return (
                <button key={s} onClick={() => set("source", s)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${active ? cfg.color : "#e5e7eb"}`,
                  background: active ? cfg.bg : "#f9fafb",
                  color: active ? cfg.color : "#6b7280",
                  fontWeight: 600, fontSize: 13, transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}>
                  <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 14, background: "#fff" }}>
            {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {field("Expires On", "expiresAt", "", "date")}

        <button onClick={submit} style={{
          background: "#15803d", color: "#fff", border: "none", borderRadius: 10,
          padding: "12px", fontWeight: 700, fontSize: 15, cursor: "pointer",
        }}>
          ✅ Post Deal
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [srcFilter, setSrcFilter] = useState<SourceType | "All">("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const myId = lsGet("sm_my_id", (() => { const id = Math.random().toString(36).slice(2); lsSet("sm_my_id", id); return id; })());

  const load = useCallback(async () => {
    const saved = await sharedGet("sm_deals_v5");
    setDeals(saved && saved.length ? saved : SEED_DEALS);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (updated: Deal[]) => {
    setDeals(updated);
    await sharedSet("sm_deals_v5", updated);
  };

  const handleUpvote = async (id: string) => {
    const updated = deals.map(d => {
      if (d.id !== id) return d;
      const alreadyVoted = d.upvotedBy.includes(myId);
      return {
        ...d,
        upvotes: alreadyVoted ? d.upvotes - 1 : d.upvotes + 1,
        upvotedBy: alreadyVoted ? d.upvotedBy.filter(x => x !== myId) : [...d.upvotedBy, myId],
      };
    });
    await save(updated);
  };

  const handleAdd = async (d: Deal) => {
    await save([d, ...deals]);
  };

  const filtered = deals.filter(d => {
    if (cat !== "All" && d.category !== cat) return false;
    if (srcFilter !== "All" && d.source !== srcFilter) return false;
    if (search && !d.item.toLowerCase().includes(search.toLowerCase()) && !d.store.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "16px 16px 0", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 20 }}>🏷️ Community Deals</span>
          <button onClick={() => setShowForm(true)} style={{
            background: "#15803d", color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            + Post Deal
          </button>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search item or store…"
          style={{
            width: "100%", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "9px 12px", fontSize: 14, background: "#f9fafb",
            outline: "none", boxSizing: "border-box", marginBottom: 10,
          }}
        />

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              background: cat === c ? "#15803d" : "#f3f4f6",
              color: cat === c ? "#fff" : "#374151",
              border: "none", borderRadius: 99, padding: "5px 12px",
              fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer",
            }}>{c}</button>
          ))}
        </div>

        {/* Source filter tabs */}
        <div style={{ display: "flex", gap: 6, paddingBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          {(["All", ...SOURCES] as (SourceType | "All")[]).map(s => {
            const active = srcFilter === s;
            const cfg = s !== "All" ? SOURCE_CONFIG[s] : null;
            return (
              <button key={s} onClick={() => setSrcFilter(s)} style={{
                background: active ? (cfg ? cfg.bg : "#111827") : "#f3f4f6",
                color: active ? (cfg ? cfg.color : "#fff") : "#6b7280",
                border: `1.5px solid ${active ? (cfg ? cfg.color : "#111827") : "transparent"}`,
                borderRadius: 99, padding: "4px 12px",
                fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {cfg ? cfg.icon : "🗂️"} {cfg ? cfg.label : "All Sources"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading deals…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No deals found 🤷</div>
        )}
        {filtered.map(d => (
          <DealCard key={d.id} deal={d} myId={myId} onUpvote={handleUpvote} />
        ))}
      </div>

      {showForm && <AddDealForm onAdd={handleAdd} onClose={() => setShowForm(false)} />}
    </div>
  );
}
