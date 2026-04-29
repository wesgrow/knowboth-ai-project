"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { getFreshness, STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

const CATS = ["All","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household"];
const SORTS = [{v:"newest",l:"Newest"},{v:"price_asc",l:"Price ↑"},{v:"savings",l:"Savings"},{v:"expiring",l:"Expiring"}];
const PRICE_ORDER = ["Under $1","$1 – $3","$3 – $10","$10 – $25","Over $25"];
type View = "list"|"table"|"cards";
type GroupBy = "category"|"store"|"price";

function DealsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [search, setSearch] = useState(params.get("q") || "");
  const [cat, setCat] = useState("All");
  const [storeFilter, setStoreFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [maxPrice, setMaxPrice] = useState(50);
  const [onSale, setOnSale] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [freshToday, setFreshToday] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [stores, setStores] = useState<string[]>([]);
  const [phItems, setPhItems] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { addToCart, cart } = useAppStore();

  useEffect(() => { fetchDeals(); }, []);

  // Search price_history when user types — debounced, server-side
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setPhItems([]); return; }
    const normalized = q.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");
    const timer = setTimeout(async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("price_history")
        .select("id,item_name,normalized_name,store_name,store_city,price,unit,source,recorded_at")
        .ilike("normalized_name", `%${normalized}%`)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(100);
      setPhItems((data || []).map((p: any) => ({
        id: `ph-${p.id}`,
        name: p.item_name,
        normalized_name: p.normalized_name,
        price: p.price,
        regular_price: null,
        unit: p.unit || "ea",
        category: "Community",
        savings_pct: null,
        source: p.source || "receipt",
        created_at: p.recorded_at,
        deal: null,
        brand: { name: p.store_name, slug: "" },
        from_price_history: true,
        store_city: p.store_city,
      })));
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function fetchDeals() {
    setLoading(true);
    const { data: dealRows } = await supabase.from("deals").select("id,sale_end,brand_id").eq("status", "approved");
    if (!dealRows?.length) { setItems([]); setLoading(false); return; }
    const dealIds = dealRows.map((d: any) => d.id);
    const brandIds = [...new Set(dealRows.map((d: any) => d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
    const { data: dealItems } = await supabase.from("deal_items")
      .select("id,deal_id,name,normalized_name,price,regular_price,unit,category,savings_pct,created_at,source")
      .in("deal_id", dealIds).order("created_at", { ascending: false });
    if (!dealItems) { setLoading(false); return; }
    const bMap: Record<string, any> = {}; (brands || []).forEach((b: any) => { bMap[b.id] = b; });
    const dMap: Record<string, any> = {}; dealRows.forEach((d: any) => { dMap[d.id] = d; });
    const merged = dealItems.map((i: any) => ({ ...i, deal: dMap[i.deal_id], brand: bMap[dMap[i.deal_id]?.brand_id] }));
    setItems(merged);
    setStores([...new Set(merged.map((i: any) => i.brand?.name).filter(Boolean))] as string[]);
    setLoading(false);
  }

  function dL(s: string | null) { if (!s) return null; return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000); }
  function src(s: string | null, fromPH?: boolean) { return fromPH ? "🧾 Community" : s === "receipt" ? "🧾 Receipt" : s === "flyer" ? "📄 Flyer" : "✏️ Manual"; }
  function ago(ts: string) { const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; }

  const aF = [cat !== "All" && { l: cat, c: () => setCat("All") }, storeFilter !== "All" && { l: storeFilter, c: () => setStoreFilter("All") }, onSale && { l: "On Sale", c: () => setOnSale(false) }, expiringSoon && { l: "Expiring", c: () => setExpiringSoon(false) }, freshToday && { l: "Fresh", c: () => setFreshToday(false) }, maxPrice < 50 && { l: `<$${maxPrice}`, c: () => setMaxPrice(50) }].filter(Boolean) as { l: string; c: () => void }[];
  function clrAll() { setCat("All"); setStoreFilter("All"); setOnSale(false); setExpiringSoon(false); setFreshToday(false); setMaxPrice(50); }

  const filtered = [...items, ...phItems].filter(item => {
    const q = search.toLowerCase();
    const dl = dL(item.deal?.sale_end);
    const fr = getFreshness(item.created_at);
    if (q && !item.name?.toLowerCase().includes(q)) return false;
    if (cat !== "All" && item.category !== cat) return false;
    if (storeFilter !== "All" && item.brand?.name !== storeFilter) return false;
    if (dl !== null && dl < 0) return false;
    if (onSale && !item.regular_price) return false;
    if (expiringSoon && (dl === null || dl > 3)) return false;
    if (freshToday && fr.level > 1) return false;
    if (item.price > maxPrice) return false;
    return true;
  }).sort((a, b) => {
    // posted deals always before community prices
    if (a.from_price_history !== b.from_price_history) return a.from_price_history ? 1 : -1;
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "savings") return (b.savings_pct || 0) - (a.savings_pct || 0);
    if (sort === "expiring") return (dL(a.deal?.sale_end) || 999) - (dL(b.deal?.sale_end) || 999);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  function priceRange(p: number) {
    if (p < 1) return "Under $1";
    if (p < 3) return "$1 – $3";
    if (p < 10) return "$3 – $10";
    if (p < 25) return "$10 – $25";
    return "Over $25";
  }
  function groupKey(item: any) {
    if (groupBy === "store") return item.brand?.name || "Unknown Store";
    if (groupBy === "price") return priceRange(item.price || 0);
    return item.category || "Other";
  }

  // Group posted deals by chosen dimension → item
  const groupedRaw: Record<string, Record<string, any[]>> = {};
  filtered.filter(i => !i.from_price_history).forEach(item => {
    const gk = groupKey(item);
    const ik = item.normalized_name || item.name?.toLowerCase() || "";
    if (!groupedRaw[gk]) groupedRaw[gk] = {};
    if (!groupedRaw[gk][ik]) groupedRaw[gk][ik] = [];
    groupedRaw[gk][ik].push(item);
  });
  Object.values(groupedRaw).forEach(cg => { Object.values(cg).forEach(arr => arr.sort((a, b) => a.price - b.price)); });

  // Sort group keys: price ranges use fixed order, others alphabetical
  const sortedGroupKeys = Object.keys(groupedRaw).sort((a, b) =>
    groupBy === "price"
      ? PRICE_ORDER.indexOf(a) - PRICE_ORDER.indexOf(b)
      : a.localeCompare(b)
  );
  const grouped = Object.fromEntries(sortedGroupKeys.map(k => [k, groupedRaw[k]]));

  // Group community prices by item name (flat, no category split)
  const communityGrouped: Record<string, any[]> = {};
  filtered.filter(i => i.from_price_history).forEach(item => {
    const key = item.normalized_name || item.name?.toLowerCase() || "";
    if (!communityGrouped[key]) communityGrouped[key] = [];
    communityGrouped[key].push(item);
  });
  Object.values(communityGrouped).forEach(arr => arr.sort((a, b) => a.price - b.price));

  function toggleExpand(key: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function addItem(item: any) {
    if (cart.find(i => i.id === item.id)) { toast("Already in cart"); return; }
    addToCart({ id: item.id, name: item.name, price: item.price, unit: item.unit || "ea", store: item.brand?.name || "", store_slug: item.brand?.slug || "", category: item.category || "Other", icon: "🛒" });
    toast.success(`✦ ${item.name} added from ${item.brand?.name}`);
  }

  const S = { padding: "10px 14px", fontSize: 13, fontWeight: 600 as const, color: "#1C1C1E", borderBottom: "0.5px solid #F2F2F7", verticalAlign: "middle" as const };
  const TH = { padding: "9px 14px", fontSize: 11, fontWeight: 600 as const, color: "#AEAEB2", textAlign: "left" as const, letterSpacing: 0.3, textTransform: "uppercase" as const, background: "#F9F9F9", borderBottom: "0.5px solid #F2F2F7", whiteSpace: "nowrap" as const };
  return (
    <div style={{ minHeight: "100vh", background: "#F2F2F7" }} className="page-body">
      <div className="container">

        {/* Search */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#AEAEB2", fontSize: 15 }}>🔍</span>
              <input style={{ width: "100%", background: "#fff", border: "none", borderRadius: 12, padding: "12px 16px 12px 42px", fontSize: 15, color: "#1C1C1E", outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals, items, stores..." />
            </div>

            {/* Toolbar — single row on desktop, wraps on mobile */}
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom: aF.length>0 ? 6 : 10, flexWrap:"wrap" as const }}>

              {/* Left: Filter + divider + Group by */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const }}>
                <button onClick={() => setShowPanel(!showPanel)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background: showPanel||aF.length>0 ? "#FF9F0A" : "#fff", color: showPanel||aF.length>0 ? "#fff" : "#6D6D72", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", whiteSpace:"nowrap" as const, flexShrink:0 }}>
                  ⚙️ {aF.length > 0 ? `${aF.length} Active` : "Filter"}
                </button>
                <div style={{ width:1, height:18, background:"#E5E5EA", flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"#AEAEB2", fontWeight:600, flexShrink:0 }}>Group by</span>
                {([["category","📂 Category"],["store","🏪 Store"],["price","💰 Price"]] as const).map(([v,l]) => (
                  <button key={v} onClick={() => setGroupBy(v)}
                    style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, border:"none", cursor:"pointer", flexShrink:0,
                      background: groupBy===v ? "#FF9F0A" : "#fff",
                      color: groupBy===v ? "#fff" : "#6D6D72",
                      boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Spacer */}
              <div style={{ flex:1 }}/>

              {/* Right: count + view + sort + post */}
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0, flexWrap:"wrap" as const }}>
                <span style={{ fontSize:11, color:"#AEAEB2", fontWeight:500 }}>
                  {filtered.filter(i=>!i.from_price_history).length} deal{filtered.filter(i=>!i.from_price_history).length!==1?"s":""}
                  {phItems.length>0 && ` · ${filtered.filter(i=>i.from_price_history).length} community`}
                </span>
                <div style={{ width:1, height:18, background:"#E5E5EA" }}/>
                <div style={{ display:"flex", background:"#fff", borderRadius:10, padding:2, gap:1, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  {([["list","≡"],["table","⊞"],["cards","▦"]] as const).map(([v,icon]) => (
                    <button key={v} onClick={() => setView(v)}
                      style={{ width:32, height:30, borderRadius:8, border:"none", cursor:"pointer", fontSize:14, background: view===v ? "#F2F2F7" : "transparent", color: view===v ? "#1C1C1E" : "#AEAEB2", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {icon}
                    </button>
                  ))}
                </div>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  style={{ background:"#fff", border:"none", borderRadius:10, padding:"7px 10px", fontSize:12, fontWeight:600, color:"#6D6D72", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  {SORTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
                <button onClick={() => router.push("/post-deal")}
                  style={{ background:"linear-gradient(135deg,#FF9F0A,#D4800A)", color:"#fff", border:"none", borderRadius:10, padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" as const, boxShadow:"0 2px 6px rgba(255,159,10,0.3)" }}>
                  📷 Post Deal
                </button>
              </div>
            </div>

            {/* Active filter chips — only shown when filters are active */}
            {aF.length > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const, marginBottom:10 }}>
                {aF.map((f,i) => (
                  <button key={i} onClick={f.c}
                    style={{ display:"flex", alignItems:"center", gap:3, padding:"5px 10px", borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:"nowrap" as const, cursor:"pointer", border:"none", background:"rgba(255,159,10,0.12)", color:"#FF9F0A" }}>
                    {f.l} ✕
                  </button>
                ))}
              </div>
            )}

            {/* Filter Panel */}
            {showPanel && (
              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #F2F2F7" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 8 }}>Category</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>{CATS.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: cat === c ? "#FF9F0A" : "#F2F2F7", color: cat === c ? "#fff" : "#1C1C1E" }}>{c}</button>)}</div>
                </div>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #F2F2F7" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 8 }}>Store</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>{["All", ...stores].map(s => <button key={s} onClick={() => setStoreFilter(s)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: storeFilter === s ? "#FF9F0A" : "#F2F2F7", color: storeFilter === s ? "#fff" : "#1C1C1E" }}>{s}</button>)}</div>
                </div>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #F2F2F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Price Range</span><span style={{ fontSize: 12, fontWeight: 600, color: "#FF9F0A" }}>Under ${maxPrice}{maxPrice === 50 ? "+" : " "}</span></div>
                  <input type="range" min="1" max="50" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} style={{ width: "100%", accentColor: "#FF9F0A", cursor: "pointer" }} />
                </div>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #F2F2F7" }}>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                    {[{ l: "🔥 On Sale", v: onSale, s: setOnSale }, { l: "⏰ Expiring Soon", v: expiringSoon, s: setExpiringSoon }, { l: "🌿 Fresh Today", v: freshToday, s: setFreshToday }].map(t => (
                      <div key={t.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#1C1C1E" }}>{t.l}</span>
                        <div onClick={() => t.s(!t.v)} style={{ width: 44, height: 26, borderRadius: 13, cursor: "pointer", position: "relative", background: t.v ? "#FF9F0A" : "#E5E5EA", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: t.v ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
                  <button onClick={clrAll} style={{ flex: 1, padding: "11px", background: "#F2F2F7", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#6D6D72", cursor: "pointer" }}>Clear All</button>
                  <button onClick={() => setShowPanel(false)} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg,#FF9F0A,#D4800A)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Show {filtered.length} →</button>
                </div>
              </div>
            )}

            {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#AEAEB2" }}>Loading deals...</div>}
            {!loading && items.length === 0 && phItems.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🏷️</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1E", marginBottom: 6 }}>No deals yet</div>
                <div style={{ fontSize: 13, color: "#AEAEB2", marginBottom: 16 }}>Post a flyer deal or scan a bill and share prices with the community</div>
                <button onClick={() => router.push("/post-deal")} style={{ background: "linear-gradient(135deg,#FF9F0A,#D4800A)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>📷 Post First Deal</button>
              </div>
            )}
            {!loading && filtered.length === 0 && (items.length > 0 || phItems.length > 0) && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>No matches</div>
                <button onClick={clrAll} style={{ background: "none", border: "none", color: "#FF9F0A", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Clear filters</button>
              </div>
            )}

            {/* ── LIST VIEW — Grouped by item with expandable stores ── */}
            {view === "list" && Object.entries(grouped).map(([category, itemGroups]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 6, paddingLeft: 2 }}>{category}</div>
                <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  {Object.entries(itemGroups).map(([itemKey, storeItems], idx, arr) => {
                    const cheapestItem = storeItems[0];
                    const otherStores = storeItems.slice(1);
                    const isExpanded = expandedItems.has(itemKey);
                    const inCart = !!cart.find(i => i.id === cheapestItem.id);
                    const sav = cheapestItem.regular_price ? Math.round((1 - cheapestItem.price / cheapestItem.regular_price) * 100) : null;
                    const fr = getFreshness(cheapestItem.created_at);
                    const color = STORE_COLORS[cheapestItem.brand?.slug] || "#FF9F0A";
                    const dl = dL(cheapestItem.deal?.sale_end);

                    return (
                      <div key={itemKey} style={{ borderBottom: idx < arr.length - 1 ? "0.5px solid #F2F2F7" : "none" }}>
                        {/* Cheapest store row — always visible */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
                          <div style={{ width: 3, height: 40, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cheapestItem.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, flexWrap: "wrap" as const }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#FF9F0A" }}>🏆 {cheapestItem.brand?.name}</span>
                              <span className={`pill fresh-${fr.level}`} style={{ fontSize: 9, padding: "1px 6px" }}>{fr.label}</span>
                              {sav && <span style={{ fontSize: 9, fontWeight: 600, color: "#30D158" }}>-{sav}%</span>}
                              {dl !== null && dl <= 3 && <span style={{ fontSize: 9, fontWeight: 600, color: "#FF3B30" }}>⏰{dl === 0 ? "Last day" : `${dl}d`}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: "#C8C8CC", marginTop: 2 }}>{src(cheapestItem.source, cheapestItem.from_price_history)} · {ago(cheapestItem.created_at)} ago{cheapestItem.store_city ? ` · ${cheapestItem.store_city}` : ""}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: "#FF9F0A" }}>${cheapestItem.price?.toFixed(2)}</div>
                            {cheapestItem.regular_price && <div style={{ fontSize: 10, color: "#AEAEB2", textDecoration: "line-through" }}>${cheapestItem.regular_price?.toFixed(2)}</div>}
                            <div style={{ fontSize: 10, color: "#AEAEB2" }}>/{cheapestItem.unit || "ea"}</div>
                          </div>
                          <button onClick={() => addItem(cheapestItem)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", flexShrink: 0, background: inCart ? "#F2F2F7" : "#FF9F0A", color: inCart ? "#AEAEB2" : "#fff" }}>
                            {inCart ? "✓" : "+ Add"}
                          </button>
                        </div>

                        {/* Expand button if other stores exist */}
                        {otherStores.length > 0 && (
                          <button onClick={() => toggleExpand(itemKey)} style={{ width: "100%", background: isExpanded ? "rgba(255,159,10,0.04)" : "#FAFAFA", border: "none", borderTop: "0.5px solid #F2F2F7", padding: "8px 16px", fontSize: 12, fontWeight: 600, color: "#6D6D72", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>{isExpanded ? "Hide" : `▼ Also at ${otherStores.length} more store${otherStores.length > 1 ? "s" : ""}`}</span>
                            <span style={{ fontSize: 11 }}>
                              {!isExpanded && otherStores.map(s => `${s.brand?.name} $${s.price?.toFixed(2)}`).join(" · ")}
                              {isExpanded && "▲ Collapse"}
                            </span>
                          </button>
                        )}

                        {/* Expanded other stores */}
                        {isExpanded && otherStores.map((store, si) => {
                          const storeInCart = !!cart.find(i => i.id === store.id);
                          const storeColor = STORE_COLORS[store.brand?.slug] || "#6D6D72";
                          const diff = (store.price - cheapestItem.price).toFixed(2);
                          return (
                            <div key={store.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 10px 32px", background: "#F9F9F9", borderTop: "0.5px solid #F2F2F7" }}>
                              <div style={{ width: 3, height: 32, borderRadius: 2, background: storeColor, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#6D6D72" }}>{store.brand?.name}</div>
                                <div style={{ fontSize: 10, color: "#AEAEB2" }}>{src(store.source, store.from_price_history)} · {ago(store.created_at)} ago</div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }}>${store.price?.toFixed(2)}</div>
                                <div style={{ fontSize: 10, color: "#FF3B30", fontWeight: 600 }}>+${diff} more</div>
                              </div>
                              <button onClick={() => addItem(store)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", flexShrink: 0, background: storeInCart ? "#F2F2F7" : "#F2F2F7", color: storeInCart ? "#AEAEB2" : "#1C1C1E", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                                {storeInCart ? "✓" : "+ Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ── COMMUNITY PRICES (list view, shown when searching) ── */}
            {view === "list" && Object.keys(communityGrouped).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 2 }}>
                  <div style={{ height: 1, flex: 1, background: "#F2F2F7" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5 }}>🧾 COMMUNITY PRICES FROM SCANNED BILLS</span>
                  <div style={{ height: 1, flex: 1, background: "#F2F2F7" }} />
                </div>
                <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  {Object.entries(communityGrouped).map(([itemKey, storeItems], idx, arr) => {
                    const cheapest = storeItems[0];
                    const others = storeItems.slice(1);
                    const isExpanded = expandedItems.has(`ph-${itemKey}`);
                    const inCart = !!cart.find(i => i.id === cheapest.id);
                    return (
                      <div key={itemKey} style={{ borderBottom: idx < arr.length - 1 ? "0.5px solid #F2F2F7" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
                          <div style={{ width: 3, height: 40, borderRadius: 2, background: "#30D158", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cheapest.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, flexWrap: "wrap" as const }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#6D6D72" }}>{cheapest.brand?.name}</span>
                              {cheapest.store_city && <span style={{ fontSize: 11, color: "#AEAEB2" }}>· {cheapest.store_city}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: "#C8C8CC", marginTop: 2 }}>🧾 Community · {ago(cheapest.created_at)} ago</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: "#FF9F0A" }}>${cheapest.price?.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: "#AEAEB2" }}>/{cheapest.unit || "ea"}</div>
                          </div>
                          <button onClick={() => addItem(cheapest)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", flexShrink: 0, background: inCart ? "#F2F2F7" : "#FF9F0A", color: inCart ? "#AEAEB2" : "#fff" }}>
                            {inCart ? "✓" : "+ Add"}
                          </button>
                        </div>
                        {others.length > 0 && (
                          <button onClick={() => toggleExpand(`ph-${itemKey}`)} style={{ width: "100%", background: isExpanded ? "rgba(48,209,88,0.04)" : "#FAFAFA", border: "none", borderTop: "0.5px solid #F2F2F7", padding: "8px 16px", fontSize: 12, fontWeight: 600, color: "#6D6D72", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>{isExpanded ? "Hide" : `▼ Also at ${others.length} more store${others.length > 1 ? "s" : ""}`}</span>
                            <span style={{ fontSize: 11 }}>{!isExpanded && others.map(s => `${s.brand?.name} $${s.price?.toFixed(2)}`).join(" · ")}{isExpanded && "▲ Collapse"}</span>
                          </button>
                        )}
                        {isExpanded && others.map((store, si) => {
                          const storeInCart = !!cart.find(i => i.id === store.id);
                          const diff = (store.price - cheapest.price).toFixed(2);
                          return (
                            <div key={store.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 10px 32px", background: "#F9F9F9", borderTop: "0.5px solid #F2F2F7" }}>
                              <div style={{ width: 3, height: 32, borderRadius: 2, background: "#30D158", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#6D6D72" }}>{store.brand?.name}{store.store_city ? ` · ${store.store_city}` : ""}</div>
                                <div style={{ fontSize: 10, color: "#AEAEB2" }}>🧾 Community · {ago(store.created_at)} ago</div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }}>${store.price?.toFixed(2)}</div>
                                <div style={{ fontSize: 10, color: "#FF3B30", fontWeight: 600 }}>+${diff} more</div>
                              </div>
                              <button onClick={() => addItem(store)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", flexShrink: 0, background: "#F2F2F7", color: storeInCart ? "#AEAEB2" : "#1C1C1E", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                                {storeInCart ? "✓" : "+ Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TABLE VIEW ── */}
            {view === "table" && Object.entries(grouped).map(([category, itemGroups]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 6, paddingLeft: 2 }}>{category}</div>
                <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr><th style={TH}>Item</th><th style={TH}>Store</th><th style={{ ...TH, textAlign: "right" as const }}>Price</th><th style={{ ...TH, textAlign: "right" as const }}>Was</th><th style={TH}>Save</th><th style={TH}>Source</th><th style={TH}>Stores</th><th style={TH}></th></tr></thead>
                      <tbody>
                        {Object.entries(itemGroups).map(([itemKey, storeItems]) => {
                          const cheapestItem = storeItems[0];
                          const inCart = !!cart.find(i => i.id === cheapestItem.id);
                          const sav = cheapestItem.regular_price ? Math.round((1 - cheapestItem.price / cheapestItem.regular_price) * 100) : null;
                          const color = STORE_COLORS[cheapestItem.brand?.slug] || "#FF9F0A";
                          return (
                            <tr key={itemKey} style={{ background: "#fff" }}>
                              <td style={{ ...S, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{cheapestItem.name}</td>
                              <td style={S}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", marginRight: 6, verticalAlign: "middle" }} /><span style={{ fontWeight: 700, color: "#FF9F0A" }}>🏆 {cheapestItem.brand?.name}</span></td>
                              <td style={{ ...S, textAlign: "right" as const }}><span style={{ fontSize: 15, fontWeight: 700, color: "#FF9F0A" }}>${cheapestItem.price?.toFixed(2)}</span></td>
                              <td style={{ ...S, textAlign: "right" as const }}>{cheapestItem.regular_price ? <span style={{ fontSize: 11, color: "#AEAEB2", textDecoration: "line-through" }}>${cheapestItem.regular_price?.toFixed(2)}</span> : <span style={{ color: "#AEAEB2" }}>—</span>}</td>
                              <td style={S}>{sav ? <span style={{ fontSize: 10, fontWeight: 600, color: "#30D158", background: "rgba(48,209,88,0.1)", borderRadius: 20, padding: "2px 8px" }}>-{sav}%</span> : <span style={{ color: "#AEAEB2" }}>—</span>}</td>
                              <td style={{ ...S, fontSize: 11, color: "#AEAEB2" }}>{src(cheapestItem.source, cheapestItem.from_price_history)}</td>
                              <td style={S}>{storeItems.length > 1 ? <span style={{ fontSize: 10, fontWeight: 600, color: "#6D6D72", background: "#F2F2F7", borderRadius: 20, padding: "2px 8px" }}>{storeItems.length} stores</span> : <span style={{ color: "#AEAEB2", fontSize: 11 }}>1 store</span>}</td>
                              <td style={S}><button onClick={() => addItem(cheapestItem)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: inCart ? "#F2F2F7" : "#FF9F0A", color: inCart ? "#AEAEB2" : "#fff", whiteSpace: "nowrap" as const }}>{inCart ? "✓" : "+ Add"}</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}

            {/* ── CARDS VIEW ── */}
            {view === "cards" && Object.entries(grouped).map(([category, itemGroups]) => (
              <div key={category} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#AEAEB2", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 8, paddingLeft: 2 }}>{category}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
                  {Object.entries(itemGroups).map(([itemKey, storeItems]) => {
                    const cheapestItem = storeItems[0];
                    const color = STORE_COLORS[cheapestItem.brand?.slug] || "#FF9F0A";
                    const inCart = !!cart.find(i => i.id === cheapestItem.id);
                    const sav = cheapestItem.regular_price ? Math.round((1 - cheapestItem.price / cheapestItem.regular_price) * 100) : null;
                    return (
                      <div key={itemKey} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column" as const }}>
                        <div style={{ height: 4, background: color }} />
                        <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column" as const }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 600, textTransform: "uppercase" as const }}>{cheapestItem.category}</span>
                            {sav && <span style={{ fontSize: 10, fontWeight: 700, color: "#30D158", background: "rgba(48,209,88,0.1)", borderRadius: 20, padding: "1px 7px" }}>-{sav}%</span>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1E", lineHeight: 1.3, marginBottom: "auto", minHeight: 36 }}>{cheapestItem.name}</div>
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#FF9F0A" }}>${cheapestItem.price?.toFixed(2)}<span style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 400 }}>/{cheapestItem.unit || "ea"}</span></div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#FF9F0A", marginTop: 2 }}>🏆 {cheapestItem.brand?.name}</div>
                            {storeItems.length > 1 && <div style={{ fontSize: 10, color: "#6D6D72", marginTop: 2 }}>+{storeItems.length - 1} more store{storeItems.length > 2 ? "s" : ""}</div>}
                            <div style={{ fontSize: 10, color: "#C8C8CC", marginTop: 2, marginBottom: 8 }}>{src(cheapestItem.source, cheapestItem.from_price_history)}</div>
                            <button onClick={() => addItem(cheapestItem)} style={{ width: "100%", padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: inCart ? "#F2F2F7" : "#FF9F0A", color: inCart ? "#AEAEB2" : "#fff" }}>
                              {inCart ? "✓ Added" : "+ Add Best Price"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF9F0A" }}>Loading...</div>}>
      <DealsContent />
    </Suspense>
  );
}
