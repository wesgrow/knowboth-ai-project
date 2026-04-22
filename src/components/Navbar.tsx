"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { supabaseAuth } from "@/lib/supabase";
import { getLevel } from "@/lib/utils";

const RADII = [5, 10, 15, 25, 50];
const MORE_ITEMS = [
  { href:"/compare",   label:"Compare Prices", icon:"⚖️", color:"#0A84FF" },
  { href:"/stock",     label:"Stock",          icon:"📦", color:"#30D158" },
  { href:"/expenses",  label:"Expenses",       icon:"📊", color:"#FF9F0A" },
  { href:"/analytics", label:"Analytics",      icon:"📈", color:"#BF5AF2" },
  { href:"/chat",      label:"AI Chat",        icon:"🤖", color:"#FF6B6B" },
  { href:"/profile",   label:"Profile",        icon:"👤", color:"#64D2FF" },
];
const TABS = [
  { href:"/home",  label:"Home",  icon:"house.fill" },
  { href:"/deals", label:"Deals", icon:"tag.fill" },
  { href:"/scan",  label:"Scan",  icon:"doc.text.viewfinder" },
  { href:"/cart",  label:"Cart",  icon:"cart.fill" },
  { label:"More",  icon:"ellipsis", more:true },
];

const TAB_ICONS:Record<string,string> = {
  "house.fill":"🏠","tag.fill":"🏷️","doc.text.viewfinder":"🧾","cart.fill":"🛒","ellipsis":"•••",
};

