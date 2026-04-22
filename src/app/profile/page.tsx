"use client";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getLevel } from "@/lib/utils";
import { supabaseAuth } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const AVATARS = ["🧑‍🍳","👩‍🛒","🧔","👩‍🌾","🧑‍💼","👨‍🍳","🙋‍♀️","🤵","👩‍💻","🧑‍🔬","👩‍🎨","🧑‍🚀"];
const CURRENCIES = [
  {value:"USD",label:"USD ($)"},{value:"GBP",label:"GBP (£)"},
  {value:"CAD",label:"CAD (CA$)"},{value:"AED",label:"AED (د.إ)"},
  {value:"INR",label:"INR (₹)"},{value:"SGD",label:"SGD (S$)"},
  {value:"AUD",label:"AUD (A$)"},{value:"EUR",label:"EUR (€)"},
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [name, setName] = useState(user?.name||"");
  const [avatar, setAvatar] = useState(user?.avatar||"🧑‍🍳");
  const [currency, setCurrency] = useState(user?.currency||"USD");
  const [theme, setTheme] = useState(user?.theme||"light");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    setUser({ ...user!, name:name.trim(), avatar, currency, theme: theme as any });
    toast.success("✅ Profile updated!");
    setSaving(false);
  }

  async function logout() {
    await supabaseAuth.auth.signOut();
    window.location.href = "/auth";
  }

  const level = getLevel(user?.points||0);
  const nextLevel = [
    ["🌱 Newcomer",0],["👀 Spotter",50],["🎯 Hunter",150],
    ["⭐ Expert",300],["🏆 Hero",500],["✦ Legend",1000],
  ];
  const currentIdx = nextLevel.findIndex(([l]) => l === level);
  const nextTarget = nextLevel[Math.min(currentIdx+1, nextLevel.length-1)][1] as number;
  const progress = Math.min(100, Math.round(((user?.points||0) / nextTarget) * 100));

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text)" }}>My Profile</h1>
          <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Manage your account and preferences</p>
        </div>

        {/* Level Card */}
        <div style={{ background:"linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.04))", border:"1px solid rgba(245,166,35,0.3)", borderRadius:16, padding:"20px", marginBottom:20, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:8 }}>{avatar}</div>
          <div style={{ fontSize:20, fontWeight:900, color:"var(--text)", marginBottom:4 }}>{user?.name}</div>
          <div style={{ fontSize:14, color:"var(--gold)", fontWeight:700, marginBottom:12 }}>{level}</div>
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginBottom:14 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:"var(--gold)" }}>{user?.points||0}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)" }}>Points</div>
            </div>
            <div style={{ width:1, background:"var(--border)" }} />
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:"var(--teal)" }}>{nextTarget}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)" }}>Next Level</div>
            </div>
          </div>
          <div style={{ height:8, background:"var(--surf2)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress}%`, borderRadius:4, background:"linear-gradient(90deg,var(--gold),var(--gold-dim))", transition:"width 1s" }} />
          </div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:6 }}>{progress}% to next level</div>
        </div>

        {/* Edit Form */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:14 }}>Edit Profile</div>

          <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" as const, marginBottom:6 }}>Display Name</div>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{ marginBottom:14 }} />

          <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" as const, marginBottom:8 }}>Avatar</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
            {AVATARS.map(a=>(
              <div key={a} onClick={()=>setAvatar(a)} style={{ width:44, height:44, borderRadius:11, background:avatar===a?"rgba(245,166,35,0.12)":"var(--surf2)", border:`2px solid ${avatar===a?"var(--gold)":"var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer" }}>{a}</div>
            ))}
          </div>

          <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" as const, marginBottom:8 }}>Theme</div>
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            {(["dark","light","auto"] as const).map(t=>(
              <button key={t} onClick={()=>setTheme(t)} style={{ flex:1, padding:"8px", fontSize:12, fontWeight:700, cursor:"pointer", borderRadius:9, border:"none", background:theme===t?"rgba(245,166,35,0.12)":"var(--surf2)", color:theme===t?"var(--gold)":"var(--text-muted)", outline:theme===t?"1px solid rgba(245,166,35,0.35)":"1px solid var(--border)" }}>
                {t==="dark"?"🌙 Dark":t==="light"?"☀️ Light":"⚙️ Auto"}
              </button>
            ))}
          </div>

          <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" as const, marginBottom:6 }}>Currency</div>
          <select className="input" value={currency} onChange={e=>setCurrency(e.target.value)} style={{ marginBottom:16, cursor:"pointer" }}>
            {CURRENCIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <button onClick={save} disabled={saving} className="btn-gold" style={{ width:"100%", padding:13, fontSize:14, opacity:saving?0.7:1 }}>
            {saving?"Saving...":"Save Changes"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:14 }}>Account Stats</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { l:"Location", v:`${user?.city||"—"} ${user?.zip||""}` },
              { l:"Currency", v:user?.currency||"USD" },
              { l:"Member Since", v:"Apr 2026" },
              { l:"App Version", v:"1.0.0 PWA" },
            ].map(s=>(
              <div key={s.l} style={{ background:"var(--surf2)", borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button onClick={logout} style={{ width:"100%", padding:14, background:"rgba(255,71,87,0.08)", border:"1px solid rgba(255,71,87,0.3)", color:"var(--red)", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer" }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
