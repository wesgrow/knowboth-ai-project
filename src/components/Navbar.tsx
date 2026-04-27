"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabaseAuth } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { getLevel } from "@/lib/utils";

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
  { href:"/chat",      icon:"🤖", label:"AI Chat" },
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
  const { user, setUser, cart } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const profileRef = useRef<HTMLDivElement>(null);
  const cartCount = cart?.filter((i:any)=>!i.purchased)?.length || 0;
  const level = getLevel(user?.points||0);

  useEffect(()=>{
    const mc = document.querySelector('.main-content') as HTMLElement;
    if(mc) mc.style.marginLeft = sidebarHidden ? '0' : (collapsed ? '52px' : 'var(--sidebar-w)');
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

  useEffect(()=>{
    function handleClick(e: MouseEvent){
      if(profileRef.current&&!profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown",handleClick);
    return()=>document.removeEventListener("mousedown",handleClick);
  },[]);

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

  function toggleCollapse(){
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("kb-collapsed", String(next));
  }

  function toggleSidebarHidden(){
    const next = !sidebarHidden;
    setSidebarHidden(next);
    localStorage.setItem("kb-sidebar-hidden", String(next));
  }

  async function logout(){
    await supabaseAuth.auth.signOut();
    window.location.href="/auth";
  }

  const allNavItems=[...NAV_MAIN,...NAV_MORE];
  const isActive=(href:string)=>pathname===href;

  return(
    <>
      {/* Overlay */}
      <div className={`sidebar-overlay${sidebarOpen?" show":""}`} onClick={()=>setSidebarOpen(false)}/>

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sidebarOpen?" open":""}${collapsed?" collapsed":""}${sidebarHidden?" sidebar-hidden":""}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">✦</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="sidebar-logo-name">KNOWBOTH<span>.AI</span></div>
            <div className="sidebar-logo-tag">Know Your Savings. Know Your Spending.</div>
          </div>
          <button onClick={toggleCollapse} title={collapsed?"Expand sidebar":"Collapse sidebar"}
            style={{width:22,height:22,borderRadius:6,background:"var(--bg)",border:"0.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,color:"var(--text3)",flexShrink:0,transition:"all 0.2s"}}
            onMouseEnter={e=>(e.currentTarget.style.background="var(--gold)",e.currentTarget.style.color="#fff")}
            onMouseLeave={e=>(e.currentTarget.style.background="var(--bg)",e.currentTarget.style.color="var(--text3)")}>
            {collapsed?"›":"‹"}
          </button>
        </div>

        {/* User card */}
        <div className="sidebar-user" onClick={()=>{router.push("/profile");setSidebarOpen(false);}}>
          <div className="sidebar-avatar">{user?.avatar||"🧑‍🍳"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="sidebar-user-name">{user?.name||"User"}</div>
            <div className="sidebar-user-pts">{level} · ✦ {user?.points||0} pts</div>
          </div>
          <span style={{color:"var(--text3)",fontSize:11}}>›</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Main</div>
          {NAV_MAIN.map(item=>(
            <Link key={item.href} href={item.href}
              className={`sidebar-item${isActive(item.href)?" active":""}`}
              onClick={()=>setSidebarOpen(false)}
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
              onClick={()=>setSidebarOpen(false)}
              title={collapsed?item.label:undefined}>
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </Link>
          ))}

          <div className="sidebar-divider"/>
          <div className="sidebar-section-title">Settings</div>
          <div className="sidebar-item" onClick={toggleTheme}>
            <span className="sidebar-item-icon">{theme==="light"?"🌙":"☀️"}</span>
            <span className="sidebar-item-label">{theme==="light"?"Dark Mode":"Light Mode"}</span>
          </div>
          <Link href="/profile" className={`sidebar-item${isActive("/profile")?" active":""}`} onClick={()=>setSidebarOpen(false)}>
            <span className="sidebar-item-icon">👤</span>
            <span className="sidebar-item-label">Profile</span>
          </Link>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-signout" onClick={logout}>
            <span style={{fontSize:14}}>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={()=>setSidebarOpen(true)}>
          <div className="hamburger-line"/>
          <div className="hamburger-line"/>
          <div className="hamburger-line"/>
        </button>
        <div className="mobile-logo">KNOWBOTH<span>.AI</span></div>
        <div style={{marginLeft:"auto",display:"flex",gap:5}}>
          <button className="top-header-btn" onClick={toggleTheme}>{theme==="light"?"🌙":"☀️"}</button>
          <button className="top-header-btn" style={{position:"relative"}} onClick={()=>router.push("/cart")}>
            🛒{cartCount>0&&<span className="top-header-badge">{cartCount}</span>}
          </button>
          <button className="top-header-btn" style={{fontSize:20}} onClick={()=>router.push("/profile")}>{user?.avatar||"🧑‍🍳"}</button>
        </div>
      </header>

      {/* ── DESKTOP TOP HEADER ── */}
      <header className="top-header" style={{marginLeft:0}}>
        {/* Sidebar toggle */}
        <button className="top-header-btn" onClick={toggleSidebarHidden} title={sidebarHidden?"Show sidebar":"Hide sidebar"} style={{flexShrink:0}}>
          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center",justifyContent:"center"}}>
            <div style={{width:15,height:2,background:"var(--text2)",borderRadius:2}}/>
            <div style={{width:15,height:2,background:"var(--text2)",borderRadius:2}}/>
            <div style={{width:15,height:2,background:"var(--text2)",borderRadius:2}}/>
          </div>
        </button>
        {/* Page title / breadcrumb */}
        <div style={{fontSize:15,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",flexShrink:0}}>
          {allNavItems.find(n=>n.href===pathname)?.icon} {allNavItems.find(n=>n.href===pathname)?.label||"Dashboard"}
        </div>

        {/* Search */}
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

        {/* Actions */}
        <div className="top-header-actions">
          <button className="top-header-btn" onClick={toggleTheme} title={theme==="light"?"Dark Mode":"Light Mode"}>
            {theme==="light"?"🌙":"☀️"}
          </button>
          <button className="top-header-btn" onClick={()=>router.push("/chat")} title="AI Chat">💬</button>
          <button className="top-header-btn" style={{position:"relative"}} onClick={()=>router.push("/cart")} title="Cart">
            🛒{cartCount>0&&<span className="top-header-badge">{cartCount}</span>}
          </button>

          {/* Avatar + dropdown */}
          <div ref={profileRef} style={{position:"relative"}}>
            <button className="top-header-btn" onClick={()=>setShowProfile(!showProfile)}
              style={{fontSize:20,background:showProfile?"var(--gold-bg)":"var(--bg)"}}>
              {user?.avatar||"🧑‍🍳"}
            </button>
            {showProfile&&(
              <div className="prof-sheet">
                {/* User info */}
                <div style={{padding:"12px 14px",borderBottom:"0.5px solid var(--border2)"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{user?.name||"User"}</div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{level} · ✦ {user?.points||0} pts</div>
                </div>
                {[
                  {l:"👤 My Profile",h:"/profile"},
                  {l:"📊 Expenses",h:"/expenses"},
                  {l:"📈 Analytics",h:"/analytics"},
                  {l:"👥 Community",h:"/community"},
                ].map(item=>(
                  <div key={item.h} className="prof-item"
                    onClick={()=>{router.push(item.h);setShowProfile(false);}}>
                    {item.l}
                  </div>
                ))}
                <div className="prof-item" onClick={toggleTheme}>
                  {theme==="light"?"🌙 Dark Mode":"☀️ Light Mode"}
                </div>
                <div className="prof-item" style={{color:"var(--red)"}} onClick={logout}>
                  🚪 Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="bnav">
        {BOTTOM_TABS.map((tab:any,i)=>{
          if(tab.scan) return(
            <div key="scan" className="nav-fab-wrap">
              <button className="nav-fab" onClick={()=>router.push("/scan")}>🧾</button>
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

      {/* ── MOBILE MORE SHEET ── */}
      {showMore&&(
        <div onClick={()=>setShowMore(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"var(--surf)",borderRadius:"18px 18px 0 0",padding:"8px 16px 36px",width:"100%",maxWidth:480}}>
            <div style={{width:32,height:3,background:"var(--border)",borderRadius:2,margin:"8px auto 16px"}}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
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
