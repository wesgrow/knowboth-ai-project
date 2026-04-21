"use client";
import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   📊 COMPARE PAGE v4 — PriceSource icons (receipt/flyer/manual)
═══════════════════════════════════════════════════════════════ */

async function sharedGet(key: string) {
  try { const r = await (window as any).storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
}

type SourceType = "receipt" | "flyer" | "manual";

const SOURCE_CONFIG: Record<SourceType, { icon: string; label: string; color: string; bg: string }> = {
  receipt: { icon: "🧾", label: "Receipt", color: "#16a34a", bg: "#dcfce7" },
  flyer:   { icon: "📰", label: "Flyer",   color: "#0369a1", bg: "#e0f2fe" },
  manual:  { icon: "✏️",  label: "Manual",  color: "#b45309", bg: "#fef3c7" },
};

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
  verifiedAt: number;
  expiresAt?: string;
  postedBy: string;
  upvotes: number;
  upvotedBy: string[];
}

const SEED_DEALS: Deal[] = [
  { id:"d1", item:"Basmati Rice 20lb", store:"H-E-B",       branch:"Coppell",    salePrice:14.99, regularPrice:18.49, unit:"bag", category:"Grains",  source:"flyer",   verifiedAt:Date.now()-3600000*2,  expiresAt:"2026-04-27", postedBy:"Priya",  upvotes:7, upvotedBy:[] },
  { id:"d2", item:"Basmati Rice 20lb", store:"Costco",       branch:"Grapevine",  salePrice:16.49, regularPrice:18.99, unit:"bag", category:"Grains",  source:"receipt", verifiedAt:Date.now()-3600000*5,  postedBy:"Kumar",  upvotes:4, upvotedBy:[] },
  { id:"d3", item:"Basmati Rice 20lb", store:"Walmart",      branch:"Lewisville", salePrice:13.88, regularPrice:16.00, unit:"bag", category:"Grains",  source:"manual",  verifiedAt:Date.now()-3600000*10, postedBy:"Ananya", upvotes:2, upvotedBy:[] },
  { id:"d4", item:"Whole Milk 1 Gal",  store:"H-E-B",       branch:"Coppell",    salePrice:3.29,  regularPrice:4.29,  unit:"gal", category:"Dairy",   source:"flyer",   verifiedAt:Date.now()-3600000*1,  expiresAt:"2026-04-22", postedBy:"Ravi",   upvotes:6, upvotedBy:[] },
  { id:"d5", item:"Whole Milk 1 Gal",  store:"Costco",       branch:"Grapevine",  salePrice:3.49,  regularPrice:4.29,  unit:"gal", category:"Dairy",   source:"receipt", verifiedAt:Date.now()-86400000,   postedBy:"Deepa",  upvotes:3, upvotedBy:[] },
  { id:"d6", item:"Whole Milk 1 Gal",  store:"Target",       branch:"Coppell",    salePrice:3.79,  regularPrice:4.49,  unit:"gal", category:"Dairy",   source:"manual",  verifiedAt:Date.now()-3600000*3,  postedBy:"Siva",   upvotes:1, upvotedBy:[] },
  { id:"d7", item:"Chicken Breast",    store:"Kroger",       branch:"Lewisville", salePrice:1.99,  regularPrice:3.49,  unit:"lb",  category:"Meat",    source:"flyer",   verifiedAt:Date.now()-3600000*2,  expiresAt:"2026-04-22", postedBy:"Priya",  upvotes:9, upvotedBy:[] },
  { id:"d8", item:"Chicken Breast",    store:"H-E-B",        branch:"Coppell",    salePrice:2.29,  regularPrice:3.49,  unit:"lb",  category:"Meat",    source:"receipt", verifiedAt:Date.now()-3600000*6,  postedBy:"Kumar",  upvotes:5, upvotedBy:[] },
];

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

