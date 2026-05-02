"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabaseAuth } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getLevel } from "@/lib/utils";
import toast from "react-hot-toast";

const NAV_MAIN = [
  { href:"/home",  icon:"🏠", label:"Home" },
  { href:"/deals", icon:"🏷️", label:"Deals" },
  { href:"/cart",  icon:"🛒", label:"Cart", badge:true },
  { href:"/scan",  icon:"🧾", label:"Scan Bill" },
];
const NAV_MORE = [
  { href:"/stock",     icon:"📦", label:"Stock" },
  { href:"/expenses",  icon:"📊", label:"Expenses" },
  { href:"/analytics", icon:"📈", label:"Analytics" },
  { href:"/community", icon:"👥", label:"Community" },
];
const BOTTOM_TABS = [
  { href:"/home",  icon:"🏠", label:"Home" },
  { href:"/deals", icon:"🏷️", label:"Deals" },
  { scan:true },
  { href:"/cart",  icon:"🛒", label:"Cart" },
  { more:true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, cart, radius, updateLocation, updateRadius } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [showLocation, setShowLocation] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [manualZip, setManualZip] = useState("");
  const locationRef = useRef<HTMLDivElement>(null);
  const mobileLocBtnRef = useRef<HTMLButtonElement>(null);
  const sidebarLocBtnRef = useRef<HTMLDivElement>(null);
  const cartCount = cart?.filter((i:any)=>!i.purchased)?.length || 0;
  const level = getLevel(user?.points||0);

  useEffect(()=>{
    if(window.innerWidth<=768) return;
    const ml = sidebarHidden ? '0' : (collapsed ? '56px' : 'var(--sidebar-w)');
    const mc = document.querySelector('.main-content') as HTMLElement;
    const th = document.querySelector('.top-header') as HTMLElement;
    if(mc) mc.style.marginLeft = ml;
    if(th) th.style.marginLeft = ml;
  },[collapsed, sidebarHidden]);

  useEffect(()=>{
    const saved = (localStorage.getItem("kb-theme")||"light") as "light"|"dark";
    const savedCollapsed = localStorage.getItem("kb-collapsed")==="true";
    const savedHidden = localStorage.getItem("kb-sidebar-hidden")==="true";
    setCollapsed(savedCollapsed);
    setSidebarHidden(savedHidden);
    setTheme(saved);
    document.documentElement.setAttribute("data-theme",saved);
  },[]);

  // Close location dropdown on outside click
  useEffect(()=>{
    function handleClick(e:MouseEvent){
      const t=e.target as Node;
      if(
        locationRef.current&&!locationRef.current.contains(t)&&
        !mobileLocBtnRef.current?.contains(t)&&
        !sidebarLocBtnRef.current?.contains(t)
      ) setShowLocation(false);
    }
    document.addEventListener("mousedown",handleClick);
    return()=>document.removeEventListener("mousedown",handleClick);
  },[]);

  // Auto-detect location if not previously set
  useEffect(()=>{
    if(user&&user.zip==="75074"&&user.city==="DFW"&&navigator.geolocation){
      detectLocation(true);
    }
  },[user?.zip]);

  async function lookupZip(){
    const zip=manualZip.trim();
    if(!zip){toast.error("Enter a zip code");return;}
    setLocLoading(true);
    try{
      const data=await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`).then(r=>r.json());
      if(!data||data.length===0){toast.error("Zip code not found");setLocLoading(false);return;}
      const city=data[0].display_name.split(",")[0].trim();
      updateLocation(zip,city);
      setManualZip("");
      setShowLocation(false);
      toast.success(`📍 Location set to ${city}`);
    }catch{
      toast.error("Could not look up zip code");
    }
    setLocLoading(false);
  }

  async function detectLocation(silent=false){
    if(!navigator.geolocation){if(!silent)toast.error("GPS not supported");return;}
    setLocLoading(true);
    try{
      const pos=await new Promise<GeolocationPosition>((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000}));
      const{latitude,longitude}=pos.coords;
      const data=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`).then(r=>r.json());
      const zip=data.address?.postcode||user?.zip||"75074";
      const city=data.address?.city||data.address?.town||data.address?.suburb||user?.city||"DFW";
      updateLocation(zip,city);
      if(!silent)toast.success(`📍 Location set to ${city}`);
    }catch{
      if(!silent)toast.error("Could not detect location");
    }
    setLocLoading(false);
  }

  async function toggleTheme(){
    const next = theme==="light"?"dark":"light";
    setTheme(next);
    localStorage.setItem("kb-theme",next);
    document.documentElement.setAttribute("data-theme",next);
    try{
      const{data:{session}}=await supabaseAuth.auth.getSession();
      if(session?.user?.id){
        await supabase.from("user_profiles").upsert({user_id:session.user.id,theme:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      }
    }catch(e){console.error("Theme save:",e);}
  }

  function openSidebar(){
    setCollapsed(false);
    setSidebarHidden(false);
    if(window.innerWidth<=768) setSidebarOpen(true);
    localStorage.setItem("kb-collapsed","false");
    localStorage.setItem("kb-sidebar-hidden","false");
  }

  function closeSidebar(){
    setSidebarHidden(true);
    setSidebarOpen(false);
    localStorage.setItem("kb-sidebar-hidden","true");
  }

  function toggleCollapse(){
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("kb-collapsed", String(next));
  }

  async function logout(){
    await supabaseAuth.auth.signOut();
    window.location.href="/auth";
  }

  if (pathname === "/auth") return null;

  const allNavItems=[...NAV_MAIN,...NAV_MORE];
  const isActive=(href:string)=>pathname===href;

  return(
    <>
      {/* Overlay */}
      <div className={`sidebar-overlay${sidebarOpen?" show":""}`} onClick={closeSidebar}/>

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sidebarOpen?" open":""}${collapsed?" collapsed":""}${sidebarHidden?" sidebar-hidden":""}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">✦</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="sidebar-logo-name">KNOWBOTH<span>.AI</span></div>
            <div className="sidebar-logo-tag">Know Your Savings. Know Your Spending.</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="sidebar-actions">
          <button className="sidebar-action-primary" onClick={()=>{router.push("/post-deal");closeSidebar();}}>
            <span>📷</span><span className="sidebar-item-label">Post Deal</span>
          </button>
          <button className="sidebar-action-secondary" onClick={()=>{router.push("/scan");closeSidebar();}}>
            <span>🧾</span><span className="sidebar-item-label">Scan</span>
          </button>
        </div>

        {/* Nav — scrollable middle */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Main</div>
          {NAV_MAIN.map(item=>(
            <Link key={item.href} href={item.href}
              className={`sidebar-item${isActive(item.href)?" active":""}`}
              onClick={closeSidebar}
              title={collapsed?item.label:undefined}>
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
              {item.badge&&cartCount>0&&<span className="sidebar-badge">{cartCount}</span>}
            </Link>
          ))}
          <div className="sidebar-divider"/>
          <div className="sidebar-section-title">More</div>
          {NAV_MORE.map(item=>(
            <Link key={item.href} href={item.href}
              className={`sidebar-item${isActive(item.href)?" active":""}`}
              onClick={closeSidebar}
              title={collapsed?item.label:undefined}>
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer — pinned to bottom */}
        <div className="sidebar-footer">
          <div ref={sidebarLocBtnRef} className="sidebar-item" onClick={()=>setShowLocation(s=>!s)} title={collapsed?"Location":undefined}>
            <span className="sidebar-item-icon">📍</span>
            <span className="sidebar-item-label" style={{flex:1}}>{user?.city||"Set location"}<span style={{color:"var(--text3)",fontSize:9,marginLeft:4}}>{radius}mi</span></span>
          </div>
          <div className="sidebar-item" onClick={toggleTheme} title={collapsed?(theme==="light"?"Dark Mode":"Light Mode"):undefined}>
            <span className="sidebar-item-icon">{theme==="light"?"🌙":"☀️"}</span>
            <span className="sidebar-item-label">{theme==="light"?"Dark Mode":"Light Mode"}</span>
          </div>
          <div className="sidebar-divider"/>
          <div className="sidebar-user" onClick={()=>{router.push("/profile");closeSidebar();}}>
            <div className="sidebar-avatar">{user?.avatar||"🧑‍🍳"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="sidebar-user-name">{user?.name||"User"}</div>
              <div className="sidebar-user-pts">{level} · ✦ {user?.points||0} pts</div>
            </div>
            <span style={{color:"var(--text3)",fontSize:11}}>›</span>
          </div>
          <button className="sidebar-signout" onClick={logout}>
            <span style={{fontSize:14}}>🚪</span><span className="sidebar-item-label"> Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header className="mobile-header">
        <div style={{display:"flex",flexDirection:"column",gap:1}}>
          <div className="mobile-logo">KNOWBOTH<span>.AI</span></div>
          <div style={{fontSize:9,color:"var(--text3)",fontWeight:500,letterSpacing:0.2,lineHeight:1}}>Know Your Savings. Know Your Spending.</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          {/* Location trigger */}
          <button ref={mobileLocBtnRef} onClick={()=>setShowLocation(s=>!s)}
            aria-label={`Change location, currently ${user?.city||"unknown"}`}
            style={{display:"flex",alignItems:"center",gap:4,padding:"5px 9px",borderRadius:10,background:"var(--bg)",border:"0.5px solid var(--border)",cursor:"pointer",fontSize:11,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap"}}>
            <span style={{fontSize:13}}>📍</span>
            <span style={{maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}}>{user?.city||"Location"}</span>
            <span style={{fontSize:9,color:"var(--text3)"}}>{radius}mi</span>
          </button>
          {/* Cart */}
          <button className="top-header-btn" style={{position:"relative"}} aria-label={`Cart${cartCount>0?`, ${cartCount} items`:""}`} onClick={()=>router.push("/cart")}>
            🛒{cartCount>0&&<span className="top-header-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* ── DESKTOP TOP HEADER ── */}
      <header className="top-header">
        {/* Sidebar toggle — always visible on desktop */}
        <button
          className="top-header-btn"
          onClick={sidebarHidden ? openSidebar : toggleCollapse}
          title={sidebarHidden ? "Open sidebar" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarHidden ? "Open sidebar" : "Toggle sidebar"}
          style={{flexShrink:0}}>
          {(!sidebarHidden && !collapsed) ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
              <path d="m16 15-3-3 3-3"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          )}
        </button>
        {/* Page title */}
        <div style={{fontSize:15,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",flexShrink:0}}>
          {allNavItems.find(n=>n.href===pathname)?.icon} {allNavItems.find(n=>n.href===pathname)?.label||"Dashboard"}
        </div>

        {/* Search — hidden on deals page (has its own search) */}
        {pathname !== "/deals" && (
          <div className="top-header-search">
            <span className="top-header-search-icon">🔍</span>
            <input
              placeholder="Search deals, items, stores..."
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  const v=(e.target as HTMLInputElement).value.trim();
                  if(v) router.push(`/deals?q=${encodeURIComponent(v)}`);
                }
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="top-header-actions">
          {/* Cart */}
          <button className="top-header-btn" style={{position:"relative"}} onClick={()=>router.push("/cart")} title="Cart" aria-label={`Cart${cartCount>0?`, ${cartCount} items`:""}`}>
            🛒{cartCount>0&&<span className="top-header-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="bnav">
        {BOTTOM_TABS.map((tab:any,i)=>{
          if(tab.scan) return(
            <div key="scan" className="nav-fab-wrap">
              <button className="nav-fab" aria-label="Scan bill" onClick={()=>router.push("/scan")}>🧾</button>
            </div>
          );
          if(tab.more) return(
            <button key="more" className={`btab${showMore?" active":""}`} onClick={()=>setShowMore(true)}>
              <div className="btab-line"/>
              <span className="bti">⋯</span>
              <span>More</span>
            </button>
          );
          return(
            <Link key={tab.href} href={tab.href} className={`btab${pathname===tab.href?" active":""}`}>
              <div className="btab-line"/>
              <span className="bti">
                {tab.icon}
                {tab.href==="/cart"&&cartCount>0&&<sup style={{fontSize:7,color:"var(--red)",fontWeight:700,marginLeft:1}}>{cartCount}</sup>}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── SHARED LOCATION DROPDOWN ── */}
      {showLocation&&(
        <div ref={locationRef} className="loc-dropdown">
          <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,marginBottom:6}}>CURRENT LOCATION</div>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:10}}>
            📍 {user?.city||"Unknown"}{user?.zip?`, ${user.zip}`:""}
          </div>

          {/* Manual zip entry */}
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <input
              value={manualZip}
              onChange={e=>setManualZip(e.target.value.replace(/\D/g,"").slice(0,5))}
              onKeyDown={e=>e.key==="Enter"&&lookupZip()}
              placeholder="Enter zip code"
              maxLength={5}
              style={{flex:1,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:9,padding:"8px 10px",fontSize:12,color:"var(--text)",outline:"none"}}
            />
            <button onClick={lookupZip} disabled={locLoading||manualZip.length<5}
              style={{padding:"8px 12px",background:"var(--gold)",border:"none",borderRadius:9,fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",opacity:manualZip.length<5?0.45:1,whiteSpace:"nowrap" as const}}>
              Go
            </button>
          </div>

          <button onClick={()=>detectLocation()} disabled={locLoading}
            style={{width:"100%",padding:"9px",background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.25)",borderRadius:10,fontSize:12,fontWeight:600,color:"var(--green)",cursor:"pointer",marginBottom:12,opacity:locLoading?0.6:1}}>
            {locLoading?"⏳ Detecting...":"📡 Use my current location"}
          </button>
          <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,marginBottom:6}}>SEARCH RADIUS</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
            {[5,10,25,50,100].map(r=>(
              <button key={r} onClick={()=>updateRadius(r)}
                style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:600,border:"none",cursor:"pointer",background:radius===r?"var(--gold)":"var(--bg)",color:radius===r?"#fff":"var(--text2)",transition:"all 0.15s"}}>
                {r}mi
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MOBILE MORE SHEET ── */}
      {showMore&&(
        <div onClick={()=>setShowMore(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"var(--surf)",borderRadius:"18px 18px 0 0",padding:"8px 16px 36px",width:"100%",maxWidth:480}}>
            <div style={{width:32,height:3,background:"var(--border)",borderRadius:2,margin:"8px auto 16px"}}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(85px,1fr))",gap:8,marginBottom:12}}>
              {[...NAV_MORE,{href:"/profile",icon:"👤",label:"Profile"}].map(item=>(
                <div key={item.href} onClick={()=>{router.push(item.href);setShowMore(false);}}
                  style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:5,padding:"12px 8px",borderRadius:12,background:"var(--bg)",cursor:"pointer"}}>
                  <span style={{fontSize:22}}>{item.icon}</span>
                  <span style={{fontSize:10,fontWeight:600,color:"var(--text2)"}}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <div onClick={toggleTheme}
                style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:"var(--bg)",cursor:"pointer"}}>
                <span style={{fontSize:18}}>{theme==="light"?"🌙":"☀️"}</span>
                <span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{theme==="light"?"Dark":"Light"}</span>
              </div>
              <div onClick={logout}
                style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:"rgba(255,59,48,0.06)",cursor:"pointer"}}>
                <span style={{fontSize:18}}>🚪</span>
                <span style={{fontSize:12,fontWeight:600,color:"var(--red)"}}>Sign Out</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
