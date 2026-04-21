"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { getFreshness, CAT_ICONS, STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";

const LEADERBOARD = [
  { name: "Priya K.", zip: "75074", saved: 124.50, level: "🏆 Hero" },
  { name: "Raj M.", zip: "75075", saved: 98.20, level: "⭐ Expert" },
  { name: "Anita S.", zip: "75074", saved: 76.80, level: "⭐ Expert" },
  { name: "Kumar P.", zip: "75013", saved: 54.30, level: "🎯 Hunter" },
  { name: "Deepa R.", zip: "75074", saved: 42.10, level: "🎯 Hunter" },
];

const NEARBY_STORES = [
  { name: "Patel Brothers", branch: "Plano", dist: "2.1 mi", deals: 8, color: "#4caf72" },
  { name: "India Bazaar", branch: "Richardson", dist: "3.4 mi", deals: 6, color: "#9b6fe8" },
  { name: "Apna Bazar", branch: "Carrollton", dist: "5.2 mi", deals: 5, color: "#e08918" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, cart, pantry } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiTip, setAiTip] = useState<string|null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  useEffect(() => { fetchTopDeals(); loadAiTip(); }, []);

  async function fetchTopDeals() {
    setLoading(true);
    const { data: dealRows } = await supabase.from("deals").select("id,sale_end,brand_id").eq("status","approved");
    if (!dealRows?.length) { setLoading(false); return; }
    const dealIds = dealRows.map((d:any) => d.id);
    const brandIds = [...new Set(dealRows.map((d:any) => d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
    const { data: items } = await supabase.from("deal_items")
      .select("id,deal_id,name,price,regular_price,unit,category,created_at,source")
      .in("deal_id", dealIds).order("created_at",{ascending:false}).limit(6);
    const brandMap: Record<string,any> = {};
    (brands||[]).forEach((b:any) => { brandMap[b.id] = b; });
    const dealMap: Record<string,any> = {};
    dealRows.forEach((d:any) => { dealMap[d.id] = d; });
    const merged = (items||[]).map((item:any) => ({ ...item, deal: dealMap[item.deal_id], brand: brandMap[dealMap[item.deal_id]?.brand_id] }));
    setDeals(merged);
    setLoading(false);
  }

  async function loadAiTip() {
    setTipLoading(true);
    // Static smart tips rotating daily
    const tips = [
      "Toor Dal prices typically drop mid-week. Best time to buy is Tuesday–Wednesday at Patel Brothers.",
      "Basmati Rice 20lb is 21% cheaper at Patel Brothers vs India Bazaar this week.",
      "Ghee prices are rising. Stock up now — India Bazaar has the lowest price at $11.49.",
      "Your pantry shows low Chakki Atta. Apna Bazar has it for $9.99 — expires in 3 days.",
      "You saved $6.60 more than last week. Keep comparing before every shop!",
    ];
    const tip = tips[new Date().getDay() % tips.length];
    setTimeout(() => { setAiTip(tip); setTipLoading(false); }, 800);
  }

  const lowStock = pantry.filter(p => p.qty <= 1);
  const cartCount = cart.filter(i => !i.purchased).length;
  const expiringToday = deals.filter(d => {
    if (!d.deal?.sale_end) return false;
    return Math.ceil((new Date(d.deal.sale_end).getTime() - Date.now()) / 86400000) <= 1;
  });
  const expiringSoon = deals.filter(d => {
    if (!d.deal?.sale_end) return false;
    const days = Math.ceil((new Date(d.deal.sale_end).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  });

  // Savings this month (demo)
  const savedThisMonth = 47.30;
  const savedLastMonth = 38.10;
  const savingsDiff = savedThisMonth - savedLastMonth;
  const savingsPct = Math.round((savedThisMonth / (savedThisMonth + 120)) * 100);

  const QUICK_ACTIONS = [
    { icon:"🏷️", label:"Deals", href:"/deals", color:"var(--gold)" },
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
            {getLevel(user?.points||0)} · ✦ {user?.points||0} pts · 📍 {user?.city||user?.zip||"Set location"}
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {[
            { label:"Cart Items", value:cartCount, icon:"🛒", color:"var(--gold)", href:"/cart" },
            { label:"Low Stock", value:lowStock.length, icon:"⚠️", color:"var(--red)", href:"/stock" },
            { label:"Expiring", value:expiringToday.length, icon:"⏰", color:"#e08918", href:"/deals" },
          ].map(s => (
            <div key={s.label} onClick={() => router.push(s.href)} className="card"
              style={{ padding:"12px 10px", textAlign:"center", cursor:"pointer" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 1 — Savings Meter */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:"16px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const }}>💰 Savings Meter</div>
              <div style={{ fontSize:26, fontWeight:900, color:"var(--teal)", marginTop:4 }}>{fmt(savedThisMonth)}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>saved this month</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, fontWeight:700, color:savingsDiff>=0?"var(--teal)":"var(--red)" }}>
                {savingsDiff>=0?"↑":"↓"} {fmt(Math.abs(savingsDiff))} vs last month
              </div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{fmt(savedLastMonth)} last month</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height:8, background:"var(--surf2)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${savingsPct}%`, borderRadius:4, background:"linear-gradient(90deg,var(--teal),#00A882)", transition:"width 1s ease" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ fontSize:10, color:"var(--text-dim)" }}>0</span>
            <span style={{ fontSize:10, color:"var(--teal)", fontWeight:700 }}>{savingsPct}% of monthly goal</span>
            <span style={{ fontSize:10, color:"var(--text-dim)" }}>{fmt(100)}</span>
          </div>
        </div>

        {/* 2 — Nearest Store */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const, marginBottom:10 }}>🗺️ Nearest Stores</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {NEARBY_STORES.map((s,i) => (
              <div key={s.name} onClick={() => router.push("/deals")}
                style={{ background:"var(--surf)", border:`1px solid ${i===0?"rgba(245,166,35,0.3)":"var(--border)"}`, borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:s.color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.branch} · {s.dist}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--gold)" }}>{s.deals} deals</div>
                  {i===0 && <div style={{ fontSize:9, color:"var(--teal)", fontWeight:700 }}>NEAREST</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 — AI Smart Tip */}
        <div style={{ background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.25)", borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--gold)", letterSpacing:1, textTransform:"uppercase" as const, marginBottom:8 }}>🤖 AI Smart Tip</div>
          {tipLoading
            ? <div style={{ fontSize:12, color:"var(--text-muted)" }}>Analyzing your shopping patterns...</div>
            : <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.6 }}>{aiTip}</div>
          }
          <button onClick={loadAiTip} style={{ background:"none", border:"none", fontSize:11, color:"var(--gold)", cursor:"pointer", fontWeight:700, marginTop:8, padding:0 }}>
            🔄 New tip
          </button>
        </div>

        {/* 4 — Deal Calendar */}
        {expiringSoon.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const }}>📅 Expiring Soon</div>
              <button onClick={()=>router.push("/deals")} style={{ background:"none", border:"none", fontSize:11, color:"var(--gold)", cursor:"pointer", fontWeight:700 }}>View All →</button>
            </div>
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
              {expiringSoon.map(item => {
                const days = Math.ceil((new Date(item.deal?.sale_end).getTime() - Date.now()) / 86400000);
                const color = days===0?"var(--red)":days<=2?"#e08918":"var(--gold)";
                return (
                  <div key={item.id} onClick={()=>router.push("/deals")}
                    style={{ background:"var(--surf)", border:`1px solid ${color}44`, borderRadius:12, padding:"12px", minWidth:130, flexShrink:0, cursor:"pointer" }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{CAT_ICONS[item.category]||"🛒"}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:4, lineHeight:1.3 }}>{item.name}</div>
                    <div style={{ fontSize:16, fontWeight:900, color:"var(--gold)" }}>${item.price?.toFixed(2)}</div>
                    <div style={{ fontSize:9, fontWeight:700, color, marginTop:4 }}>
                      ⏰ {days===0?"Last day!":days===1?"1 day left":`${days} days left`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 — Leaderboard */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const, marginBottom:10 }}>🏆 Top Savers Near You</div>
          <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
            {LEADERBOARD.map((p,i) => {
              const isMe = i === 2; // demo — highlight user
              return (
                <div key={p.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border)", background:isMe?"rgba(245,166,35,0.04)":"transparent" }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:i===0?"rgba(245,166,35,0.15)":i===1?"rgba(144,144,168,0.15)":i===2?"rgba(224,137,24,0.15)":"var(--surf2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:i===0?"var(--gold)":i===1?"var(--text-muted)":"#e08918", flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", display:"flex", alignItems:"center", gap:6 }}>
                      {isMe ? `${user?.name||p.name} (You)` : p.name}
                      {isMe && <span style={{ fontSize:9, background:"rgba(245,166,35,0.12)", color:"var(--gold)", border:"1px solid rgba(245,166,35,0.3)", borderRadius:20, padding:"1px 6px", fontWeight:700 }}>YOU</span>}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-muted)" }}>{p.level} · {p.zip}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:900, color:"var(--teal)" }}>{fmt(p.saved)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const, marginBottom:10 }}>Quick Actions</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.href} onClick={()=>router.push(a.href)}
              style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer" }}>
              <span style={{ fontSize:24 }}>{a.icon}</span>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)" }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Latest Deals */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" as const }}>🔥 Latest Deals</div>
          <button onClick={()=>router.push("/deals")} style={{ background:"none", border:"none", fontSize:11, color:"var(--gold)", cursor:"pointer", fontWeight:700 }}>View All →</button>
        </div>
        {loading && <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)", fontSize:13 }}>Loading...</div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
          {deals.map(item => {
            const color = STORE_COLORS[item.brand?.slug]||"var(--gold)";
            const fresh = getFreshness(item.created_at);
            const sav = item.regular_price ? Math.round((1-item.price/item.regular_price)*100) : null;
            return (
              <div key={item.id} className="card" style={{ overflow:"hidden", cursor:"pointer" }} onClick={()=>router.push("/deals")}>
                <div style={{ height:3, background:color }} />
                <div style={{ padding:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:8, color:"var(--text-dim)", fontWeight:700, textTransform:"uppercase" as const }}>{item.category}</span>
                    {sav && <span className="pill pill-teal" style={{ fontSize:8 }}>-{sav}%</span>}
                  </div>
                  <div style={{ fontSize:20, marginBottom:4 }}>{CAT_ICONS[item.category]||"🛒"}</div>
                  <div style={{ fontSize:11, fontWeight:700, marginBottom:3, lineHeight:1.3, color:"var(--text)" }}>{item.name}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:"var(--gold)" }}>${item.price?.toFixed(2)}<span style={{ fontSize:9, color:"var(--text-dim)", fontWeight:400 }}>/{item.unit||"ea"}</span></div>
                  <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:4 }}>
                    <span style={{ borderRadius:20, padding:"1px 6px", fontSize:8, fontWeight:700, background:`${color}18`, color, border:`1px solid ${color}44` }}>{item.brand?.name}</span>
                    <span className={`pill fresh-${fresh.level}`} style={{ fontSize:8 }}>{fresh.label}</span>
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
