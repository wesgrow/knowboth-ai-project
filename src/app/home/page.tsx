"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { getFreshness, CAT_ICONS, STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const { user, cart, pantry } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  useEffect(() => { fetchTopDeals(); }, []);

  async function fetchTopDeals() {
    setLoading(true);
    const { data: dealRows } = await supabase.from("deals").select("id,sale_end,brand_id").eq("status","approved");
    if (!dealRows?.length) { setLoading(false); return; }
    const dealIds = dealRows.map((d:any) => d.id);
    const brandIds = [...new Set(dealRows.map((d:any) => d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
    const { data: items } = await supabase.from("deal_items")
      .select("id,deal_id,name,price,regular_price,unit,category,created_at,source")
      .in("deal_id", dealIds).order("created_at", { ascending: false }).limit(6);
    const brandMap: Record<string,any> = {};
    (brands||[]).forEach((b:any) => { brandMap[b.id] = b; });
    const dealMap: Record<string,any> = {};
    dealRows.forEach((d:any) => { dealMap[d.id] = d; });
    const merged = (items||[]).map((item:any) => ({ ...item, deal: dealMap[item.deal_id], brand: brandMap[dealMap[item.deal_id]?.brand_id] }));
    setDeals(merged);
    setLoading(false);
  }

  const lowStock = pantry.filter(p => p.qty <= 1);
  const cartCount = cart.filter(i => !i.purchased).length;
  const expiringDeals = deals.filter(d => {
    if (!d.deal?.sale_end) return false;
    const days = Math.ceil((new Date(d.deal.sale_end).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 2;
  });

  const QUICK_ACTIONS = [
    { icon:"🏷️", label:"Browse Deals", href:"/deals", color:"var(--gold)" },
    { icon:"⚖️", label:"Compare", href:"/compare", color:"#9b6fe8" },
    { icon:"🧾", label:"Scan Bill", href:"/scan", color:"var(--teal)" },
    { icon:"🛒", label:`Cart (${cartCount})`, href:"/cart", color:"#e08918" },
    { icon:"📦", label:"Stock", href:"/stock", color:"#5b9dee" },
    { icon:"📊", label:"Expenses", href:"/expenses", color:"#e05c6e" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">

        {/* Welcome */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:22, fontWeight:900, color:"var(--text)" }}>
            Hi {user?.name?.split(" ")[0]} {user?.avatar} 👋
          </div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>
            {getLevel(user?.points||0)} · ✦ {user?.points||0} points · 📍 {user?.city||user?.zip||"Set location"}
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {[
            { label:"Cart Items", value:cartCount, icon:"🛒", color:"var(--gold)", href:"/cart" },
            { label:"Low Stock", value:lowStock.length, icon:"⚠️", color:"var(--red)", href:"/stock" },
            { label:"Expiring", value:expiringDeals.length, icon:"⏰", color:"#e08918", href:"/deals" },
          ].map(s => (
            <div key={s.label} onClick={() => router.push(s.href)}
              style={{ background:"var(--surf)", border:`1px solid var(--border)`, borderRadius:12, padding:"12px 10px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }}
              className="card">
              <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const, marginBottom:10 }}>Quick Actions</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.href} onClick={() => router.push(a.href)}
              style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer", transition:"all 0.2s" }}>
              <span style={{ fontSize:24 }}>{a.icon}</span>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)" }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const }}>⚠️ Low Stock</div>
              <button onClick={() => router.push("/stock")} style={{ background:"none", border:"none", fontSize:11, color:"var(--gold)", cursor:"pointer", fontWeight:700 }}>View All →</button>
            </div>
            <div style={{ background:"var(--surf)", border:"1px solid rgba(255,71,87,0.25)", borderRadius:12, overflow:"hidden", marginBottom:20 }}>
              {lowStock.slice(0,3).map(item => (
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:20 }}>{CAT_ICONS[item.category]||"🛒"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{item.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>{item.store}</div>
                  </div>
                  <span style={{ background:"rgba(255,71,87,0.1)", color:"var(--red)", border:"1px solid rgba(255,71,87,0.3)", borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:700 }}>
                    {item.qty} left
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Latest Deals */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const }}>🔥 Latest Deals</div>
          <button onClick={() => router.push("/deals")} style={{ background:"none", border:"none", fontSize:11, color:"var(--gold)", cursor:"pointer", fontWeight:700 }}>View All →</button>
        </div>

        {loading && <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)", fontSize:13 }}>Loading deals...</div>}

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
          {deals.map(item => {
            const color = STORE_COLORS[item.brand?.slug]||"var(--gold)";
            const fresh = getFreshness(item.created_at);
            const sav = item.regular_price ? Math.round((1-item.price/item.regular_price)*100) : null;
            return (
              <div key={item.id} className="card" style={{ overflow:"hidden", cursor:"pointer" }} onClick={() => router.push("/deals")}>
                <div style={{ height:3, background:color }} />
                <div style={{ padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:9, color:"var(--text-dim)", fontWeight:700, textTransform:"uppercase" as const }}>{item.category}</span>
                    {sav && <span className="pill pill-teal" style={{ fontSize:9 }}>-{sav}%</span>}
                  </div>
                  <div style={{ fontSize:22, marginBottom:4 }}>{CAT_ICONS[item.category]||"🛒"}</div>
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:4, lineHeight:1.3, color:"var(--text)" }}>{item.name}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:"var(--gold)", marginBottom:4 }}>${item.price?.toFixed(2)}<span style={{ fontSize:10, color:"var(--text-dim)", fontWeight:400 }}>/{item.unit||"ea"}</span></div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    <span style={{ borderRadius:20, padding:"2px 6px", fontSize:9, fontWeight:700, background:`${color}18`, color, border:`1px solid ${color}44` }}>{item.brand?.name}</span>
                    <span className={`pill fresh-${fresh.level}`} style={{ fontSize:9 }}>{fresh.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
