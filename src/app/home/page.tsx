"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";
import { HomeTemplate } from "@/templates/HomeTemplate";
import { Button, Card, Skeleton, Badge } from "@/ui";

export default function HomePage() {
  const router = useRouter();
  const { user, cart, updateBudget, monthly_budget } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [thisMonthSpent, setThisMonthSpent] = useState(0);
  const [lastMonthSpent, setLastMonthSpent] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [tip, setTip] = useState("Compare prices before shopping — deals change weekly.");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);
  const cartCount = cart?.filter((i:any) => !i.purchased)?.length || 0;

  useEffect(() => { fetchStats(); fetchDeals(); rotateTip(); }, []);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const { data:{ session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split("T")[0];
      const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const [{ data: thisMonth }, { data: lastMonth }, { count: bills }] = await Promise.all([
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", thisMonthStart),
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", lastMonthStart).lte("purchase_date", lastMonthEnd),
        supabase.from("expenses").select("id", { count:"exact", head:true }).eq("user_id", userId),
      ]);

      setThisMonthSpent((thisMonth||[]).reduce((s:number,e:any)=>s+Number(e.total),0));
      setLastMonthSpent((lastMonth||[]).reduce((s:number,e:any)=>s+Number(e.total),0));
      setTotalBills(bills||0);

      const { data: latestExp } = await supabase
        .from("expenses").select("id,store_name,purchase_date")
        .eq("user_id", userId).order("purchase_date",{ascending:false}).limit(1).single();
      if (latestExp?.id) {
        const { data: latestItems } = await supabase.from("expense_items")
          .select("id,name,quantity,unit,category")
          .eq("expense_id", latestExp.id)
          .in("category",["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"])
          .limit(5);
        setRecentItems((latestItems||[]).map((i:any)=>({...i,store:latestExp.store_name,date:latestExp.purchase_date})));
      }

      const { data: dealRows } = await supabase.from("deals").select("id,sale_end").eq("status","approved").not("sale_end","is",null);
      setExpiringCount((dealRows||[]).filter((d:any)=>{
        const days = Math.ceil((new Date(d.sale_end).getTime()-Date.now())/86400000);
        return days>=0&&days<=3;
      }).length);
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

  async function saveBudget() {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) return;
    updateBudget(val);
    setEditingBudget(false);
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (session?.user?.id) {
      await supabase.from("user_profiles").update({ monthly_budget: val }).eq("user_id", session.user.id);
    }
  }

  function rotateTip() {
    const tips = [
      "Compare prices before shopping — deals change weekly.",
      "Scan your bills to track spending patterns over time.",
      "Check expiring deals before they disappear.",
      "Buy lentils and rice in bulk for maximum savings.",
      "Use the Expenses page to spot your biggest spending categories.",
      "Add items to cart before shopping to stay on budget.",
    ];
    setTip(tips[new Date().getDay() % tips.length]);
  }

  const spendDiff = thisMonthSpent - lastMonthSpent;
  const spendPct  = lastMonthSpent > 0 ? Math.abs(Math.round((spendDiff/lastMonthSpent)*100)) : 0;
  const isNewUser = !loadingStats && totalBills === 0;
  const level = getLevel(user?.points||0);

  return (
    <HomeTemplate>
      <style>{`
        .stat-card{background:var(--surf);border-radius:16px;padding:16px 10px;text-align:center;cursor:pointer;box-shadow:var(--shadow);transition:transform .18s,box-shadow .18s}
        .action-btn{background:var(--surf);border:none;border-radius:16px;padding:16px;cursor:pointer;box-shadow:var(--shadow);display:flex;align-items:center;gap:12px;transition:transform .18s,box-shadow .18s;width:100%}
        .deal-row{transition:background .15s;cursor:pointer}
        .trust-badge{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:var(--surf);border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap}
        .step-card{flex:1;background:var(--surf);border-radius:14px;padding:16px 12px;text-align:center;box-shadow:var(--shadow);min-width:0}
        .steps-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
        .expiring-pulse{animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @media(max-width:360px){.steps-row{grid-template-columns:1fr;gap:8px}}
        @media(min-width:769px){.home-inner{padding:24px 28px}}
        @media(hover:hover) and (pointer:fine){
          .stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.12)}
          .action-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.12)}
          .deal-row:hover{background:rgba(255,159,10,.04)}
        }
        @media(hover:none){
          .stat-card:hover,.action-btn:hover{transform:none!important;box-shadow:var(--shadow)!important}
          .deal-row:hover{background:transparent!important}
        }
        @media(prefers-reduced-motion:reduce){.expiring-pulse{animation:none!important}}
      `}</style>
      
      {/* Hero */}
      <div className="fade-up" style={{marginBottom:24}}>
        <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:-0.8,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          Hi, {user?.name?.split(" ")[0]||"there"} {user?.avatar}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:6,marginBottom:16}}>
          <span style={{fontSize:13,color:"var(--text2)"}}>{level}</span>
          <span style={{width:3,height:3,borderRadius:"50%",background:"var(--text3)"}}/>
          <span style={{fontSize:13,color:"var(--text2)"}}>✦ {user?.points||0} pts</span>
          <span style={{width:3,height:3,borderRadius:"50%",background:"var(--text3)"}}/>
          <span style={{fontSize:13,color:"var(--text2)"}}>📍 {user?.city||"DFW"}</span>
        </div>
        {/* Quick actions */}
      <div className="fade-up" style={{animationDelay:"0.28s",marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:10}}>⚡ Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {[
            {l:"Scan Bill",      i:"🧾", h:"/scan",      c:"#FF9F0A"},
            {l:"Post Deal",      i:"📷", h:"/post-deal", c:"#30D158"},
            {l:"Compare Prices", i:"⚖️", h:"/deals",     c:"#0A84FF"},
            {l:"View Expenses",  i:"📊", h:"/expenses",  c:"#FF9F0A"},
          ].map(a=>(
            <button key={a.l} className="action-btn" onClick={()=>router.push(a.h)} aria-label={a.l}>
              <div style={{width:42,height:42,borderRadius:12,background:`${a.c}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{a.i}</div>
              <span style={{fontSize:14,fontWeight:600,color:"var(--text)",textAlign:"left"}}>{a.l}</span>
            </button>
          ))}
        </div>
      </div>
     </div>

      {/* Quick stats */}
      <div className="fade-up" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:24,animationDelay:"0.06s"}}>
        {[
          {l:"Cart",     v:cartCount,    i:"🛒", c:"var(--gold)", h:"/cart"},
          {l:"Bills",    v:totalBills,   i:"🧾", c:"var(--text)", h:"/expenses"},
          {l:"Expiring", v:expiringCount,i:"⏰", c:"var(--red)",  h:"/deals"},
        ].map(s=>(
          <div key={s.l} className="stat-card" onClick={()=>router.push(s.h)} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&router.push(s.h)} aria-label={`${s.l}: ${s.v}`}>
            <div style={{fontSize:22,marginBottom:6}}>{s.i}</div>
            {loadingStats
              ? <Skeleton h={28} w="50%" style={{margin:"0 auto 4px"}}/>
              : <div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1}} className={s.l==="Expiring"&&expiringCount>0?"expiring-pulse":""}>{s.v}</div>
            }
            <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* New user onboarding */}
      {isNewUser&&(
        <div className="fade-up" style={{animationDelay:"0.1s",marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>How it works</div>
          <div className="steps-row">
            {[
              {i:"📸",t:"Scan Bill",d:"Upload your grocery receipt"},
              {i:"📊",t:"Track Spending",d:"See where your money goes"},
              {i:"💰",t:"Save More",d:"Catch deals before they expire"},
            ].map((step,idx)=>(
              <div key={idx} className="step-card">
                <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,159,10,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,margin:"0 auto 8px"}}>{step.i}</div>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:3}}>{step.t}</div>
                <div style={{fontSize:11,color:"var(--text3)",lineHeight:1.4}}>{step.d}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["🔒 No bank login","🤖 AI-powered","🛡️ Private","🇮🇳 South Asian groceries"].map(b=>(
              <span key={b} className="trust-badge">{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* This month */}
      {!isNewUser&&(
        <Card className="fade-up" style={{marginBottom:20,animationDelay:"0.12s"}} pad={18} radius={18}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:10}}>💰 This Month</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
            <div>
              {loadingStats ? <Skeleton h={36} w={110} style={{marginBottom:4}}/> : <div style={{fontSize:30,fontWeight:800,color:"var(--gold)",letterSpacing:-1,lineHeight:1}}>{fmt(thisMonthSpent)}</div>}
              {loadingStats ? <Skeleton h={14} w={80} style={{marginTop:6}}/> : <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}><span style={{fontWeight:700,color:"var(--text)"}}>{totalBills}</span> bills scanned</div>}
            </div>
            {!loadingStats&&lastMonthSpent>0&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:spendDiff<=0?"var(--green)":"var(--red)"}}>{spendDiff<=0?"↓":"↑"} {spendPct}% vs last month</div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{fmt(lastMonthSpent)} last month</div>
              </div>
            )}
          </div>
          {!loadingStats&&lastMonthSpent>0&&spendDiff<0&&(
            <div style={{padding:"8px 12px",background:"rgba(48,209,88,.08)",border:"1px solid rgba(48,209,88,.2)",borderRadius:10,fontSize:12,color:"var(--green)",fontWeight:700,marginBottom:10}}>
              ✦ Saving {fmt(Math.abs(spendDiff))} more than last month
            </div>
          )}

          {/* Budget status */}
          {!loadingStats&&(()=>{
            const budget = monthly_budget;
            if (editingBudget) {
              return (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase",marginBottom:6}}>Monthly Budget</div>
                  <div style={{display:"flex",gap:8}}>
                    <input
                      type="number" min="1" step="1" autoFocus
                      value={budgetInput} onChange={e=>setBudgetInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")saveBudget();if(e.key==="Escape")setEditingBudget(false);}}
                      placeholder="e.g. 500"
                      style={{flex:1,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"9px 12px",fontSize:15,color:"var(--text)",outline:"none",fontFamily:"inherit"}}
                    />
                    <button onClick={saveBudget} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>Save</button>
                    <button onClick={()=>setEditingBudget(false)} style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"9px 12px",fontSize:14,color:"var(--text2)",cursor:"pointer",flexShrink:0}}>✕</button>
                  </div>
                </div>
              );
            }
            if (!budget) {
              return (
                <button onClick={()=>{setBudgetInput("");setEditingBudget(true);}}
                  style={{width:"100%",marginBottom:10,padding:"9px 12px",background:"none",border:"1px dashed var(--border)",borderRadius:10,fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer",textAlign:"left"}}>
                  + Set Monthly Budget
                </button>
              );
            }
            const pct = Math.min(100, Math.round((thisMonthSpent/budget)*100));
            const remaining = budget - thisMonthSpent;
            const over = remaining < 0;
            const barColor = pct >= 100 ? "var(--red)" : pct >= 80 ? "#FF9F0A" : "var(--green)";
            return (
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase"}}>Monthly Budget</div>
                  <button onClick={()=>{setBudgetInput(String(budget));setEditingBudget(true);}}
                    style={{background:"none",border:"none",fontSize:12,color:"var(--text3)",cursor:"pointer",padding:"2px 4px"}}>✎ Edit</button>
                </div>
                <div style={{height:8,background:"var(--bg)",borderRadius:6,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:6,transition:"width 0.5s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:over?"var(--red)":barColor}}>
                    {over ? `Over by ${fmt(Math.abs(remaining))}` : `${fmt(remaining)} left`}
                  </div>
                  <div style={{fontSize:11,color:"var(--text3)"}}>{pct}% of {fmt(budget)}</div>
                </div>
              </div>
            );
          })()}

          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <Button variant="link" size="sm" onClick={()=>router.push("/expenses")}>View all expenses →</Button>
          </div>
        </Card>
      )}

      {/* Daily tip */}
      <div className="fade-up" style={{background:"linear-gradient(135deg,rgba(255,159,10,.07),rgba(255,159,10,.02))",border:"1px solid rgba(255,159,10,.18)",borderRadius:14,padding:"13px 16px",marginBottom:20,animationDelay:"0.16s"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"var(--gold)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:4}}>💡 Daily Tip</div>
            <div style={{fontSize:13,color:"var(--text)",lineHeight:1.6}}>{tip}</div>
          </div>
          <Button variant="ghost" size="xs" onClick={rotateTip} style={{flexShrink:0,border:"1px solid rgba(255,159,10,.3)",color:"var(--gold)"}}>↻ Next</Button>
        </div>
      </div>

      {/* Recent purchases */}
      {recentItems.length>0&&(
        <div className="fade-up" style={{marginBottom:20,animationDelay:"0.2s"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>🛍️ Last Bill — <span style={{color:"var(--text2)",fontWeight:600}}>{recentItems[0]?.store}</span></div>
            <Button variant="link" size="sm" onClick={()=>router.push("/stock")}>View all →</Button>
          </div>
          <Card pad={0} style={{overflow:"hidden"}}>
            {recentItems.map((item:any,i:number)=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<recentItems.length-1?"0.5px solid var(--border2)":"none"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{item.category}</div>
                </div>
                <span style={{background:"var(--bg)",color:"var(--text2)",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:600,flexShrink:0}}>× {item.quantity}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Latest deals */}
      <div className="fade-up" style={{animationDelay:"0.24s"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>🔥 Latest Deals</div>
          <Button variant="link" size="sm" onClick={()=>router.push("/deals")}>View all →</Button>
        </div>

        {loadingDeals&&(
          <Card pad={0} style={{overflow:"hidden",marginBottom:20}}>
            {[...Array(4)].map((_,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<3?"0.5px solid var(--border2)":"none"}}>
                <Skeleton h={36} w={3} radius={2}/>
                <div style={{flex:1}}>
                  <Skeleton h={14} w="60%" style={{marginBottom:6}}/>
                  <Skeleton h={11} w="35%"/>
                </div>
                <Skeleton h={20} w={40}/>
              </div>
            ))}
          </Card>
        )}

        {!loadingDeals&&deals.length===0&&(
          <Card style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:32,marginBottom:8}}>🏷️</div>
            <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:4}}>No deals yet</div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:14}}>Be the first to post a deal from a store flyer</div>
            <Button onClick={()=>router.push("/post-deal")}>📷 Post First Deal</Button>
          </Card>
        )}

        {deals.length>0&&(
          <Card pad={0} style={{overflow:"hidden",marginBottom:20}}>
            {deals.map((item,idx)=>{
              const color = STORE_COLORS[item.brand?.slug]||"#FF9F0A";
              const sav = item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
              return(
                <div key={item.id} className="deal-row" onClick={()=>router.push("/deals")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&router.push("/deals")}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:idx<deals.length-1?"0.5px solid var(--border2)":"none"}}>
                  <div style={{width:3,height:38,borderRadius:2,background:color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                      <span style={{fontSize:11,color:"var(--text3)"}}>{item.brand?.name}</span>
                      {item.category&&<span style={{fontSize:10,color:"var(--text3)",background:"var(--bg)",borderRadius:6,padding:"1px 6px"}}>{item.category}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:800,color:"var(--gold)"}}>${item.price?.toFixed(2)}</div>
                    {sav&&<div style={{fontSize:10,color:"var(--green)",fontWeight:700,marginTop:1}}>-{sav}% off</div>}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>


      {/* Footer */}
      <footer className="fade-up" style={{animationDelay:"0.32s",borderTop:"1px solid var(--border2)",paddingTop:18,textAlign:"center"}}>
        <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>
          © {new Date().getFullYear()} KnowBoth.AI — Smart grocery tracking for your community
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          {[{l:"Privacy",h:"/privacy"},{l:"Feedback",h:"mailto:dineshraina.94@gmail.com"},{l:"Deals",h:"/deals"},{l:"Scan Bill",h:"/scan"}].map(lnk=>(
            <a key={lnk.l} href={lnk.h} style={{fontSize:12,color:"var(--text3)",textDecoration:"none",fontWeight:500}}>{lnk.l}</a>
          ))}
        </div>
      </footer>
    </HomeTemplate>
  );
}
