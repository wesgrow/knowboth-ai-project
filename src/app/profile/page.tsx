"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { getLevel, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

const AVATARS = ["🧑‍🍳","👩‍🛒","🧔","👩‍🌾","🧑‍💼","👨‍🍳","🙋‍♀️","🤵","👩‍💻","🧑‍🔬","👩‍🎨","🧑‍🚀"];
const CURRENCIES = [
  {value:"USD",label:"USD ($)"},{value:"GBP",label:"GBP (£)"},
  {value:"CAD",label:"CAD (CA$)"},{value:"AED",label:"AED (د.إ)"},
  {value:"INR",label:"INR (₹)"},{value:"SGD",label:"SGD (S$)"},
  {value:"AUD",label:"AUD (A$)"},{value:"EUR",label:"EUR (€)"},
];
const LEVELS = [
  ["🌱 Newcomer",0],["👀 Spotter",50],["🎯 Hunter",150],
  ["⭐ Expert",300],["🏆 Hero",500],["✦ Legend",1000],
];

interface ProfileStats {
  totalBills: number;
  totalSpent: number;
  totalSaved: number;
  dealsPosted: number;
  billsThisMonth: number;
  topStore: string;
  topCategory: string;
  joinedDate: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [name, setName] = useState(user?.name||"");
  const [avatar, setAvatar] = useState(user?.avatar||"🧑‍🍳");
  const [currency, setCurrency] = useState(user?.currency||"USD");
  const [city, setCity] = useState(user?.city||"");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats|null>(null);
  const [activeTab, setActiveTab] = useState<"profile"|"stats"|"activity">("profile");
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const fmt = (n: number) => formatCurrency(n, currency);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data:{ session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) { router.push("/auth"); return; }

      const userId = session.user.id;
      const email = session.user.email || "";
      const joinedDate = new Date(session.user.created_at).toLocaleDateString("en-US",{month:"long",year:"numeric"});
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split("T")[0];

      const { data:expenses } = await supabase.from("expenses")
        .select("id,store_name,total,purchase_date,items_count")
        .eq("user_id", userId).order("purchase_date",{ascending:false});

      const billsThisMonth = (expenses||[]).filter(e => e.purchase_date >= thisMonthStart).length;
      const totalSpent = (expenses||[]).reduce((s:number,e:any)=>s+Number(e.total),0);
      const totalBills = expenses?.length || 0;

