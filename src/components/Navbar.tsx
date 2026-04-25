"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { supabaseAuth } from "@/lib/supabase";
import { getLevel } from "@/lib/utils";

const RADII = [5,10,15,25,50];
const MORE_ITEMS = [
  { href:"/stock",     label:"Stock",     icon:"📦", color:"#30D158" },
  { href:"/expenses",  label:"Expenses",  icon:"📊", color:"#FF9F0A" },
  { href:"/analytics", label:"Analytics", icon:"📈", color:"#BF5AF2" },
  { href:"/community", label:"Community", icon:"👥", color:"#FF3B30" },
  { href:"/chat",      label:"AI Chat",   icon:"🤖", color:"#0A84FF" },
];
const TABS = [
  { href:"/home",  label:"Home",  icon:"🏠" },
  { href:"/deals", label:"Deals", icon:"🛍️" },
  { href:"/cart",  label:"Cart",  icon:"🛒", badge:true },
  { href:"/scan",  label:"Scan",  icon:"🧾" },
  { label:"More",  icon:"⋯",     more:true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, updateLocation, updateTheme } = useAppStore();
  const [showMore, setShowMore]       = useState(false);
  const [showLoc, setShowLoc]         = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [locInput, setLocInput]       = useState(user?`${user.city||""} ${user.zip||""}`.trim():"");
  const [radius, setRadius]           = useState((user as any)?.radius||15);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const cart = useAppStore(s=>s.cart);
  const pending = cart.filter(i=>!i.purchased).length;
  if(!user) return null;

  function saveLocation() {
    const parts=locInput.trim().split(/[\s,]+/);
    const zip=parts.find(p=>/^\d{5}/.test(p))||user?.zip||"";
    const city=parts.filter(p=>!/^\d/.test(p)).join(" ")||user?.city||"";
    updateLocation(zip,city); setShowLoc(false);
  }

  function useGPS() {
    if(!navigator.geolocation){alert("GPS not supported");return;}
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const{latitude,longitude}=pos.coords;
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data=await res.json();
        updateLocation(data.address?.postcode||"",data.address?.city||data.address?.town||"");
        setLocInput(`${data.address?.city||""} ${data.address?.postcode||""}`.trim());
      }catch{updateLocation("","Current Location");}
      setGpsLoading(false); setShowLoc(false);
    },()=>{alert("GPS denied");setGpsLoading(false);});
  }

  async function signOut(){ await supabaseAuth.auth.signOut(); window.location.href="/auth"; }

  return(
    <>
      <style>{`
        .nb{background:#fff;border-bottom:0.5px solid rgba(0,0,0,0.1);padding:0 14px;height:54px;display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:100;}
        .nb-logo{display:flex;align-items:center;gap:7px;text-decoration:none;flex-shrink:0;}
        .nb-logo-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#FF9F0A,#D4800A);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(255,159,10,0.3);}
        .nb-name{font-size:18px;font-weight:800;letter-spacing:-0.8px;color:#1C1C1E;white-space:nowrap;}
        .nb-name b{color:#FF9F0A;}
        .nb-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;}
        .nb-btn{width:36px;height:36px;border-radius:50%;background:#F2F2F7;border:none;display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;position:relative;flex-shrink:0;}
        .nb-btn:active{background:#E5E5EA;}
        .nb-bdg{position:absolute;top:1px;right:1px;background:#FF3B30;color:#fff;font-size:9px;font-weight:700;border-radius:8px;min-width:15px;height:15px;display:flex;align-items:center;justify-content:center;padding:0 3px;border:1.5px solid #fff;}
        .loc-panel{background:#fff;border-bottom:0.5px solid rgba(0,0,0,0.08);padding:10px 14px 14px;}
        .loc-row{display:flex;gap:8px;margin-bottom:10px;}
        .loc-input{flex:1;background:#F2F2F7;border:none;border-radius:10px;padding:10px 14px;font-size:14px;color:#1C1C1E;outline:none;}
        .gps-btn{background:rgba(48,209,88,0.1);border:none;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:600;color:#30D158;cursor:pointer;}
        .save-btn{background:linear-gradient(135deg,#FF9F0A,#D4800A);border:none;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;color:#fff;cursor:pointer;}
        .r-row{display:flex;gap:6px;}
        .r-pill{flex:1;padding:7px 4px;border-radius:10px;font-size:12px;font-weight:600;text-align:center;cursor:pointer;border:none;background:#F2F2F7;color:#6D6D72;}
        .r-pill.on{background:rgba(255,159,10,0.12);color:#FF9F0A;box-shadow:0 0 0 1.5px #FF9F0A;}
        .prof-overlay{position:fixed;inset:0;z-index:300;}
        .prof-sheet{position:absolute;top:58px;right:14px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);width:220px;overflow:hidden;}
        .prof-head{padding:14px 16px;border-bottom:0.5px solid #F2F2F7;display:flex;align-items:center;gap:10px;}
        .prof-av{font-size:30px;}
        .prof-name{font-size:15px;font-weight:700;color:#1C1C1E;letter-spacing:-0.3px;}
        .prof-lvl{font-size:11px;color:#AEAEB2;margin-top:1px;}
        .pmenu{display:flex;align-items:center;gap:10px;padding:12px 16px;border:none;background:#fff;width:100%;text-align:left;font-size:14px;font-weight:500;color:#1C1C1E;cursor:pointer;border-bottom:0.5px solid #F9F9F9;text-decoration:none;}
        .pmenu:hover{background:#F9F9F9;}
        .pmenu:last-child{border-bottom:none;}
        .pmenu.red{color:#FF3B30;}
        .picon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
        .bnav{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:0.5px solid rgba(0,0,0,0.1);display:flex;height:56px;z-index:100;}
        .btab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:none;background:none;cursor:pointer;color:#AEAEB2;font-size:9px;font-weight:600;position:relative;text-transform:uppercase;letter-spacing:0.3px;text-decoration:none;}
        .btab.active{color:#FF9F0A;}
        .btab-line{position:absolute;top:0;left:25%;right:25%;height:2.5px;border-radius:0 0 2px 2px;}
        .btab.active .btab-line{background:#FF9F0A;}
        .bti{font-size:22px;line-height:1;}
        .cart-dot{position:absolute;top:5px;right:calc(50% - 21px);background:#FF3B30;color:#fff;font-size:9px;font-weight:700;border-radius:8px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;}
        .more-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(6px);}
        .more-sheet{background:#fff;border-radius:24px 24px 0 0;padding:8px 20px 40px;width:100%;max-width:480px;}
        .more-handle{width:36px;height:4px;background:#E5E5EA;border-radius:2px;margin:10px auto 20px;}
        .more-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
        .more-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 4px;background:#F9F9F9;border-radius:14px;text-decoration:none;color:#6D6D72;font-size:11px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s;}
        .more-item.active{background:rgba(255,159,10,0.1);color:#FF9F0A;}
        .more-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;}
        .page-body{padding-bottom:72px;}
        @media(min-width:768px){.bnav{max-width:800px;left:50%;transform:translateX(-50%);border-left:0.5px solid rgba(0,0,0,0.1);border-right:0.5px solid rgba(0,0,0,0.1);}}
      `}</style>

      <header className="nb">
        <Link href="/home" className="nb-logo">
          <div className="nb-logo-icon">✦</div>
          <div className="nb-name">KNOWBOTH<b>.AI</b></div>
          <div style={{fontSize:9,color:"#AEAEB2",letterSpacing:0,lineHeight:1,marginTop:1}}>Know Your Savings. Know Your Spending.</div>
        </Link>
        <div className="nb-actions">
          <button className="nb-btn" onClick={()=>{setShowLoc(!showLoc);setShowProfile(false);}}>📍</button>
          <button className="nb-btn">💬<span className="nb-bdg">2</span></button>
          <button className="nb-btn" onClick={()=>{setShowProfile(!showProfile);setShowLoc(false);}}>
            {user.avatar}
            {showProfile&&<div style={{position:"absolute",inset:0,borderRadius:"50%",boxShadow:"0 0 0 2px #FF9F0A"}} />}
          </button>
        </div>
      </header>

      {showLoc&&(
        <div className="loc-panel">
          <div className="loc-row">
            <input className="loc-input" value={locInput} onChange={e=>setLocInput(e.target.value)} placeholder="City, ZIP" onKeyDown={e=>e.key==="Enter"&&saveLocation()} />
            <button className="gps-btn" onClick={useGPS} disabled={gpsLoading}>{gpsLoading?"⟳":"📡 GPS"}</button>
            <button className="save-btn" onClick={saveLocation}>Save</button>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.3,marginBottom:8}}>SEARCH RADIUS</div>
          <div className="r-row">{RADII.map(r=><button key={r} onClick={()=>setRadius(r)} className={`r-pill${radius===r?" on":""}`}>{r}mi</button>)}</div>
        </div>
      )}

      {showProfile&&(
        <div className="prof-overlay" onClick={()=>setShowProfile(false)}>
          <div className="prof-sheet" onClick={e=>e.stopPropagation()}>
            <div className="prof-head">
              <div className="prof-av">{user.avatar}</div>
              <div>
                <div className="prof-name">{user.name}</div>
                <div className="prof-lvl">{getLevel(user.points||0)} · ✦ {user.points||0} pts</div>
              </div>
            </div>
            <Link href="/profile" className="pmenu" onClick={()=>setShowProfile(false)}>
              <div className="picon" style={{background:"rgba(10,132,255,0.1)"}}>👤</div>My Profile
            </Link>
            <div className="pmenu" style={{cursor:"default"}}>
              <div className="picon" style={{background:"rgba(255,159,10,0.1)"}}>🌙</div>
              <span style={{flex:1}}>Theme</span>
              <select value={user.theme} onChange={e=>updateTheme(e.target.value as any)}
                style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"4px 8px",fontSize:12,color:"#1C1C1E",cursor:"pointer"}}>
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="auto">⚙️ Auto</option>
              </select>
            </div>
            <button className="pmenu red" onClick={signOut}>
              <div className="picon" style={{background:"rgba(255,59,48,0.1)"}}>🚪</div>Sign Out
            </button>
          </div>
        </div>
      )}

      <nav className="bnav">
        {TABS.map((t)=>{
          if(t.more) return(
            <button key="more" className={`btab${MORE_ITEMS.some(m=>m.href===pathname)?" active":""}`} onClick={()=>setShowMore(true)}>
              <div className="btab-line"/><span className="bti">⋯</span><span>More</span>
            </button>
          );
          return(
            <Link key={t.href} href={t.href!} className={`btab${pathname===t.href?" active":""}`}>
              <div className="btab-line"/><span className="bti">{t.icon}</span><span>{t.label}</span>
              {t.badge&&pending>0&&<span className="cart-dot">{pending>99?"99+":pending}</span>}
            </Link>
          );
        })}
      </nav>

      {showMore&&(
        <div className="more-overlay" onClick={e=>e.target===e.currentTarget&&setShowMore(false)}>
          <div className="more-sheet">
            <div className="more-handle"/>
            <div style={{fontSize:18,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5,marginBottom:16,paddingLeft:4}}>More</div>
            <div className="more-grid">
              {MORE_ITEMS.map(item=>(
                <Link key={item.href} href={item.href} className={`more-item${pathname===item.href?" active":""}`} onClick={()=>setShowMore(false)}>
                  <div className="more-icon" style={{background:`${item.color}18`}}>{item.icon}</div>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