export function Navbar() {
  const pathname = usePathname();
  const { user, updateLocation, updateTheme } = useAppStore();
  const [editLoc, setEditLoc] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [locInput, setLocInput] = useState(user?`${user.city||""} ${user.zip||""}`.trim():"");
  const [radius, setRadius] = useState((user as any)?.radius||15);
  const [gpsLoading, setGpsLoading] = useState(false);
  const cart = useAppStore(s=>s.cart);
  const pending = cart.filter(i=>!i.purchased).length;
  if(!user) return null;

  function saveLocation() {
    const parts=locInput.trim().split(/[\s,]+/);
    const zip=parts.find(p=>/^\d{5}/.test(p))||user?.zip||"";
    const city=parts.filter(p=>!/^\d/.test(p)).join(" ")||user?.city||"";
    updateLocation(zip,city);
    setEditLoc(false);
  }

  function useGPS() {
    if(!navigator.geolocation){alert("GPS not supported");return;}
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude}=pos.coords;
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data=await res.json();
        const zip=data.address?.postcode||"";
        const city=data.address?.city||data.address?.town||"";
        updateLocation(zip,city);
        setLocInput(`${city} ${zip}`.trim());
      }catch{updateLocation("","Current Location");}
      setGpsLoading(false);setEditLoc(false);
    },()=>{alert("GPS denied");setGpsLoading(false);});
  }

  async function signOut(){await supabaseAuth.auth.signOut();window.location.href="/auth";}

  return(
    <>
      <style>{`
        .nb{position:sticky;top:0;z-index:100;background:var(--surf3);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:0.5px solid var(--border);padding:12px 16px;}
        .nb-inner{max-width:800px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .nb-logo{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0;}
        .nb-logo-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#FF9F0A,#D4800A);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(255,159,10,0.4);}
        .nb-right{display:flex;align-items:center;gap:8px;}
        .nb-loc{background:var(--surf2);border:none;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:500;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;}
        .nb-theme{background:var(--surf2);border:none;border-radius:8px;padding:6px 8px;font-size:13px;color:var(--text-muted);cursor:pointer;flex-shrink:0;min-height:32px;}
        .nb-pts{background:rgba(255,159,10,0.12);border-radius:20px;padding:5px 10px;font-size:12px;color:var(--gold);font-weight:600;white-space:nowrap;flex-shrink:0;}
        .nb-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,rgba(255,159,10,0.2),rgba(255,159,10,0.1));display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;box-shadow:0 0 0 2px rgba(255,159,10,0.3);}
        .nb-signout{background:rgba(255,59,48,0.1);border:none;color:var(--red);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;}
        .loc-panel{max-width:800px;margin:10px auto 0;background:var(--surf);border-radius:14px;padding:14px;box-shadow:var(--shadow-md);}
        .gps-btn{background:rgba(48,209,88,0.12);border:none;color:var(--teal);border-radius:8px;padding:10px 14px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:var(--surf3);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-top:0.5px solid var(--border);display:flex;padding-bottom:env(safe-area-inset-bottom);}
        .nav-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 2px 8px;text-decoration:none;color:var(--text-dim);font-size:10px;font-weight:500;position:relative;transition:color 0.15s;background:none;border:none;cursor:pointer;letter-spacing:-0.2px;}
        .nav-tab.active{color:var(--gold);}
        .nav-icon{font-size:22px;line-height:1;}
        .nav-label{font-size:10px;}
        .cart-badge{position:absolute;top:6px;right:calc(50% - 22px);background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:10px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--bg);}
        .more-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
        .more-sheet{background:var(--surf);border-radius:28px 28px 0 0;padding:8px 20px 40px;width:100%;max-width:480px;}
        .more-handle{width:36px;height:4px;background:var(--border2);border-radius:2px;margin:10px auto 20px;}
        .more-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
        .more-item{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;background:var(--surf2);border-radius:16px;text-decoration:none;color:var(--text-muted);font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;letter-spacing:-0.2px;border:none;}
        .more-item:active{transform:scale(0.96);}
        .more-item.active{color:var(--gold);}
        .more-icon-wrap{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;}
        .signout-btn{width:100%;padding:15px;background:rgba(255,59,48,0.08);border:none;color:var(--red);border-radius:16px;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:-0.3px;}
        .page-body{padding-bottom:84px;}
        @media(max-width:480px){.nb-pts{display:none;}.nb-signout{display:none;}.nb-loc{max-width:80px;}}
        @media(min-width:768px){.bottom-nav{max-width:800px;left:50%;transform:translateX(-50%);border-left:0.5px solid var(--border);border-right:0.5px solid var(--border);}}
      `}</style>

      <header className="nb">
        <div className="nb-inner">
          <Link href="/home" className="nb-logo">
            <div className="nb-logo-icon">✦</div>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:1}}>
                <span style={{fontSize:17,fontWeight:700,color:"var(--text)",letterSpacing:-0.5}}>KNOWBOTH</span>
                <span style={{fontSize:17,fontWeight:700,color:"var(--gold)",letterSpacing:-0.5}}>.AI</span>
              </div>
              <div style={{fontSize:9,color:"var(--text-dim)",letterSpacing:0,lineHeight:1,marginTop:1}}>
                Know Your Savings. Know Your Spending.
              </div>
            </div>
          </Link>
          <div className="nb-right">
            <button className="nb-loc" onClick={()=>setEditLoc(!editLoc)}>
              📍 {user.city||user.zip||"Location"}
            </button>
            <select className="nb-theme" value={user.theme} onChange={e=>updateTheme(e.target.value as any)}>
              <option value="dark">🌙</option>
              <option value="light">☀️</option>
              <option value="auto">⚙️</option>
            </select>
            <div className="nb-pts">✦ {user.points||0}</div>
            <div className="nb-av">{user.avatar}</div>
            <button className="nb-signout" onClick={signOut}>Sign Out</button>
          </div>
        </div>

        {editLoc&&(
          <div className="loc-panel">
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
              <input className="input" value={locInput} onChange={e=>setLocInput(e.target.value)}
                placeholder="City, ZIP (e.g. Dallas 75074)" style={{flex:1,fontSize:14}}
                onKeyDown={e=>e.key==="Enter"&&saveLocation()} />
              <button className="gps-btn" onClick={useGPS} disabled={gpsLoading}>
                {gpsLoading?"⟳":"📡 GPS"}
              </button>
              <button className="btn-gold" onClick={saveLocation} style={{padding:"10px 16px",fontSize:13}}>Save</button>
            </div>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.3,marginBottom:8}}>SEARCH RADIUS</div>
            <div style={{display:"flex",gap:6}}>
              {RADII.map(r=>(
                <button key={r} onClick={()=>setRadius(r)} style={{flex:1,padding:"8px 4px",fontSize:12,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:radius===r?"rgba(255,159,10,0.12)":"var(--surf2)",color:radius===r?"var(--gold)":"var(--text-muted)",boxShadow:radius===r?"0 0 0 1.5px var(--gold)":"none"}}>
                  {r}mi
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <nav className="bottom-nav">
        {TABS.map((t,i)=>{
          if(t.more) return(
            <button key="more" className={`nav-tab ${MORE_ITEMS.some(m=>m.href===pathname)?"active":""}`} onClick={()=>setShowMore(true)}>
              <span className="nav-icon">⋯</span>
              <span className="nav-label">More</span>
            </button>
          );
          return(
            <Link key={t.href} href={t.href!} className={`nav-tab ${pathname===t.href?"active":""}`}>
              <span className="nav-icon">{TAB_ICONS[t.icon!]}</span>
              <span className="nav-label">{t.label}</span>
              {t.href==="/cart"&&pending>0&&<span className="cart-badge">{pending>99?"99+":pending}</span>}
            </Link>
          );
        })}
      </nav>

      {showMore&&(
        <div className="more-overlay" onClick={e=>e.target===e.currentTarget&&setShowMore(false)}>
          <div className="more-sheet">
            <div className="more-handle" />
            <div style={{marginBottom:16,paddingLeft:4}}>
              <div style={{fontSize:20,fontWeight:700,color:"var(--text)",letterSpacing:-0.5}}>{user.name}</div>
              <div style={{fontSize:13,color:"var(--text-muted)",marginTop:2}}>{getLevel(user.points||0)} · ✦ {user.points||0} pts</div>
            </div>
            <div className="more-grid">
              {MORE_ITEMS.map(item=>(
                <Link key={item.href} href={item.href} className={`more-item ${pathname===item.href?"active":""}`} onClick={()=>setShowMore(false)}>
                  <div className="more-icon-wrap" style={{background:`${item.color}18`}}>
                    <span style={{fontSize:22}}>{item.icon}</span>
                  </div>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <button onClick={async()=>{await supabaseAuth.auth.signOut();window.location.href="/auth";}} className="signout-btn">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