      const storeCount: Record<string,number> = {};
      (expenses||[]).forEach((e:any) => { storeCount[e.store_name]=(storeCount[e.store_name]||0)+1; });
      const topStore = Object.entries(storeCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

      const { data:savedItems } = await supabase.from("deal_items")
        .select("price,regular_price").not("regular_price","is",null);
      const totalSaved = (savedItems||[]).reduce((s:number,i:any)=>{
        const saving = Number(i.regular_price)-Number(i.price);
        return s+(saving>0?saving:0);
      },0);

      const { count:dealsPosted } = await supabase.from("deals")
        .select("id",{count:"exact",head:true}).eq("posted_by",userId);

      const expIds = (expenses||[]).slice(0,20).map((e:any)=>e.id);
      let topCategory = "—";
      if (expIds.length) {
        const { data:items } = await supabase.from("expense_items")
          .select("category").in("expense_id",expIds);
        const catCount: Record<string,number> = {};
        (items||[]).forEach((i:any)=>{ catCount[i.category]=(catCount[i.category]||0)+1; });
        topCategory = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
      }

      setStats({ totalBills, totalSpent, totalSaved, dealsPosted:dealsPosted||0, billsThisMonth, topStore, topCategory, joinedDate, email });
      setRecentBills((expenses||[]).slice(0,5));
    } catch(e:any) {
      console.error("Profile stats error:",e);
      toast.error("Failed to load profile stats");
    } finally {
      setLoading(false);
    }
  },[router]);

  useEffect(()=>{ fetchStats(); },[fetchStats]);

  async function save() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await supabaseAuth.auth.updateUser({ data:{ full_name:name.trim() } });
      setUser({...user!, name:name.trim(), avatar, currency, city});
      toast.success("✅ Profile saved!");
    } catch(e:any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabaseAuth.auth.signOut();
    window.location.href = "/auth";
  }

  const level = getLevel(user?.points||0);
  const currentIdx = LEVELS.findIndex(([l])=>l===level);
  const nextTarget = LEVELS[Math.min(currentIdx+1,LEVELS.length-1)][1] as number;
  const progress = Math.min(100, Math.round(((user?.points||0)/nextTarget)*100));

  return (
    <>
      <div className="page-body">
        <div className="page-content" style={{maxWidth:720}}>

          {/* Profile Hero */}
          <div className="fade-up" style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",borderRadius:20,padding:"24px 20px",marginBottom:16,textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
            <div style={{position:"absolute",bottom:-30,left:-10,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
            <div style={{fontSize:56,marginBottom:8}}>{avatar}</div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:-0.5}}>{user?.name||"User"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginTop:2}}>{stats?.email}</div>
            <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap" as const}}>
              <span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#fff"}}>{level}</span>
              <span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#fff"}}>✦ {user?.points||0} pts</span>
              {stats&&<span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#fff"}}>📅 Since {stats.joinedDate}</span>}
            </div>
            <div style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>Progress to next level</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>{progress}%</span>
              </div>
              <div style={{height:4,background:"rgba(255,255,255,0.2)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${progress}%`,background:"rgba(255,255,255,0.9)",borderRadius:2}}/>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          {loading&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
              {[1,2,3,4,5,6].map(i=><div key={i} className="skel" style={{height:70,borderRadius:14}}/>)}
            </div>
          )}
          {!loading&&stats&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
              {[
                {l:"Bills Scanned",v:stats.totalBills,i:"🧾"},
                {l:"Total Spent",v:fmt(stats.totalSpent),i:"💰"},
                {l:"Deals Posted",v:stats.dealsPosted,i:"📷"},
                {l:"This Month",v:stats.billsThisMonth+" bills",i:"📅"},
                {l:"Top Store",v:stats.topStore,i:"🏪"},
                {l:"Fav Category",v:stats.topCategory,i:"🛒"},
              ].map((s,idx)=>(
                <div key={s.l} className="fade-up" style={{background:"var(--surf)",borderRadius:14,padding:"12px",textAlign:"center",boxShadow:"var(--shadow)",animationDelay:`${idx*0.05}s`}}>
                  <div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)",letterSpacing:-0.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.v}</div>
                  <div style={{fontSize:9,color:"var(--text3)",marginTop:2,textTransform:"uppercase" as const,letterSpacing:0.3}}>{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{display:"flex",background:"var(--surf)",borderRadius:12,padding:3,gap:2,marginBottom:16,boxShadow:"var(--shadow)"}}>
            {([["profile","👤 Profile"],["activity","🧾 Activity"]] as const).map(([t,l])=>(
              <button key={t} onClick={()=>setActiveTab(t)} style={{flex:1,padding:"9px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:activeTab===t?"var(--bg)":"transparent",color:activeTab===t?"var(--text)":"var(--text3)",boxShadow:activeTab===t?"var(--shadow)":"none",transition:"all 0.2s"}}>
                {l}
              </button>
            ))}
          </div>

          {/* ── PROFILE TAB ── */}
          {activeTab==="profile"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>

              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:10}}>Choose Avatar</div>
                <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
                  {AVATARS.map(a=>(
                    <button key={a} onClick={()=>setAvatar(a)} style={{width:44,height:44,borderRadius:12,fontSize:24,border:`2px solid ${avatar===a?"#FF9F0A":"transparent"}`,background:avatar===a?"rgba(255,159,10,0.08)":"var(--bg)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:10}}>Personal Info</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.4,marginBottom:5}}>DISPLAY NAME</div>
                    <input style={{width:"100%",boxSizing:"border-box" as const,background:"var(--bg)",border:"1.5px solid var(--border)",borderRadius:10,padding:"11px 14px",fontSize:16,color:"var(--text)",outline:"none"}} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.4,marginBottom:5}}>CITY / AREA</div>
                    <input style={{width:"100%",boxSizing:"border-box" as const,background:"var(--bg)",border:"1.5px solid var(--border)",borderRadius:10,padding:"11px 14px",fontSize:16,color:"var(--text)",outline:"none"}} value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Dallas, TX"/>
                  </div>
                </div>
              </div>

              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:10}}>Preferences</div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.4,marginBottom:5}}>CURRENCY</div>
                  <select style={{width:"100%",background:"var(--bg)",border:"1.5px solid var(--border)",borderRadius:10,padding:"11px 14px",fontSize:16,color:"var(--text)",outline:"none",cursor:"pointer"}} value={currency} onChange={e=>setCurrency(e.target.value)}>
                    {CURRENCIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={save} disabled={saving} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:saving?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                {saving?"Saving...":"💾 Save Profile"}
              </button>

              <div style={{background:"var(--surf)",borderRadius:16,padding:"16px",boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:10}}>Account</div>
                <div style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>📧 {stats?.email}</div>
                <button onClick={logout} style={{width:"100%",padding:12,background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,fontSize:14,fontWeight:600,color:"#FF3B30",cursor:"pointer"}}>
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab==="activity"&&(
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:10}}>Recent Bills</div>
              {loading&&(
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {[1,2,3].map(i=><div key={i} className="skel" style={{height:60,borderRadius:12}}/>)}
                </div>
              )}
              {!loading&&recentBills.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:44,marginBottom:8}}>🧾</div>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:8}}>No bills yet</div>
                  <button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"10px 20px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>🧾 Scan First Bill</button>
                </div>
              )}
              {recentBills.length>0&&(
                <div style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:12}}>
                  {recentBills.map((bill,i)=>(
                    <div key={bill.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:i<recentBills.length-1?"0.5px solid var(--border2)":"none"}}>
                      <div style={{width:38,height:38,borderRadius:10,background:"rgba(255,159,10,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🧾</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{bill.store_name}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>📅 {bill.purchase_date} · {bill.items_count} items</div>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:"#FF9F0A",flexShrink:0}}>{fmt(Number(bill.total))}</div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={()=>router.push("/expenses")} style={{width:"100%",padding:12,background:"var(--surf)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#FF9F0A",cursor:"pointer",boxShadow:"var(--shadow)"}}>
                View All Expenses →
              </button>
            </div>
          )}

        </div>
      </div>

    </>
  );
}
