"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { AnalyticsTemplate } from "@/templates/AnalyticsTemplate";
import { Button, Card, Skeleton, BottomSheet } from "@/ui";

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
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface TopItem { name: string; amount: number; }
interface CategorySpend { category: string; amount: number; pct: number; topItems: TopItem[]; }
interface StoreSpend { store: string; amount: number; visits: number; avgPerVisit: number; }
interface DaySpend { day: string; amount: number; }
interface MonthlySpend { month: string; amount: number; bills: number; }
interface Sheet { type: "cat" | "store"; data: CategorySpend | StoreSpend; }

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, cart } = useAppStore();
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
  const [insights, setInsights] = useState<{icon:string;text:string;color:string}[]>([]);
  const [sheet, setSheet] = useState<Sheet|null>(null);

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

      const total = expenses.reduce((s,e)=>s+Number(e.total),0);
      setTotalSpent(total);
      setTotalBills(expenses.length);
      setAvgMonthly(monthlyData.length>0 ? total/monthlyData.length : 0);

      // Store spend with avg per visit
      const storeMap: Record<string,{amount:number;visits:number}> = {};
      expenses.forEach(e => {
        if (!storeMap[e.store_name]) storeMap[e.store_name] = {amount:0,visits:0};
        storeMap[e.store_name].amount += Number(e.total);
        storeMap[e.store_name].visits += 1;
      });
      const storeData = Object.entries(storeMap)
        .map(([store,v])=>({store, ...v, avgPerVisit: v.amount/v.visits}))
        .sort((a,b)=>b.amount-a.amount);
      setStoreSpend(storeData);

      // Day of week spend
      const dayMap: Record<string,number> = {Sun:0,Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0};
      expenses.forEach(e => {
        const day = DAYS[new Date(e.purchase_date).getDay()];
        dayMap[day] += Number(e.total);
      });
      setDaySpend(Object.entries(dayMap).map(([day,amount])=>({day,amount})));

      // Category spend + top 3 items per category
      const expIds = expenses.map(e=>e.id);
      const { data:items } = await supabase
        .from("expense_items")
        .select("category,name,price,quantity")
        .in("expense_id", expIds);

      const catMap: Record<string,number> = {};
      const itemMap: Record<string,Record<string,number>> = {};
      (items||[]).forEach(i => {
        const amt = Number(i.price)*Number(i.quantity);
        catMap[i.category] = (catMap[i.category]||0) + amt;
        if (!itemMap[i.category]) itemMap[i.category] = {};
        itemMap[i.category][i.name] = (itemMap[i.category][i.name]||0) + amt;
      });
      const catTotal = Object.values(catMap).reduce((s,v)=>s+v,0);
      const catData = Object.entries(catMap)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,8)
        .map(([category,amount])=>({
          category,
          amount,
          pct: catTotal>0 ? Math.round((amount/catTotal)*100) : 0,
          topItems: Object.entries(itemMap[category]||{})
            .sort((a,b)=>b[1]-a[1]).slice(0,3)
            .map(([name,amt])=>({name,amount:amt})),
        }));
      setCategorySpend(catData);

      // Deals saved
      const { data:savedItems } = await supabase
        .from("deal_items")
        .select("price,regular_price")
        .not("regular_price","is",null)
        .gte("created_at", fromStr);
      const saved = (savedItems||[]).reduce((s,i)=>{
        const d = Number(i.regular_price)-Number(i.price);
        return s+(d>0?d:0);
      },0);
      setTotalSaved(saved);

      // Insights
      const chips: {icon:string;text:string;color:string}[] = [];
      if (catData.length>0)
        chips.push({icon:"🎯",text:`${catData[0].category} is ${catData[0].pct}% of your budget`,color:"#FF9F0A"});
      const cheapestDay = Object.entries(dayMap).filter(([,v])=>v>0).sort((a,b)=>a[1]-b[1])[0];
      if (cheapestDay)
        chips.push({icon:"📅",text:`${cheapestDay[0]} is your cheapest shopping day`,color:"#30D158"});
      if (storeData.length>0) {
        const best = [...storeData].sort((a,b)=>a.avgPerVisit-b.avgPerVisit)[0];
        chips.push({icon:"🏪",text:`${best.store} best value at ${fmt(best.avgPerVisit)}/visit`,color:"#0A84FF"});
      }
      if (monthlyData.length>=2) {
        const last = monthlyData[monthlyData.length-1].amount;
        const prev = monthlyData[monthlyData.length-2].amount;
        const diff = Math.abs(last-prev);
        const pct = prev>0 ? Math.round((diff/prev)*100) : 0;
        if (pct>0)
          chips.push({icon:last<prev?"📉":"📈",text:`Spending ${last<prev?"down":"up"} ${pct}% vs last month`,color:last<prev?"#30D158":"#FF3B30"});
      }
      setInsights(chips);

    } catch(e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [months, router]);

  useEffect(()=>{ fetchAnalytics(); },[fetchAnalytics]);

  const maxMonthly = Math.max(...monthlySpend.map(m=>m.amount),1);
  const maxDay = Math.max(...daySpend.map(d=>d.amount),1);
  const maxStore = Math.max(...storeSpend.map(s=>s.amount),1);
  const cartTotal = cart.reduce((s,i)=>(i.price||0)*i.qty+s,0);
  const cartItems = cart.reduce((s,i)=>s+i.qty,0);
  const thisMonthKey = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const thisMonthSpend = monthlySpend.find(m=>m.month===thisMonthKey)?.amount||0;

  return (
    <>
    <AnalyticsTemplate>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>Analytics</h1>
            <p style={{fontSize:13,color:"var(--text2)",marginTop:3}}>Your spending insights</p>
          </div>
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

        {error&&(
          <Card border style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,59,48,0.05)"}}>
            <span style={{fontSize:13,color:"#FF3B30"}}>⚠️ {error}</span>
            <Button variant="danger" size="sm" onClick={fetchAnalytics}>Retry</Button>
          </Card>
        )}

        {loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {[1,2,3,4].map(i=><Skeleton key={i} h={72} radius={14}/>)}
            </div>
            <Skeleton h={160} radius={16}/>
            <Skeleton h={120} radius={16}/>
          </div>
        )}

        {!loading&&totalBills===0&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{fontSize:56,marginBottom:16}}>📊</div>
            <div style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:8}}>No data yet</div>
            <p style={{fontSize:13,color:"var(--text2)",marginBottom:20}}>Scan bills to see your spending analytics</p>
            <button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,color:"#fff",cursor:"pointer"}}>🧾 Scan First Bill</button>
          </div>
        )}

        {!loading&&totalBills>0&&(
          <>
            {/* Summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
              {[
                {l:"Total Spent",v:fmt(totalSpent),c:"#FF9F0A",i:"💰"},
                {l:"Avg/Month",v:fmt(avgMonthly),c:"#0A84FF",i:"📅"},
                {l:"Bills Logged",v:totalBills,c:"#30D158",i:"🧾"},
                {l:"Deals Saved",v:fmt(totalSaved),c:"#FF9F0A",i:"✦"},
              ].map(s=>(
                <div key={s.l} style={{background:"var(--surf)",borderRadius:14,padding:"14px",boxShadow:"var(--shadow)"}}>
                  <div style={{fontSize:16}}>{s.i}</div>
                  <div style={{fontSize:20,fontWeight:800,color:s.c,marginTop:6,letterSpacing:-0.5}}>{s.v}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Smart insights */}
            {insights.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {insights.map((ins,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--surf)",borderRadius:12,padding:"10px 14px",boxShadow:"var(--shadow)"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{ins.icon}</span>
                    <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{ins.text}</span>
                    <div style={{marginLeft:"auto",width:4,height:32,borderRadius:2,background:ins.color,flexShrink:0}}/>
                  </div>
                ))}
              </div>
            )}

            {/* Cart conversion */}
            {cartItems>0&&(
              <div style={{background:"var(--surf)",borderRadius:14,padding:"14px 16px",marginBottom:16,boxShadow:"var(--shadow)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase"}}>Cart vs This Month</div>
                  <div style={{fontSize:13,color:"var(--text)",marginTop:4}}>{cartItems} item{cartItems!==1?"s":""} · {fmt(cartTotal)} pending</div>
                  {thisMonthSpend>0&&<div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>+{Math.round((cartTotal/(thisMonthSpend||1))*100)}% of {MONTHS[new Date().getMonth()]} spend</div>}
                </div>
                <button onClick={()=>router.push("/cart")}
                  style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                  View Cart
                </button>
              </div>
            )}

            {/* Monthly chart */}
            {monthlySpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:16}}>📈 Monthly Spending</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,marginBottom:8}}>
                  {monthlySpend.map((m,i)=>{
                    const h = Math.max(4,Math.round((m.amount/maxMonthly)*110));
                    const isMax = m.amount===maxMonthly;
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
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

            {/* Category breakdown — tappable */}
            {categorySpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>🥧 Spending by Category</div>
                <div style={{display:"flex",height:10,borderRadius:5,overflow:"hidden",marginBottom:14,gap:1}}>
                  {categorySpend.map(c=>(
                    <div key={c.category}
                      style={{width:`${c.pct}%`,background:CAT_COLORS[c.category]||"#AEAEB2",minWidth:c.pct>0?2:0}}/>
                  ))}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {categorySpend.map(c=>(
                    <button key={c.category} onClick={()=>setSheet({type:"cat",data:c})}
                      style={{all:"unset",display:"block",cursor:"pointer",width:"100%"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:CAT_COLORS[c.category]||"#AEAEB2",flexShrink:0}}/>
                          <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{c.category}</span>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:11,color:"var(--text3)"}}>{c.pct}%</span>
                          <span style={{fontSize:13,fontWeight:700,color:CAT_COLORS[c.category]||"var(--text)"}}>{fmt(c.amount)}</span>
                          <span style={{fontSize:11,color:"var(--text3)"}}>›</span>
                        </div>
                      </div>
                      <div style={{height:5,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${c.pct}%`,background:CAT_COLORS[c.category]||"#AEAEB2",borderRadius:3,transition:"width 0.5s"}}/>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Store breakdown — tappable */}
            {storeSpend.length>0&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>🏪 Spending by Store</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {storeSpend.map((s,i)=>(
                    <button key={s.store} onClick={()=>setSheet({type:"store",data:s})}
                      style={{all:"unset",display:"block",cursor:"pointer",width:"100%"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:"var(--text3)",minWidth:14}}>#{i+1}</span>
                          <span style={{fontSize:13,color:"var(--text)",fontWeight:600}}>{s.store}</span>
                          <span style={{fontSize:10,color:"var(--text3)"}}>{s.visits} visit{s.visits!==1?"s":""}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#FF9F0A"}}>{fmt(s.amount)}</span>
                          <span style={{fontSize:11,color:"var(--text3)"}}>›</span>
                        </div>
                      </div>
                      <div style={{height:6,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.round((s.amount/maxStore)*100)}%`,background:"linear-gradient(90deg,#FF9F0A,#D4800A)",borderRadius:3,transition:"width 0.5s"}}/>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Day heatmap */}
            {daySpend.some(d=>d.amount>0)&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:14}}>📅 Spending by Day</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
                  {daySpend.map((d,i)=>{
                    const h = Math.max(4,Math.round((d.amount/maxDay)*70));
                    const isMax = d.amount===maxDay&&d.amount>0;
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{width:"100%",height:h,borderRadius:"4px 4px 0 0",background:isMax?"linear-gradient(180deg,#0A84FF,#0060CC)":"var(--bg)",minHeight:4}}/>
                        <div style={{fontSize:9,fontWeight:600,color:isMax?"#0A84FF":"var(--text3)"}}>{d.day}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:8,textAlign:"center"}}>
                  Best day to shop: <span style={{fontWeight:600,color:"#0A84FF"}}>{(daySpend.filter(d=>d.amount>0).sort((a,b)=>a.amount-b.amount)[0]||{day:"—"}).day}</span>
                </div>
              </div>
            )}

            <div style={{background:"linear-gradient(135deg,rgba(255,159,10,0.08),rgba(255,159,10,0.02))",border:"1px solid rgba(255,159,10,0.2)",borderRadius:14,padding:"16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:2}}>📈 More data = Better insights</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>Scan all your bills for complete analytics</div>
              </div>
              <Button size="sm" onClick={()=>router.push("/scan")} style={{flexShrink:0}}>🧾 Scan</Button>
            </div>
          </>
        )}
    </AnalyticsTemplate>

      {/* Bottom sheet drilldown */}
      <BottomSheet open={!!sheet} onClose={()=>setSheet(null)} label="Detail">
          {sheet?.type==="cat"&&(()=>{
              const c = sheet.data as CategorySpend;
              const color = CAT_COLORS[c.category]||"#AEAEB2";
              return (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:color}}/>
                      <span style={{fontSize:17,fontWeight:800,color:"var(--text)"}}>{c.category}</span>
                    </div>
                    <button onClick={()=>setSheet(null)} style={{background:"none",border:"none",fontSize:18,color:"var(--text3)",cursor:"pointer"}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
                    <div style={{background:"var(--bg)",borderRadius:12,padding:"12px"}}>
                      <div style={{fontSize:18,fontWeight:800,color}}>{fmt(c.amount)}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Total Spent</div>
                    </div>
                    <div style={{background:"var(--bg)",borderRadius:12,padding:"12px"}}>
                      <div style={{fontSize:18,fontWeight:800,color:"var(--text)"}}>{c.pct}%</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>of Budget</div>
                    </div>
                  </div>
                  {c.topItems.length>0&&(
                    <>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Top Items</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {c.topItems.map((item,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--bg)",borderRadius:10,padding:"10px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:11,fontWeight:700,color:"var(--text3)",minWidth:16}}>#{i+1}</span>
                              <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{item.name}</span>
                            </div>
                            <span style={{fontSize:13,fontWeight:700,color}}>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
            {sheet?.type==="store"&&(()=>{
              const s = sheet.data as StoreSpend;
              return (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <span style={{fontSize:17,fontWeight:800,color:"var(--text)"}}>{s.store}</span>
                    <button onClick={()=>setSheet(null)} style={{background:"none",border:"none",fontSize:18,color:"var(--text3)",cursor:"pointer"}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[
                      {l:"Total Spent",v:fmt(s.amount),c:"#FF9F0A"},
                      {l:"Visits",v:s.visits,c:"#30D158"},
                      {l:"Avg/Visit",v:fmt(s.avgPerVisit),c:"#0A84FF"},
                    ].map(item=>(
                      <div key={item.l} style={{background:"var(--bg)",borderRadius:12,padding:"12px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:800,color:item.c}}>{item.v}</div>
                        <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{item.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:16,background:"var(--bg)",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.round((s.amount/Math.max(...storeSpend.map(x=>x.amount),1))*100)}%`,background:"linear-gradient(90deg,#FF9F0A,#D4800A)",borderRadius:4}}/>
                    </div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:6,textAlign:"center"}}>vs top store spend</div>
                  </div>
                </>
              );
            })()}
      </BottomSheet>
    </>
  );
}
