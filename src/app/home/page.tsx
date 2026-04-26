"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";

interface HomeStats {
  thisMonthSpent: number;
  lastMonthSpent: number;
  thisMonthSaved: number;
  totalBills: number;
  lowStockCount: number;
  lowStockItems: any[];
  cartCount: number;
  expiringCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const { user, cart } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [stats, setStats] = useState<HomeStats>({
    thisMonthSpent:0, lastMonthSpent:0, thisMonthSaved:0,
    totalBills:0, lowStockCount:0, lowStockItems:[], cartCount:0, expiringCount:0,
  });
  const [aiTip, setAiTip] = useState("");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [tipLoading, setTipLoading] = useState(false);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  useEffect(() => {
    fetchStats();
    fetchDeals();
    generateAiTip();
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) return;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split("T")[0];
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      // This month expenses
      const { data: thisMonth } = await supabase.from("expenses")
        .select("total").eq("user_id", session.user.id)
        .gte("purchase_date", thisMonthStart);

      // Last month expenses
      const { data: lastMonth } = await supabase.from("expenses")
        .select("total").eq("user_id", session.user.id)
        .gte("purchase_date", lastMonthStart)
        .lte("purchase_date", lastMonthEnd);

      // Total bills
      const { count: totalBills } = await supabase.from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      // Low stock items (qty <= 1) from expense_items
      const { data: expenses } = await supabase.from("expenses")
        .select("id,store_name").eq("user_id", session.user.id);

      let lowStockItems: any[] = [];
      if (expenses?.length) {
        const expIds = expenses.map((e: any) => e.id);
        const expMap: Record<string,string> = {};
        expenses.forEach((e: any) => { expMap[e.id] = e.store_name; });
        const { data: items } = await supabase.from("expense_items")
          .select("id,expense_id,name,quantity,category")
          .in("expense_id", expIds)
          .lte("quantity", 1)
          .in("category", ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"])
          .limit(5);
        lowStockItems = (items || []).map((i: any) => ({ ...i, store: expMap[i.expense_id] }));
      }

      // Expiring deals
      const { data: dealRows } = await supabase.from("deals")
        .select("id,sale_end").eq("status","approved")
        .not("sale_end","is",null);
      const expiringCount = (dealRows || []).filter((d: any) => {
        const days = Math.ceil((new Date(d.sale_end).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 3;
      }).length;

      const thisMonthSpent = (thisMonth || []).reduce((s: number, e: any) => s + Number(e.total), 0);
      const lastMonthSpent = (lastMonth || []).reduce((s: number, e: any) => s + Number(e.total), 0);

      // Calculate savings — sum of (regular_price - price) for deal items user might have bought
      const { data: savedItems } = await supabase.from("deal_items")
        .select("price,regular_price")
        .not("regular_price","is",null)
        .gte("created_at", thisMonthStart);
      const thisMonthSaved = (savedItems || []).reduce((s: number, i: any) => {
        const saving = Number(i.regular_price) - Number(i.price);
        return s + (saving > 0 ? saving : 0);
      }, 0);

      setStats({
        thisMonthSpent, lastMonthSpent, thisMonthSaved,
        totalBills: totalBills || 0,
        lowStockCount: lowStockItems.length,
        lowStockItems,
        cartCount: cart.filter(i => !i.purchased).length,
        expiringCount,
      });
    } catch (e: any) {
      console.error("Home stats error:", e);
    } finally {
      setLoadingStats(false);
    }
  }, [cart]);

  async function fetchDeals() {
    setLoadingDeals(true);
    try {
      const { data: dealRows } = await supabase.from("deals").select("id,sale_end,brand_id").eq("status","approved");
      if (!dealRows?.length) { setLoadingDeals(false); return; }
      const dealIds = dealRows.map((d: any) => d.id);
      const brandIds = [...new Set(dealRows.map((d: any) => d.brand_id).filter(Boolean))] as string[];
      const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
      const { data: items } = await supabase.from("deal_items")
        .select("id,deal_id,name,price,regular_price,unit,category,created_at")
        .in("deal_id", dealIds).order("created_at", { ascending: false }).limit(6);
      const bMap: Record<string,any> = {}; (brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
      const dMap: Record<string,any> = {}; dealRows.forEach((d:any)=>{dMap[d.id]=d;});
      setDeals((items||[]).map((i:any)=>({...i,deal:dMap[i.deal_id],brand:bMap[dMap[i.deal_id]?.brand_id]})));
    } catch (e: any) {
      console.error("Deals fetch error:", e);
    } finally {
      setLoadingDeals(false);
    }
  }

  async function generateAiTip() {
    setTipLoading(true);
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      const userId = session?.user?.id;

      // Get recent expenses for context
      const { data: recentExp } = await supabase.from("expenses")
        .select("store_name,total,purchase_date")
        .eq("user_id", userId).order("purchase_date", { ascending: false }).limit(5);

      // Get top deals
      const { data: topDeals } = await supabase.from("deal_items")
        .select("name,price,regular_price").not("regular_price","is",null)
        .order("created_at", { ascending: false }).limit(5);

      const context = `
Recent purchases: ${(recentExp||[]).map((e:any)=>e.store_name).join(", ")||"none"}
Top deals: ${(topDeals||[]).map((d:any)=>`${d.name} $${d.price} (was $${d.regular_price})`).join(", ")||"none"}
`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Based on this user's grocery data, give ONE short smart shopping tip (max 20 words, specific and actionable):\n${context}`
          }]
        })
      });
      const data = await res.json();
      const tip = data.content || data.message || "";
      if (tip) setAiTip(tip.replace(/^["']|["']$/g,"").trim());
      else throw new Error("No tip");
    } catch {
      // Fallback tips based on real data if API fails
      const tips = [
        "Compare prices before shopping — deals change weekly.",
        "Check expiring deals today before they're gone.",
        "Scan your bills to track spending patterns.",
        "Buy lentils and rice in bulk for maximum savings.",
        "Set a monthly budget goal and track it in Expenses.",
      ];
      setAiTip(tips[new Date().getDay() % tips.length]);
    } finally {
      setTipLoading(false);
    }
  }

  const spendDiff = stats.thisMonthSpent - stats.lastMonthSpent;
  const spendPct = stats.lastMonthSpent > 0 ? Math.abs(Math.round((spendDiff/stats.lastMonthSpent)*100)) : 0;
  const savingGoal = 150;
  const savingPct = Math.min(100, Math.round((stats.thisMonthSaved/savingGoal)*100));

  return (
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container">

        {/* Welcome */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:24,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.6}}>
            Hi, {user?.name?.split(" ")[0] || "there"} {user?.avatar}
          </div>
          <div style={{fontSize:13,color:"#6D6D72",marginTop:3}}>
            {getLevel(user?.points||0)} · ✦ {user?.points||0} pts · 📍 {user?.city||"DFW"}
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
          {[
            {l:"Cart",v:stats.cartCount,i:"🛒",c:"#FF9F0A",h:"/cart"},
            {l:"Low Stock",v:stats.lowStockCount,i:"⚠️",c:"#FF3B30",h:"/stock"},
            {l:"Expiring",v:stats.expiringCount,i:"⏰",c:"#FF9F0A",h:"/deals"},
          ].map(s=>(
            <div key={s.l} onClick={()=>router.push(s.h)} style={{background:"#fff",borderRadius:14,padding:"14px 10px",textAlign:"center",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
              <div style={{fontSize:22,fontWeight:700,color:s.c}}>{loadingStats?"—":s.v}</div>
              <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* AI Tip */}
        <div style={{background:"linear-gradient(135deg,rgba(255,159,10,0.08),rgba(255,159,10,0.02))",border:"1px solid rgba(255,159,10,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:"#FF9F0A",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6}}>🤖 AI Smart Tip</div>
          <div style={{fontSize:13,color:"#1C1C1E",lineHeight:1.6,minHeight:20}}>
            {tipLoading?"Thinking...":aiTip||"Loading smart tip..."}
          </div>
          <button onClick={generateAiTip} disabled={tipLoading} style={{background:"none",border:"none",color:"#FF9F0A",fontSize:11,fontWeight:600,cursor:"pointer",marginTop:6,padding:0,opacity:tipLoading?0.5:1}}>
            🔄 New tip
          </button>
        </div>

        {/* This Month Spending */}
        <div style={{background:"#fff",borderRadius:14,padding:"16px",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const}}>💰 This Month</div>
              <div style={{fontSize:26,fontWeight:700,color:"#FF9F0A",marginTop:4,letterSpacing:-0.8}}>
                {loadingStats?"Loading...":fmt(stats.thisMonthSpent)} spent
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              {!loadingStats&&stats.lastMonthSpent>0&&(
                <>
                  <div style={{fontSize:12,fontWeight:600,color:spendDiff<=0?"#30D158":"#FF3B30"}}>
                    {spendDiff<=0?"↓":"↑"} {spendPct}% vs last month
                  </div>
                  <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{fmt(stats.lastMonthSpent)} last month</div>
                </>
              )}
            </div>
          </div>
          {/* Savings bar */}
          {stats.thisMonthSaved>0&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:"#30D158",fontWeight:600}}>✦ {fmt(stats.thisMonthSaved)} saved from deals</span>
                <span style={{fontSize:11,color:"#AEAEB2"}}>{savingPct}% of ${savingGoal} goal</span>
              </div>
              <div style={{height:6,background:"#F2F2F7",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${savingPct}%`,background:"linear-gradient(90deg,#30D158,#25A244)",borderRadius:3,transition:"width 0.5s"}}/>
              </div>
            </>
          )}
          {/* Bills count */}
          <div style={{display:"flex",gap:16,marginTop:12}}>
            <div style={{fontSize:12,color:"#6D6D72"}}><span style={{fontWeight:700,color:"#1C1C1E"}}>{stats.totalBills}</span> total bills scanned</div>
            <button onClick={()=>router.push("/expenses")} style={{background:"none",border:"none",color:"#FF9F0A",fontSize:12,fontWeight:600,cursor:"pointer",padding:0}}>View all →</button>
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats.lowStockItems.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>⚠️ Low Stock</div>
              <button onClick={()=>router.push("/stock")} style={{background:"none",border:"none",fontSize:13,color:"#FF9F0A",cursor:"pointer",fontWeight:600}}>View all →</button>
            </div>
            <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              {stats.lowStockItems.map((item:any,i:number)=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<stats.lowStockItems.length-1?"0.5px solid #F2F2F7":"none"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#AEAEB2",marginTop:1}}>{item.store}</div>
                  </div>
                  <span style={{background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:600}}>{item.quantity} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Deals */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>🔥 Latest Deals</div>
          <button onClick={()=>router.push("/deals")} style={{background:"none",border:"none",fontSize:13,color:"#FF9F0A",cursor:"pointer",fontWeight:600}}>View all →</button>
        </div>
        {loadingDeals&&<div style={{textAlign:"center",padding:"20px 0",color:"#AEAEB2",fontSize:13}}>Loading deals...</div>}
        {!loadingDeals&&deals.length===0&&(
          <div style={{background:"#fff",borderRadius:14,padding:"20px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:20}}>
            <div style={{fontSize:13,color:"#AEAEB2"}}>No deals yet</div>
            <button onClick={()=>router.push("/post-deal")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",marginTop:8}}>📷 Post First Deal</button>
          </div>
        )}
        {deals.length>0&&(
          <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:20}}>
            {deals.map((item,idx)=>{
              const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
              const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
              return(
                <div key={item.id} onClick={()=>router.push("/deals")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:idx<deals.length-1?"0.5px solid #F2F2F7":"none",cursor:"pointer"}}>
                  <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#AEAEB2",marginTop:1}}>{item.brand?.name}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:"#FF9F0A"}}>${item.price?.toFixed(2)}</div>
                    {sav&&<div style={{fontSize:10,color:"#30D158",fontWeight:600}}>-{sav}%</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",marginBottom:10}}>⚡ Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
          {[
            {l:"Scan Bill",i:"🧾",h:"/scan",c:"#FF9F0A"},
            {l:"Post Deal",i:"📷",h:"/post-deal",c:"#30D158"},
            {l:"Compare Prices",i:"⚖️",h:"/deals",c:"#0A84FF"},
            {l:"View Expenses",i:"📊",h:"/expenses",c:"#FF9F0A"},
          ].map(a=>(
            <button key={a.l} onClick={()=>router.push(a.h)} style={{background:"#fff",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${a.c}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{a.i}</div>
              <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{a.l}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
