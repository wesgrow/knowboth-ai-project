"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { getFreshness, STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";

const LEADERBOARD = [
  { name:"Priya K.", saved:124.50, level:"🏆 Hero" },
  { name:"Raj M.", saved:98.20, level:"⭐ Expert" },
  { name:"Anita S.", saved:76.80, level:"⭐ Expert" },
  { name:"Kumar P.", saved:54.30, level:"🎯 Hunter" },
  { name:"Deepa R.", saved:42.10, level:"🎯 Hunter" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, cart, pantry } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiTip, setAiTip] = useState("");
  const currency = user?.currency||"USD";
  const fmt = (n:number) => formatCurrency(n,currency);

  useEffect(()=>{ fetchDeals(); loadTip(); },[]);

  async function fetchDeals() {
    const{data:dealRows}=await supabase.from("deals").select("id,sale_end,brand_id").eq("status","approved");
    if(!dealRows?.length){setLoading(false);return;}
    const dealIds=dealRows.map((d:any)=>d.id);
    const brandIds=[...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))] as string[];
    const{data:brands}=await supabase.from("brands").select("id,name,slug").in("id",brandIds);
    const{data:items}=await supabase.from("deal_items").select("id,deal_id,name,price,regular_price,unit,category,created_at").in("deal_id",dealIds).order("created_at",{ascending:false}).limit(6);
    const bMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
    const dMap:Record<string,any>={};dealRows.forEach((d:any)=>{dMap[d.id]=d;});
    setDeals((items||[]).map((i:any)=>({...i,deal:dMap[i.deal_id],brand:bMap[dMap[i.deal_id]?.brand_id]})));
    setLoading(false);
  }

  function loadTip() {
    const tips=["Toor Dal prices drop mid-week. Best day to buy: Tuesday at Patel Brothers.","Basmati Rice 20lb is 21% cheaper at Patel Brothers vs India Bazaar this week.","Ghee prices rising. Stock up now — India Bazaar has lowest at $11.49.","Your pantry shows low Chakki Atta. Apna Bazar has it for $9.99.","You saved $6.60 more than last week. Keep comparing before every shop!"];
    setAiTip(tips[new Date().getDay()%tips.length]);
  }

  const lowStock=pantry.filter(p=>p.qty<=1);
  const cartCount=cart.filter(i=>!i.purchased).length;
  const expiring=deals.filter(d=>{if(!d.deal?.sale_end)return false;return Math.ceil((new Date(d.deal.sale_end).getTime()-Date.now())/86400000)<=2;});

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container">

        {/* Welcome */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:24,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.6}}>Hi, {user?.name?.split(" ")[0]} {user?.avatar}</div>
          <div style={{fontSize:13,color:"#6D6D72",marginTop:3}}>{getLevel(user?.points||0)} · ✦ {user?.points||0} pts · 📍 {user?.city||user?.zip||"Set location"}</div>
        </div>

        {/* Summary stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
          {[{l:"Cart",v:cartCount,i:"🛒",c:"#FF9F0A",h:"/cart"},{l:"Low Stock",v:lowStock.length,i:"⚠️",c:"#FF3B30",h:"/stock"},{l:"Expiring",v:expiring.length,i:"⏰",c:"#FF9F0A",h:"/deals"}].map(s=>(
            <div key={s.l} onClick={()=>router.push(s.h)} style={{background:"#fff",borderRadius:14,padding:"14px 10px",textAlign:"center",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
              <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* AI Tip */}
        <div style={{background:"linear-gradient(135deg,rgba(255,159,10,0.08),rgba(255,159,10,0.02))",border:"1px solid rgba(255,159,10,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:"#FF9F0A",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6}}>🤖 AI Smart Tip</div>
          <div style={{fontSize:13,color:"#1C1C1E",lineHeight:1.6}}>{aiTip}</div>
          <button onClick={loadTip} style={{background:"none",border:"none",color:"#FF9F0A",fontSize:11,fontWeight:600,cursor:"pointer",marginTop:6,padding:0}}>🔄 New tip</button>
        </div>

        {/* Savings */}
        <div style={{background:"#fff",borderRadius:14,padding:"16px",marginBottom:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const}}>💰 This Month</div>
              <div style={{fontSize:26,fontWeight:700,color:"#30D158",marginTop:4,letterSpacing:-0.8}}>{fmt(47.30)} saved</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#30D158"}}>↑ {fmt(9.20)} vs last month</div>
              <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{fmt(38.10)} last month</div>
            </div>
          </div>
          <div style={{height:6,background:"#F2F2F7",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:"32%",background:"linear-gradient(90deg,#30D158,#25A244)",borderRadius:3}} />
          </div>
          <div style={{fontSize:11,color:"#AEAEB2",marginTop:5}}>32% of monthly savings goal</div>
        </div>

        {/* Low stock alert */}
        {lowStock.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",letterSpacing:-0.2}}>⚠️ Low Stock</div>
              <button onClick={()=>router.push("/stock")} style={{background:"none",border:"none",fontSize:13,color:"#FF9F0A",cursor:"pointer",fontWeight:600}}>View all →</button>
            </div>
            <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              {lowStock.slice(0,3).map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#AEAEB2",marginTop:1}}>{item.store}</div>
                  </div>
                  <span style={{background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:600}}>{item.qty} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Deals */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",letterSpacing:-0.2}}>🔥 Latest Deals</div>
          <button onClick={()=>router.push("/deals")} style={{background:"none",border:"none",fontSize:13,color:"#FF9F0A",cursor:"pointer",fontWeight:600}}>View all →</button>
        </div>
        {loading&&<div style={{textAlign:"center",padding:"30px 0",color:"#AEAEB2",fontSize:13}}>Loading...</div>}
        <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:20}}>
          {deals.map((item,idx)=>{
            const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
            const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
            return(
              <div key={item.id} onClick={()=>router.push("/deals")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:idx<deals.length-1?"0.5px solid #F2F2F7":"none",cursor:"pointer"}}>
                <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}} />
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

        {/* Leaderboard */}
        <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",letterSpacing:-0.2,marginBottom:10}}>🏆 Top Savers Near You</div>
        <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          {LEADERBOARD.map((p,i)=>(
            <div key={p.name} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<LEADERBOARD.length-1?"0.5px solid #F2F2F7":"none",background:i===2?"rgba(255,159,10,0.02)":"transparent"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:i===0?"rgba(255,159,10,0.12)":i===1?"rgba(174,174,178,0.15)":"rgba(224,137,24,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?"#FF9F0A":i===1?"#AEAEB2":"#e08918",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{i===2?`${user?.name||p.name} (You)`:p.name}{i===2&&<span style={{fontSize:9,background:"rgba(255,159,10,0.12)",color:"#FF9F0A",borderRadius:20,padding:"1px 6px",marginLeft:6,fontWeight:700}}>YOU</span>}</div>
                <div style={{fontSize:11,color:"#AEAEB2"}}>{p.level}</div>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#30D158"}}>{fmt(p.saved)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