// ── PriceSource badge ──────────────────────────────────────────
function PriceSourceBadge({ source, size = "sm" }: { source: SourceType; size?: "sm" | "md" }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: size === "md" ? 5 : 4,
      padding: size === "md" ? "3px 10px" : "2px 8px",
      borderRadius: 99, background: cfg.bg, color: cfg.color,
      fontSize: size === "md" ? 12 : 11, fontWeight: 600, letterSpacing: 0.3,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Comparison row card ────────────────────────────────────────
function CompareRow({ deal, isBest }: { deal: Deal; isBest: boolean }) {
  const days = daysLeft(deal.expiresAt);
  return (
    <div style={{
      background: isBest ? "#f0fdf4" : "#fff",
      border: `2px solid ${isBest ? "#16a34a" : "#e5e7eb"}`,
      borderRadius: 14, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative",
    }}>
      {isBest && (
        <span style={{
          position: "absolute", top: -10, left: 14,
          background: "#16a34a", color: "#fff",
          fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99,
        }}>
          🏆 Best Price
        </span>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{deal.store}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{deal.branch}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>
            ${deal.salePrice.toFixed(2)}
            {deal.unit && <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>/{deal.unit}</span>}
          </div>
          {deal.regularPrice && (
            <div style={{ fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>
              ${deal.regularPrice.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Source + meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <PriceSourceBadge source={deal.source} />
        {days !== null && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
            background: days <= 2 ? "#fef2f2" : "#f0fdf4",
            color: days <= 2 ? "#dc2626" : "#15803d",
            border: `1px solid ${days <= 2 ? "#fca5a5" : "#86efac"}`,
          }}>
            ⏰ {days <= 0 ? "Today" : `${days}d left`}
          </span>
        )}
        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
          👍 {deal.upvotes} · {timeAgo(deal.verifiedAt)}
        </span>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function ComparePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const saved = await sharedGet("sm_deals_v5");
    setDeals(saved && saved.length ? saved : SEED_DEALS);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by item name
  const itemMap: Record<string, Deal[]> = {};
  deals.forEach(d => {
    if (!itemMap[d.item]) itemMap[d.item] = [];
    itemMap[d.item].push(d);
  });

  // Only show items with 2+ stores
  const compareItems = Object.entries(itemMap)
    .filter(([, list]) => list.length >= 2)
    .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const active = selectedItem
    ? compareItems.find(([n]) => n === selectedItem)
    : null;

  const sorted = active
    ? [...active[1]].sort((a, b) => a.salePrice - b.salePrice)
    : [];

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#fff", padding: "16px 16px 12px",
        borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>📊 Price Compare</div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search item to compare…"
          style={{
            width: "100%", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "9px 12px", fontSize: 14, background: "#f9fafb",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading…</div>}

      {!loading && !selectedItem && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
            {compareItems.length} items available for comparison
          </div>
          {compareItems.map(([name, list]) => {
            const prices = list.map(d => d.salePrice).sort((a, b) => a - b);
            const diff = prices[prices.length - 1] - prices[0];
            return (
              <button key={name} onClick={() => setSelectedItem(name)} style={{
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 14, padding: "14px 16px",
                cursor: "pointer", textAlign: "left", display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {list.length} stores · ${prices[0].toFixed(2)} – ${prices[prices.length - 1].toFixed(2)}
                  </div>
                  {/* Source icons for this item */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {[...new Set(list.map(d => d.source))].map(s => (
                      <PriceSourceBadge key={s} source={s} />
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    background: diff > 2 ? "#fef3c7" : "#dcfce7",
                    color: diff > 2 ? "#b45309" : "#15803d",
                    fontWeight: 700, fontSize: 12, padding: "4px 10px",
                    borderRadius: 99,
                  }}>
                    Save up to ${diff.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>›</div>
                </div>
              </button>
            );
          })}
          {compareItems.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              No items with multiple store prices yet.<br />Post deals to enable comparison!
            </div>
          )}
        </div>
      )}

      {!loading && selectedItem && active && (
        <div style={{ padding: 16 }}>
          {/* Back */}
          <button onClick={() => setSelectedItem(null)} style={{
            background: "none", border: "none", color: "#0369a1",
            fontWeight: 600, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 14,
          }}>
            ← Back to list
          </button>

          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{selectedItem}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            {sorted.length} stores compared
          </div>

          {/* Source legend */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 12, padding: "10px 14px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Price Source Legend</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.entries(SOURCE_CONFIG) as [SourceType, typeof SOURCE_CONFIG[SourceType]][]).map(([s, cfg]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 99,
                    background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${cfg.color}33`,
                  }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span style={{ fontSize: 11 }}>
                    {s === "receipt" ? "scanned receipt" : s === "flyer" ? "weekly ad/flyer" : "manually entered"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map((d, i) => (
              <CompareRow key={d.id} deal={d} isBest={i === 0} />
            ))}
          </div>

          {/* Savings summary */}
          {sorted.length >= 2 && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fcd34d",
              borderRadius: 12, padding: "12px 16px", marginTop: 14,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>💡 Savings Insight</div>
              <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>
                Buying at <strong>{sorted[0].store} {sorted[0].branch}</strong> saves you{" "}
                <strong>${(sorted[sorted.length - 1].salePrice - sorted[0].salePrice).toFixed(2)}</strong>{" "}
                vs the highest listed price.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
