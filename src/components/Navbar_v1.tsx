"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function Navbar() {
  const pathname = usePathname();
  const { user, updateLocation, updateTheme } = useAppStore();
  const [editLoc, setEditLoc] = useState(false);
  const [zip, setZip] = useState(user?.zip||"");
  const [city, setCity] = useState(user?.city||"");
  const cart = useAppStore(s=>s.cart);
  const pending = cart.filter(i=>!i.purchased).length;

  const tabs = [
    { href:"/deals", label:"Deals", icon:"🏷️" },
    { href:"/compare", label:"Compare", icon:"⚖️" },
    { href:"/cart", label:"Cart", icon:"🛒", badge:pending },
    { href:"/scan", label:"Scan", icon:"🧾" },
    { href:"/pantry", label:"Pantry", icon:"🏠" },
    { href:"/expenses", label:"Expenses", icon:"📊" },
  ];

  if(!user) return null;

  return (
    <>
      <header style={{position:"sticky",top:0,zIndex:100,background:"var(--surf)",borderBottom:"1px solid var(--border)",padding:"10px 16px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Link href="/deals" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:18,color:"var(--gold)"}}>✦</span>
            <span style={{fontSize:16,fontWeight:900,color:"var(--text)"}}>KNOWBOTH</span>
            <span style={{fontSize:16,fontWeight:900,color:"var(--teal)"}}>.AI</span>
          </Link>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setEditLoc(!editLoc)} style={{background:"var(--surf2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 10px",fontSize:11,color:"var(--text-muted)",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
              📍 {user.city||user.zip||"Set Location"}
            </button>
            <select value={user.theme} onChange={e=>updateTheme(e.target.value as any)} style={{background:"var(--surf2)",border:"1px solid var(--border)",borderRadius:8,padding:"4px 8px",fontSize:11,color:"var(--text-muted)",cursor:"pointer"}}>
              <option value="dark">🌙</option>
              <option value="light">☀️</option>
              <option value="auto">⚙️</option>
            </select>
            <div style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,color:"var(--gold)",fontWeight:700}}>
              ✦ {user.points||0} pts
            </div>
            <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(245,166,35,0.15)",border:"1.5px solid rgba(245,166,35,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
              {user.avatar}
            </div>
          </div>
        </div>
        {editLoc && (
          <div style={{maxWidth:800,margin:"10px auto 0",display:"flex",gap:8,alignItems:"center"}}>
            <input className="input" value={city} onChange={e=>setCity(e.target.value)} placeholder="City" style={{flex:1}} />
            <input className="input" value={zip} onChange={e=>setZip(e.target.value)} placeholder="ZIP" style={{width:100}} />
            <button className="btn-gold" style={{padding:"8px 14px",fontSize:12}} onClick={()=>{updateLocation(zip,city);setEditLoc(false);}}>Save</button>
          </div>
        )}
      </header>
      <nav style={{position:"sticky",bottom:0,zIndex:100,background:"var(--surf)",borderTop:"1px solid var(--border)",display:"flex"}}>
        {tabs.map(t=>(
          <Link key={t.href} href={t.href} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 4px",textDecoration:"none",color:pathname===t.href?"var(--gold)":"var(--text-dim)",fontSize:10,fontWeight:600,position:"relative"}}>
            <span style={{fontSize:18}}>{t.icon}</span>
            {t.label}
            {t.badge ? <span style={{position:"absolute",top:4,right:6,background:"var(--gold)",color:"#000",fontSize:9,fontWeight:900,borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{t.badge>9?"9+":t.badge}</span> : null}
          </Link>
        ))}
      </nav>
    </>
  );
}
