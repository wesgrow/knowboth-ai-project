"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const { user, cart } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [thisMonthSpent, setThisMonthSpent] = useState(0);
  const [lastMonthSpent, setLastMonthSpent] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [thisMonthSaved, setThisMonthSaved] = useState(0);
  const [aiTip, setAiTip] = useState("Compare prices before shopping — deals change weekly.");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);
  const cartCount = cart?.filter((i:any) => !i.purchased)?.length || 0;

  useEffect(() => { fetchStats(); fetchDeals(); generateTip(); }, []);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const { data:{ session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split("T")[0];
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const [{ data: thisMonth }, { data: lastMonth }, { count: bills }, { data: expenses }] = await Promise.all([
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", thisMonthStart),
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", lastMonthStart).lte("purchase_date", lastMonthEnd),
        supabase.from("expenses").select("id", { count:"exact", head:true }).eq("user_id", userId),
        supabase.from("expenses").select("id,store_name").eq("user_id", userId),
      ]);

      setThisMonthSpent((thisMonth||[]).reduce((s:number,e:any)=>s+Number(e.total),0));
      setLastMonthSpent((lastMonth||[]).reduce((s:number,e:any)=>s+Number(e.total),0));
      setTotalBills(bills||0);

      if (expenses?.length) {
        const expIds = expenses.map((e:any)=>e.id);
        const expMap:Record<string,string> = {};
        expenses.forEach((e:any)=>{ expMap[e.id]=e.store_name; });
        const { data: items } = await supabase.from("expense_items")
          .select("id,expense_id,name,quantity,category")
          .in("expense_id", expIds).lte("quantity",1)
          .in("category",["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"])
          .limit(5);
        setLowStockItems((items||[]).map((i:any)=>({...i,store:expMap[i.expense_id]})));
      }

      const { data: dealRows } = await supabase.from("deals").select("id,sale_end").eq("status","approved").not("sale_end","is",null);
      setExpiringCount((dealRows||[]).filter((d:any)=>{
        const days = Math.ceil((new Date(d.sale_end).getTime()-Date.now())/86400000);
        return days>=0&&days<=3;
      }).length);

      const { data: savedItems } = await supabase.from("deal_items").select("price,regular_price").not("regular_price","is",null).gte("created_at",thisMonthStart);
      setThisMonthSaved((savedItems||[]).reduce((s:number,i:any)=>{
        const saving = Number(i.regular_price)-Number(i.price);
        return s+(saving>0?saving:0);
      },0));
    } catch(e) { console.error("Stats error:",e); }
    setLoadingStats(false);
  }

  async function fetchDeals() {
    setLoadingDeals(true);
    try {
      const { data: dealRows } = await supabase.from("deals").select("id,brand_id").eq("status","approved");
      if (!dealRows?.length) { setLoadingDeals(false); return; }
      const dealIds = dealRows.map((d:any)=>d.id);
      const brandIds = [...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))] as string[];
      const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id",brandIds);
      const { data: items } = await supabase.from("deal_items").select("id,deal_id,name,price,regular_price,unit,category,created_at").in("deal_id",dealIds).order("created_at",{ascending:false}).limit(6);
      const bMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
      const dMap:Record<string,any>={};dealRows.forEach((d:any)=>{dMap[d.id]=d;});
      setDeals((items||[]).map((i:any)=>({...i,brand:bMap[dMap[i.deal_id]?.brand_id]})));
    } catch(e) { console.error("Deals error:",e); }
    setLoadingDeals(false);
  }

  async function generateTip() {
    const tips = [
      "Compare prices before shopping — deals change weekly.",
      "Scan your bills to track spending patterns.",
      "Check expiring deals before they're gone.",
      "Buy lentils and rice in bulk for maximum savings.",
      "Set a monthly budget goal in Expenses.",
    ];
    setAiTip(tips[new Date().getDay() % tips.length]);
  }

  const spendDiff = thisMonthSpent - lastMonthSpent;
  const spendPct = lastMonthSpent > 0 ? Math.abs(Math.round((spendDiff/lastMonthSpent)*100)) : 0;
  const savingGoal = 150;
  const savingPct = Math.min(100, Math.round((thisMonthSaved/savingGoal)*100));
  const level = getLevel(user?.points||0);

  return (
    <>
      <div style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{padding:"20px 24px",maxWidth:1200,width:"100%"}}>

          {/* Welcome */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:24,fontWeight:700,color:"var(--text)",letterSpacing:-0.6}}>
              Hi, {user?.name?.split(" ")[0]||"there"} {user?.avatar}
            </div>
            <div style={{fontSize:13,color:"var(--text2)",marginTop:3}}>
              {level} · ✦ {user?.points||0} pts · 📍 {user?.city||"DFW"}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
            {[
              {l:"Cart",v:cartCount,i:"🛒",c:"var(--gold)",h:"/cart"},
              {l:"Low Stock",v:lowStockItems.length,i:"⚠️",c:"var(--red)",h:"/stock"},
              {l:"Expiring",v:expiringCount,i:"⏰",c:"var(--gold)",h:"/deals"},
            ].map(s=>(
              <div key={s.l} onClick={()=>router.push(s.h)} style={{background:"var(--surf)",borderRadius:14,padding:"14px 10px",textAlign:"center",cursor:"pointer",boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
                <div style={{fontSize:22,fontWeight:700,color:s.c}}>{loadingStats?"—":s.v}</div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* AI Tip */}
          <div style={{background:"linear-gradient(135deg,rgba(255,159,10,0.08),rgba(255,159,10,0.02))",border:"1px solid rgba(255,159,10,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--gold)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6}}>🤖 AI Smart Tip</div>
            <div style={{fontSize:13,color:"var(--text)",lineHeight:1.6}}>{aiTip}</div>
            <button onClick={generateTip} style={{background:"none",border:"none",color:"var(--gold)",fontSize:11,fontWeight:600,cursor:"pointer",marginTop:6,padding:0}}>🔄 New tip</button>
          </div>

          {/* This Month */}
          <div style={{background:"var(--surf)",borderRadius:14,padding:"16px",marginBottom:20,boxShadow:"var(--shadow)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase" as const}}>💰 This Month</div>
                <div style={{fontSize:26,fontWeight:700,color:"var(--gold)",marginTop:4,letterSpacing:-0.8}}>
                  {loadingStats?"Loading...":fmt(thisMonthSpent)} spent
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                {!loadingStats&&lastMonthSpent>0&&(
                  <>
                    <div style={{fontSize:12,fontWeight:600,color:spendDiff<=0?"var(--green)":"var(--red)"}}>
                      {spendDiff<=0?"↓":"↑"} {spendPct}% vs last month
                    </div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{fmt(lastMonthSpent)} last month</div>
                  </>
                )}
                {thisMonthSaved>0&&(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:"var(--green)",fontWeight:600}}>✦ {fmt(thisMonthSaved)} saved from deals</span>
                      <span style={{fontSize:11,color:"var(--text3)"}}>{savingPct}% of {fmt(savingGoal)} goal</span>
                    </div>
                    <div style={{height:6,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${savingPct}%`,background:"linear-gradient(90deg,#30D158,#25A244)",borderRadius:3}}/>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:16,marginTop:12}}>
              <div style={{fontSize:12,color:"var(--text2)"}}><span style={{fontWeight:700,color:"var(--text)"}}>{totalBills}</span> total bills scanned</div>
              <button onClick={()=>router.push("/expenses")} style={{background:"none",border:"none",color:"var(--gold)",fontSize:12,fontWeight:600,cursor:"pointer",padding:0}}>View all →</button>
            </div>
          </div>

          {/* Low Stock */}
          {lowStockItems.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>⚠️ Low Stock</div>
                <button onClick={()=>router.push("/stock")} style={{background:"none",border:"none",fontSize:13,color:"var(--gold)",cursor:"pointer",fontWeight:600}}>View all →</button>
              </div>
              <div style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)"}}>
                {lowStockItems.map((item:any,i:number)=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<lowStockItems.length-1?"0.5px solid var(--border2)":"none"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{item.store}</div>
                    </div>
                    <span style={{background:"rgba(255,59,48,0.1)",color:"var(--red)",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:600}}>{item.quantity} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest Deals */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>🔥 Latest Deals</div>
            <button onClick={()=>router.push("/deals")} style={{background:"none",border:"none",fontSize:13,color:"var(--gold)",cursor:"pointer",fontWeight:600}}>View all →</button>
          </div>
          {loadingDeals&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--text3)",fontSize:13}}>Loading deals...</div>}
          {!loadingDeals&&deals.length===0&&(
            <div style={{background:"var(--surf)",borderRadius:14,padding:"20px",textAlign:"center",boxShadow:"var(--shadow)",marginBottom:20}}>
              <div style={{fontSize:13,color:"var(--text3)"}}>No deals yet</div>
              <button onClick={()=>router.push("/post-deal")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",marginTop:8}}>📷 Post First Deal</button>
            </div>
          )}
          {deals.length>0&&(
            <div style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:20}}>
              {deals.map((item,idx)=>{
                const color = STORE_COLORS[item.brand?.slug]||"#FF9F0A";
                const sav = item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
                return(
                  <div key={item.id} onClick={()=>router.push("/deals")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:idx<deals.length-1?"0.5px solid var(--border2)":"none",cursor:"pointer"}}>
                    <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{item.brand?.name}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:700,color:"var(--gold)"}}>${item.price?.toFixed(2)}</div>
                      {sav&&<div style={{fontSize:10,color:"var(--green)",fontWeight:600}}>-{sav}%</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Actions */}
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:10}}>⚡ Quick Actions</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {[
              {l:"Scan Bill",i:"🧾",h:"/scan",c:"#FF9F0A"},
              {l:"Post Deal",i:"📷",h:"/post-deal",c:"#30D158"},
              {l:"Compare Prices",i:"⚖️",h:"/deals",c:"#0A84FF"},
              {l:"View Expenses",i:"📊",h:"/expenses",c:"#FF9F0A"},
            ].map(a=>(
              <button key={a.l} onClick={()=>router.push(a.h)} style={{background:"var(--surf)",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",boxShadow:"var(--shadow)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${a.c}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{a.i}</div>
                <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{a.l}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
