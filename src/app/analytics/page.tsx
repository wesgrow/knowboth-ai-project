"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

const CAT_COLORS: Record<string,string> = {
  Grocery:"#FF9F0A","Rice & Grains":"#30D158","Lentils & Dals":"#0A84FF",
  Vegetables:"#34C759",Fruits:"#FF6B6B",Dairy:"#5AC8FA",
  Spices:"#FF3B30",Snacks:"#AF52DE",Beverages:"#FF9500",
  "Oils & Ghee":"#FFCC00",Frozen:"#64D2FF","Meat & Fish":"#FF6B35",
  Bakery:"#C69B7B",Household:"#8E8E93",Other:"#AEAEB2",
  Gas:"#FF3B30",Restaurant:"#FF6B6B",Pharmacy:"#30D158",Electronics:"#0A84FF",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PRESETS = [{l:"3M",m:3},{l:"6M",m:6},{l:"12M",m:12}];

interface MonthlySpend { month: string; amount: number; bills: number; }
interface CategorySpend { category: string; amount: number; pct: number; }
interface StoreSpend { store: string; amount: number; visits: number; }
interface DaySpend { day: string; amount: number; }

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpend[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [storeSpend, setStoreSpend] = useState<StoreSpend[]>([]);
  const [daySpend, setDaySpend] = useState<DaySpend[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [avgMonthly, setAvgMonthly] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);

  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data:{ session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) { router.push("/auth"); return; }
      const userId = session.user.id;

      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - months);
      const fromStr = fromDate.toISOString().split("T")[0];

      // Fetch expenses in range
      const { data:expenses, error:ee } = await supabase
        .from("expenses")
        .select("id,store_name,total,purchase_date,items_count")
        .eq("user_id", userId)
        .gte("purchase_date", fromStr)
        .order("purchase_date", { ascending: true });
      if (ee) throw new Error(ee.message);

      if (!expenses?.length) {
        setMonthlySpend([]); setCategorySpend([]); setStoreSpend([]);
        setTotalSpent(0); setAvgMonthly(0); setTotalBills(0);
        setLoading(false); return;
      }

      // Monthly spend
      const monthMap: Record<string,{amount:number;bills:number}> = {};
      expenses.forEach(e => {
        const d = new Date(e.purchase_date);
        const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (!monthMap[key]) monthMap[key] = {amount:0,bills:0};
        monthMap[key].amount += Number(e.total);
        monthMap[key].bills += 1;
      });
      const monthlyData = Object.entries(monthMap).map(([month,v])=>({month,...v}));
      setMonthlySpend(monthlyData);

      // Total stats
      const total = expenses.reduce((s,e)=>s+Number(e.total),0);
      setTotalSpent(total);
      setTotalBills(expenses.length);
      setAvgMonthly(monthlyData.length>0?total/monthlyData.length:0);

      // Store spend
      const storeMap: Record<string,{amount:number;visits:number}> = {};
      expenses.forEach(e => {
        if (!storeMap[e.store_name]) storeMap[e.store_name] = {amount:0,visits:0};
        storeMap[e.store_name].amount += Number(e.total);
        storeMap[e.store_name].visits += 1;
      });
      setStoreSpend(Object.entries(storeMap).map(([store,v])=>({store,...v})).sort((a,b)=>b.amount-a.amount));

      // Day of week spend
      const dayMap: Record<string,number> = {Sun:0,Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0};
      expenses.forEach(e => {
        const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(e.purchase_date).getDay()];
        dayMap[day] += Number(e.total);
      });
      setDaySpend(Object.entries(dayMap).map(([day,amount])=>({day,amount})));

      // Category spend from expense_items
      const expIds = expenses.map(e=>e.id);
      const { data:items } = await supabase
        .from("expense_items")
        .select("category,price,quantity")
        .in("expense_id", expIds);

      const catMap: Record<string,number> = {};
      (items||[]).forEach(i => {
        catMap[i.category] = (catMap[i.category]||0) + (Number(i.price)*Number(i.quantity));
      });
      const catTotal = Object.values(catMap).reduce((s,v)=>s+v,0);
      setCategorySpend(
        Object.entries(catMap)
          .sort((a,b)=>b[1]-a[1])
          .slice(0,8)
          .map(([category,amount])=>({category,amount,pct:catTotal>0?Math.round((amount/catTotal)*100):0}))
      );

      // Total saved from deals
      const { data:savedItems } = await supabase
        .from("deal_items")
        .select("price,regular_price")
        .not("regular_price","is",null)
        .gte("created_at", fromStr);
      const saved = (savedItems||[]).reduce((s,i)=>{
        const saving = Number(i.regular_price)-Number(i.price);
        return s+(saving>0?saving:0);
      },0);
      setTotalSaved(saved);

    } catch(e:any) {
      console.error("Analytics error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [months, router]);

  useEffect(()=>{ fetchAnalytics(); },[fetchAnalytics]);

  const maxMonthly = Math.max(...monthlySpend.map(m=>m.amount),1);
  const maxDay = Math.max(...daySpend.map(d=>d.amount),1);
  const maxStore = Math.max(...storeSpend.map(s=>s.amount),1);

  return (
    <div className="page-body">
      <div className="page-content" style={{maxWidth:1200,width:"100%"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>Analytics</h1>
            <p style={{fontSize:13,color:"var(--text2)",marginTop:3}}>Your spending insights</p>
          </div>
          {/* Period selector */}
          <div style={{display:"flex",background:"var(--surf)",borderRadius:10,padding:2,gap:1,boxShadow:"var(--shadow)"}}>
            {PRESETS.map(p=>(
              <button key={p.m} onClick={()=>setMonths(p.m)}
                style={{padding:"7px 14px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",
                  background:months===p.m?"#FF9F0A":"transparent",
                  color:months===p.m?"#fff":"var(--text2)",transition:"all 0.15s"}}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error&&(
          <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#FF3B30"}}>⚠️ {error}</span>
            <button onClick={fetchAnalytics} style={{background:"#FF3B30",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {[1,2,3,4].map(i=><div key={i} className="skel" style={{height:72,borderRadius:14}}/>)}
            </div>
            <div className="skel" style={{height:160,borderRadius:16}}/>
            <div className="skel" style={{height:120,borderRadius:16}}/>
          </div>
        )}

        {/* Empty state */}
        {!loading&&totalBills===0&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{fontSize:56,marginBottom:16}}>📊</div>
            <div style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:8}}>No data yet</div>
            <p style={{fontSize:13,color:"var(--text2)",marginBottom:20}}>Scan bills to see your spending analytics</p>
            <button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,color:"#fff",cursor:"pointer"}}>🧾 Scan First Bill</button>
          </div>
        )}

        {/* Data */}
        {!loading&&totalBills>0&&(
          <>
            {/* Summary stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
              {[
                {l:"Total Spent",v:fmt(totalSpent),c:"#FF9F0A",i:"💰"},
                {l:"Avg/Month",v:fmt(avgMonthly),c:"#0A84FF",i:"📅"},
                {l:"Bills Scanned",v:totalBills,c:"#30D158",i:"🧾"},
                {l:"Deals Saved",v:fmt(totalSaved),c:"#FF9F0A",i:"✦"},
              ].map(s=>(
                <div key={s.l} style={{background:"var(--surf)",borderRadius:14,padding:"14px",boxShadow:"var(--shadow)"}}>
                  <div style={{fontSize:16}}>{s.i}</div>
                  <div style={{fontSize:20,fontWeight:800,color:s.c,marginTop:6,letterSpacing:-0.5}}>{s.v}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Monthly Spend Chart */}
            {monthlySpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:16}}>📈 Monthly Spending</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,marginBottom:8}}>
                  {monthlySpend.map((m,i)=>{
                    const h = Math.max(4, Math.round((m.amount/maxMonthly)*110));
                    const isMax = m.amount===maxMonthly;
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3}}>
                        <div style={{fontSize:9,fontWeight:600,color:isMax?"#FF9F0A":"var(--text3)"}}>{fmt(m.amount).replace(".00","")}</div>
                        <div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isMax?"linear-gradient(180deg,#FF9F0A,#D4800A)":"var(--bg)",transition:"height 0.5s",position:"relative",minHeight:4}}>
                          {isMax&&<div style={{position:"absolute",top:-2,left:"50%",transform:"translateX(-50%)",width:6,height:6,borderRadius:"50%",background:"#FF9F0A"}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {monthlySpend.map((m,i)=>(
                    <div key={i} style={{flex:1,textAlign:"center",fontSize:9,color:"var(--text3)",fontWeight:500}}>{m.month.split(" ")[0]}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {categorySpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>🥧 Spending by Category</div>
                <div style={{display:"flex",height:12,borderRadius:6,overflow:"hidden",marginBottom:14,gap:1}}>
                  {categorySpend.map(c=>(
                    <div key={c.category} title={`${c.category}: ${c.pct}%`}
                      style={{width:`${c.pct}%`,background:CAT_COLORS[c.category]||"#AEAEB2",transition:"width 0.5s",minWidth:c.pct>0?2:0}}/>
                  ))}
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  {categorySpend.map(c=>(
                    <div key={c.category}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:CAT_COLORS[c.category]||"#AEAEB2",flexShrink:0}}/>
                          <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{c.category}</span>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:11,color:"var(--text3)"}}>{c.pct}%</span>
                          <span style={{fontSize:13,fontWeight:700,color:CAT_COLORS[c.category]||"var(--text)"}}>{fmt(c.amount)}</span>
                        </div>
                      </div>
                      <div style={{height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${c.pct}%`,background:CAT_COLORS[c.category]||"#AEAEB2",borderRadius:3,transition:"width 0.5s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Store Breakdown */}
            {storeSpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>🏪 Spending by Store</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  {storeSpend.map((s,i)=>(
                    <div key={s.store}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:"var(--text3)",minWidth:14}}>#{i+1}</span>
                          <span style={{fontSize:13,color:"var(--text)",fontWeight:600}}>{s.store}</span>
                          <span style={{fontSize:10,color:"var(--text3)"}}>{s.visits} visit{s.visits!==1?"s":""}</span>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:"#FF9F0A"}}>{fmt(s.amount)}</span>
                      </div>
                      <div style={{height:6,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.round((s.amount/maxStore)*100)}%`,background:"linear-gradient(90deg,#FF9F0A,#D4800A)",borderRadius:3,transition:"width 0.5s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day of Week */}
            {daySpend.some(d=>d.amount>0)&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>📅 Spending by Day</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
                  {daySpend.map((d,i)=>{
                    const h = Math.max(4,Math.round((d.amount/maxDay)*70));
                    const isMax = d.amount===maxDay&&d.amount>0;
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4}}>
                        <div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isMax?"linear-gradient(180deg,#0A84FF,#0060CC)":"var(--bg)",minHeight:4}}/>
                        <div style={{fontSize:9,fontWeight:600,color:isMax?"#0A84FF":"var(--text3)"}}>{d.day}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:8,textAlign:"center"}}>
                  Best day to shop: <span style={{fontWeight:600,color:"#0A84FF"}}>{daySpend.reduce((a,b)=>a.amount>b.amount?a:b,{day:"—",amount:0}).day}</span>
                </div>
              </div>
            )}

            {/* Scan more CTA */}
            <div style={{background:"linear-gradient(135deg,rgba(255,159,10,0.08),rgba(255,159,10,0.02))",border:"1px solid rgba(255,159,10,0.2)",borderRadius:14,padding:"16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:2}}>📈 More data = Better insights</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>Scan all your bills for complete analytics</div>
              </div>
              <button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",flexShrink:0,boxShadow:"0 2px 6px rgba(255,159,10,0.3)"}}>🧾 Scan</button>
            </div>
          </>
        )}

      </div>

      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .fade-up{animation:fadeInUp 0.35s ease both}
        .skel{background:linear-gradient(90deg,var(--border2) 25%,var(--surf) 50%,var(--border2) 75%);background-size:800px 100%;animation:shimmer 1.4s infinite linear;border-radius:8px;}
        @media(prefers-reduced-motion:reduce){.fade-up{animation:none!important;opacity:1!important}.skel{animation:none!important}}
      `}</style>
    </div>
  );
}
