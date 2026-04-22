"use client";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { CAT_ICONS, formatCurrency } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SPENDING_DATA = [42,65,38,71,55,88,62,74,91,68,53,85];
const SAVINGS_DATA  = [8,14,6,18,11,22,15,19,24,17,10,21];
const CATEGORY_DATA = [
  { cat:"Grocery",    amount:164.83, pct:42, color:"#4caf72" },
  { cat:"Gas",        amount:101.00, pct:26, color:"#9b6fe8" },
  { cat:"Restaurant", amount:68.00,  pct:17, color:"#e08918" },
  { cat:"Pharmacy",   amount:57.00,  pct:15, color:"#5b9dee" },
];
const STORE_DATA = [
  { name:"Patel Brothers", visits:8, saved:28.40, color:"#4caf72" },
  { name:"India Bazaar",   visits:5, saved:18.20, color:"#9b6fe8" },
  { name:"Apna Bazar",     visits:3, saved:8.90,  color:"#e08918" },
  { name:"Shell Gas",      visits:6, saved:0,     color:"#5b9dee" },
];

export default function AnalyticsPage() {
  const { user } = useAppStore();
  const [period, setPeriod] = useState<"3m"|"6m"|"12m">("6m");
  const currency = user?.currency||"USD";
  const fmt = (n:number) => formatCurrency(n,currency);
  const months = period==="3m"?3:period==="6m"?6:12;
  const spendSlice  = SPENDING_DATA.slice(-months);
  const savingsSlice = SAVINGS_DATA.slice(-months);
  const monthLabels  = MONTHS.slice(-months);
  const maxSpend = Math.max(...spendSlice);
  const totalSpend  = spendSlice.reduce((a,b)=>a+b,0);
  const totalSaved  = savingsSlice.reduce((a,b)=>a+b,0);
  const avgMonth    = totalSpend/months;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text)" }}>Analytics</h1>
          <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Spending trends & savings insights</p>
        </div>

        {/* Period Selector */}
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {(["3m","6m","12m"] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{ flex:1, padding:"8px", fontSize:12, fontWeight:700, cursor:"pointer", borderRadius:9, border:"none", background:period===p?"rgba(245,166,35,0.12)":"var(--surf2)", color:period===p?"var(--gold)":"var(--text-muted)", outline:period===p?"1px solid rgba(245,166,35,0.35)":"1px solid var(--border)" }}>
              {p==="3m"?"3 Months":p==="6m"?"6 Months":"12 Months"}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
          {[
            { l:"Total Spent",   v:fmt(totalSpend),  c:"var(--gold)" },
            { l:"Total Saved",   v:fmt(totalSaved),  c:"var(--teal)" },
            { l:"Monthly Avg",   v:fmt(avgMonth),    c:"var(--text)" },
          ].map(s=>(
            <div key={s.l} style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
              <div style={{ fontSize:14, fontWeight:900, color:s.c, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Spending Chart */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:4 }}>📈 Monthly Spending</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:16 }}>Spending vs Savings</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
            {spendSlice.map((val,i)=>(
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:2, height:100, justifyContent:"flex-end" }}>
                  {/* savings bar */}
                  <div style={{ width:"60%", height:`${(savingsSlice[i]/maxSpend)*100}%`, background:"var(--teal)", borderRadius:"3px 3px 0 0", opacity:0.7, minHeight:3 }} />
                  {/* spend bar */}
                  <div style={{ width:"100%", height:`${(val/maxSpend)*100}%`, background:"linear-gradient(180deg,var(--gold),var(--gold-dim))", borderRadius:"3px 3px 0 0", minHeight:4 }} />
                </div>
                <div style={{ fontSize:8, color:"var(--text-dim)", fontWeight:600 }}>{monthLabels[i]}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:10, justifyContent:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:"var(--gold)" }}/><span style={{ fontSize:10, color:"var(--text-muted)" }}>Spending</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:"var(--teal)", opacity:0.7 }}/><span style={{ fontSize:10, color:"var(--text-muted)" }}>Savings</span></div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:14 }}>🧩 By Category</div>
          {/* Donut-style bar */}
          <div style={{ display:"flex", height:14, borderRadius:7, overflow:"hidden", marginBottom:12 }}>
            {CATEGORY_DATA.map(c=>(
              <div key={c.cat} style={{ width:`${c.pct}%`, background:c.color, transition:"width 0.5s" }} />
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {CATEGORY_DATA.map(c=>(
              <div key={c.cat} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:c.color, flexShrink:0 }} />
                <span style={{ fontSize:13, color:"var(--text)", flex:1 }}>{CAT_ICONS[c.cat]||"🛒"} {c.cat}</span>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{fmt(c.amount)}</span>
                  <span style={{ fontSize:10, color:"var(--text-muted)", marginLeft:6 }}>{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Store Performance */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:14 }}>🏪 Store Performance</div>
          {STORE_DATA.map(s=>(
            <div key={s.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{s.name}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)" }}>{s.visits} visits</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:s.saved>0?"var(--teal)":"var(--text-muted)" }}>
                  {s.saved>0?`+${fmt(s.saved)} saved`:"No savings"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Savings Tips */}
        <div style={{ background:"rgba(0,212,170,0.06)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:14, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--teal)", marginBottom:12 }}>💡 Insights</div>
          {[
            `You saved ${fmt(totalSaved)} over ${months} months — that's ${fmt(totalSaved/months)}/month average.`,
            "Grocery is your biggest spend at 42%. Comparing prices before every shop can save ~15% more.",
            `Your best savings month was ${monthLabels[savingsSlice.indexOf(Math.max(...savingsSlice))]} at ${fmt(Math.max(...savingsSlice))}.`,
          ].map((tip,i)=>(
            <div key={i} style={{ display:"flex", gap:8, marginBottom:i<2?10:0 }}>
              <span style={{ color:"var(--teal)", fontWeight:700, flexShrink:0 }}>→</span>
              <span style={{ fontSize:12, color:"var(--text)", lineHeight:1.6 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
