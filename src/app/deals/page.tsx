"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getFreshness, CAT_ICONS, STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

const CATS = ["All","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Household"];
const SORTS = [{v:"newest",l:"Newest"},{v:"price_asc",l:"Price ↑"},{v:"savings",l:"Savings"},{v:"expiring",l:"Expiring"}];

export default function DealsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [storeFilter, setStoreFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [maxPrice, setMaxPrice] = useState(50);
  const [onSale, setOnSale] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [freshToday, setFreshToday] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [stores, setStores] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"image"|"url">("image");
  const [storeName, setStoreName] = useState("");
  const [saleEnd, setSaleEnd] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<any[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToCart, cart } = useAppStore();

  useEffect(()=>{ fetchDeals(); },[]);

  async function fetchDeals() {
    setLoading(true);
    const{data:dealRows}=await supabase.from("deals").select("id,sale_end,brand_id").eq("status","approved");
    if(!dealRows?.length){setItems([]);setLoading(false);return;}
    const dealIds=dealRows.map((d:any)=>d.id);
    const brandIds=[...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))] as string[];
    const{data:brands}=await supabase.from("brands").select("id,name,slug").in("id",brandIds);
    const{data:dealItems}=await supabase.from("deal_items")
      .select("id,deal_id,name,price,regular_price,unit,category,savings_pct,created_at,source")
      .in("deal_id",dealIds).order("created_at",{ascending:false});
    if(!dealItems){setLoading(false);return;}
    const brandMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{brandMap[b.id]=b;});
    const dealMap:Record<string,any>={};dealRows.forEach((d:any)=>{dealMap[d.id]=d;});
    const merged=dealItems.map((item:any)=>({...item,deal:dealMap[item.deal_id],brand:brandMap[dealMap[item.deal_id]?.brand_id]}));
    setItems(merged);
    setStores([...new Set(merged.map((i:any)=>i.brand?.name).filter(Boolean))] as string[]);
    setLoading(false);
  }

  function daysLeft(s:string|null){if(!s)return null;return Math.ceil((new Date(s).getTime()-Date.now())/86400000);}
  function srcIcon(s:string|null){return s==="receipt"?"🧾":s==="flyer"?"📄":"✏️";}
  function timeAgo(ts:string){const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;}
  function toB64(f:File):Promise<string>{return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});}

  const activeFilters = [
    cat!=="All"&&{label:cat,clear:()=>setCat("All")},
    storeFilter!=="All"&&{label:storeFilter,clear:()=>setStoreFilter("All")},
    onSale&&{label:"On Sale",clear:()=>setOnSale(false)},
    expiringSoon&&{label:"Expiring Soon",clear:()=>setExpiringSoon(false)},
    freshToday&&{label:"Fresh Today",clear:()=>setFreshToday(false)},
    maxPrice<50&&{label:`Under $${maxPrice}`,clear:()=>setMaxPrice(50)},
  ].filter(Boolean) as {label:string;clear:()=>void}[];

  function clearAll(){setCat("All");setStoreFilter("All");setOnSale(false);setExpiringSoon(false);setFreshToday(false);setMaxPrice(50);}

  const filtered = items.filter(item=>{
    const q=search.toLowerCase();
    const dl=daysLeft(item.deal?.sale_end);
    const fresh=getFreshness(item.created_at);
    if(q&&!item.name?.toLowerCase().includes(q))return false;
    if(cat!=="All"&&item.category!==cat)return false;
    if(storeFilter!=="All"&&item.brand?.name!==storeFilter)return false;
    if(dl!==null&&dl<0)return false;
    if(onSale&&!item.regular_price)return false;
    if(expiringSoon&&(dl===null||dl>3))return false;
    if(freshToday&&fresh.level>1)return false;
    if(item.price>maxPrice)return false;
    return true;
  }).sort((a,b)=>{
    if(sort==="price_asc")return a.price-b.price;
    if(sort==="savings")return(b.savings_pct||0)-(a.savings_pct||0);
    if(sort==="expiring")return(daysLeft(a.deal?.sale_end)||999)-(daysLeft(b.deal?.sale_end)||999);
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });

  const grouped:Record<string,any[]>={};
  filtered.forEach(item=>{const c=item.category||"Other";if(!grouped[c])grouped[c]=[];grouped[c].push(item);});

  function handleAdd(item:any){
    if(cart.find(i=>i.id===item.id)){toast("Already in cart");return;}
    addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:CAT_ICONS[item.category]||"🛒"});
    toast.success(`✦ ${item.name} added`);
  }

  async function handleExtract(){
    if(!storeName.trim()){toast.error("Enter store name");return;}
    if(uploadMode==="image"&&!file){toast.error("Select a file");return;}
    if(uploadMode==="url"&&!url.trim()){toast.error("Enter URL");return;}
    setUploading(true);
    try{
      const body:any={store:storeName};
      if(uploadMode==="image"&&file){body.b64=await toB64(file);body.mime=file.type;}else{body.url=url;}
      const res=await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();
      if(data.error)throw new Error(data.error);
      setExtracted(data.items||[]);setFile(null);setPreview(null);
      toast.success(`✦ Found ${data.items?.length||0} deals!`);
    }catch(e:any){toast.error("Extract failed: "+e.message);}
    setUploading(false);
  }

  async function publishDeals(){
    if(!extracted.length||!storeName.trim())return;
    try{
      const{data:brand}=await supabase.from("brands").select("id").ilike("name",`%${storeName}%`).single();
      if(!brand?.id){toast.error("Store not found");return;}
      const{data:deal}=await supabase.from("deals").insert({brand_id:brand.id,status:"approved",applies_to_all_locations:true,sale_start:new Date().toISOString().split("T")[0],sale_end:saleEnd||null}).select("id").single();
      if(!deal?.id){toast.error("Failed");return;}
      await supabase.from("deal_items").insert(extracted.map(item=>({deal_id:deal.id,name:item.name,normalized_name:item.normalized_name||item.name.toLowerCase(),price:parseFloat(item.price)||0,regular_price:item.regular_price?parseFloat(item.regular_price):null,unit:item.unit||"ea",category:item.category||"Other",source:uploadMode==="image"?"flyer":"manual"})));
      toast.success(`🚀 ${extracted.length} deals published!`);
      setExtracted([]);setStoreName("");setSaleEnd("");setUrl("");setShowUpload(false);fetchDeals();
    }catch(e:any){toast.error("Publish failed: "+e.message);}
  }

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)"}} className="page-body">
      <Navbar />
      <div className="container">

        {/* Search + Post */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{position:"relative",flex:1}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-dim)",fontSize:15}}>🔍</span>
            <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search deals, items, stores..." style={{paddingLeft:42,fontSize:15}} />
          </div>
          <button onClick={()=>setShowUpload(!showUpload)} className="btn-gold" style={{padding:"10px 14px",fontSize:12,whiteSpace:"nowrap"}}>📷 Post</button>
        </div>

        {/* Filter chip bar */}
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:10,msOverflowStyle:"none",scrollbarWidth:"none"}}>
          {/* Main filter toggle */}
          <button onClick={()=>setShowPanel(!showPanel)} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:20,fontSize:13,fontWeight:600,whiteSpace:"nowrap",cursor:"pointer",border:"none",flexShrink:0,background:showPanel||activeFilters.length>0?"var(--gold)":"var(--surf)",color:showPanel||activeFilters.length>0?"#fff":"var(--text-muted)",boxShadow:showPanel||activeFilters.length>0?"0 2px 8px rgba(255,159,10,0.4)":"var(--shadow-sm)",transition:"all 0.15s"}}>
            ⚙️ Filters {activeFilters.length>0&&<span style={{background:"rgba(255,255,255,0.3)",borderRadius:10,padding:"1px 6px",fontSize:11,fontWeight:700}}>{activeFilters.length}</span>}
          </button>
          {/* Active filter chips */}
          {activeFilters.map((f,i)=>(
            <button key={i} onClick={f.clear} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:"nowrap",cursor:"pointer",border:"none",flexShrink:0,background:"rgba(255,159,10,0.1)",color:"var(--gold)",transition:"all 0.15s"}}>
              {f.label} <span style={{fontSize:13,opacity:0.7}}>✕</span>
            </button>
          ))}
          {activeFilters.length>1&&(
            <button onClick={clearAll} style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:"nowrap",cursor:"pointer",border:"none",flexShrink:0,background:"rgba(255,59,48,0.1)",color:"var(--red)"}}>
              Clear All
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showPanel&&(
          <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",marginBottom:14,boxShadow:"var(--shadow-md)"}}>

            {/* Category */}
            <div style={{padding:"14px 16px",borderBottom:"0.5px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:10}}>Category</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {CATS.map(c=>(
                  <button key={c} onClick={()=>setCat(c)} style={{padding:"6px 14px",borderRadius:20,fontSize:13,fontWeight:500,cursor:"pointer",border:"none",background:cat===c?"var(--gold)":"var(--surf2)",color:cat===c?"#fff":"var(--text)",boxShadow:cat===c?"0 2px 6px rgba(255,159,10,0.3)":"none",transition:"all 0.15s"}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Store */}
            <div style={{padding:"14px 16px",borderBottom:"0.5px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:10}}>Store</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {["All",...stores].map(s=>{
                  const slug=Object.keys(STORE_COLORS).find(k=>s.toLowerCase().includes(k.split("-")[0]));
                  const color=slug?STORE_COLORS[slug]:"var(--gold)";
                  return(
                    <button key={s} onClick={()=>setStoreFilter(s)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,fontSize:13,fontWeight:500,cursor:"pointer",border:"none",background:storeFilter===s?"var(--gold)":"var(--surf2)",color:storeFilter===s?"#fff":"var(--text)",boxShadow:storeFilter===s?"0 2px 6px rgba(255,159,10,0.3)":"none",transition:"all 0.15s"}}>
                      {s!=="All"&&<span style={{width:8,height:8,borderRadius:"50%",background:storeFilter===s?"rgba(255,255,255,0.6)":color,flexShrink:0,display:"inline-block"}} />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div style={{padding:"14px 16px",borderBottom:"0.5px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:10}}>Price Range</div>
              <input type="range" min="1" max="50" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))}
                style={{width:"100%",accentColor:"var(--gold)",marginBottom:6,cursor:"pointer"}} />
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text-muted)"}}>
                <span>$0</span>
                <span style={{color:"var(--gold)",fontWeight:600}}>Under ${maxPrice}{maxPrice===50?"+":" "}</span>
                <span>$50+</span>
              </div>
            </div>

            {/* Quick toggles */}
            <div style={{padding:"14px 16px",borderBottom:"0.5px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:12}}>Quick Filters</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
                {[
                  {label:"🔥 On Sale Only",val:onSale,set:setOnSale},
                  {label:"⏰ Expiring Soon (3 days)",val:expiringSoon,set:setExpiringSoon},
                  {label:"🌿 Fresh Today",val:freshToday,set:setFreshToday},
                ].map(t=>(
                  <div key={t.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:14,fontWeight:500,color:"var(--text)"}}>{t.label}</span>
                    <div onClick={()=>t.set(!t.val)} style={{width:44,height:26,borderRadius:13,cursor:"pointer",position:"relative",transition:"background 0.2s",background:t.val?"var(--gold)":"var(--surf2)",boxShadow:"inset 0 1px 3px rgba(0,0,0,0.1)"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:t.val?20:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div style={{padding:"14px 16px",borderBottom:"0.5px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:10}}>Sort By</div>
              <div style={{display:"flex",background:"var(--surf2)",borderRadius:10,padding:3,gap:2}}>
                {SORTS.map(s=>(
                  <button key={s.v} onClick={()=>setSort(s.v)} style={{flex:1,padding:"8px 4px",borderRadius:8,fontSize:12,fontWeight:600,textAlign:"center" as const,cursor:"pointer",border:"none",background:sort===s.v?"var(--surf)":"transparent",color:sort===s.v?"var(--text)":"var(--text-muted)",boxShadow:sort===s.v?"var(--shadow-sm)":"none",transition:"all 0.15s"}}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply */}
            <div style={{display:"flex",gap:8,padding:"14px 16px"}}>
              <button onClick={clearAll} style={{flex:1,padding:"12px",background:"var(--surf2)",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"var(--text-muted)",cursor:"pointer"}}>
                Clear All
              </button>
              <button onClick={()=>setShowPanel(false)} className="btn-gold" style={{flex:2,padding:"12px",fontSize:14}}>
                Show {filtered.length} Deals →
              </button>
            </div>
          </div>
        )}

        {/* Post Deal Panel */}
        {showUpload&&(
          <div style={{background:"var(--surf)",borderRadius:16,padding:16,marginBottom:14,boxShadow:"var(--shadow-md)"}}>
            <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:12}}>Post a Deal</div>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {(["image","url"] as const).map(m=>(
                <button key={m} onClick={()=>setUploadMode(m)} style={{flex:1,padding:"9px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:uploadMode===m?"var(--gold)":"var(--surf2)",color:uploadMode===m?"#fff":"var(--text-muted)",boxShadow:uploadMode===m?"0 2px 8px rgba(255,159,10,0.4)":"none",transition:"all 0.15s"}}>
                  {m==="image"?"📷 Upload Flyer":"🔗 Paste URL"}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <input className="input" value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Store name *" />
              <input className="input" type="date" value={saleEnd} onChange={e=>setSaleEnd(e.target.value)} />
            </div>
            {uploadMode==="image"?(
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} style={{display:"none"}} />
                <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}}
                  style={{border:`2px dashed ${file?"var(--gold)":"var(--border2)"}`,borderRadius:12,padding:"18px",textAlign:"center",cursor:"pointer",marginBottom:10,background:"var(--surf2)",transition:"border-color 0.2s"}}>
                  {preview?<img src={preview} alt="" style={{maxHeight:100,borderRadius:8,objectFit:"contain"}} />:<><div style={{fontSize:24,marginBottom:4}}>📷</div><div style={{fontSize:13,color:"var(--text-muted)"}}>Drop flyer or tap to upload</div></>}
                </div>
              </>
            ):(
              <input className="input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/deals" style={{marginBottom:10}} />
            )}
            <button onClick={handleExtract} disabled={uploading} className="btn-gold" style={{width:"100%",padding:12,fontSize:14,opacity:uploading?0.7:1}}>
              {uploading?"🤖 Extracting...":"🤖 Extract with KNOWBOTH AI"}
            </button>
            {extracted.length>0&&(
              <div style={{marginTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{extracted.length} items found</span>
                  <button onClick={publishDeals} className="btn-teal" style={{padding:"7px 14px",fontSize:12}}>🚀 Publish</button>
                </div>
                <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column" as const,gap:4}}>
                  {extracted.map((item,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",background:"var(--surf2)",borderRadius:10,padding:"9px 12px"}}>
                      <span style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{item.name}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--gold)"}}>${parseFloat(item.price||0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:12,fontWeight:500}}>{filtered.length} deals</div>

        {loading&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--text-muted)"}}>Loading deals...</div>}
        {!loading&&items.length===0&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>No deals yet</div>
            <p style={{fontSize:13,color:"var(--text-muted)",marginTop:6}}>Tap Post to add the first deal</p>
          </div>
        )}
        {!loading&&items.length>0&&filtered.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>No matches</div>
            <button onClick={clearAll} style={{background:"none",border:"none",color:"var(--gold)",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:8}}>Clear filters</button>
          </div>
        )}

        {/* Grouped list */}
        {Object.entries(grouped).map(([category,catItems])=>(
          <div key={category} style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:8,paddingLeft:2}}>{category}</div>
            <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow-sm)"}}>
              {catItems.map((item,idx)=>{
                const color=STORE_COLORS[item.brand?.slug]||"var(--gold)";
                const fresh=getFreshness(item.created_at);
                const inCart=cart.find(i=>i.id===item.id);
                const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
                const dl=daysLeft(item.deal?.sale_end);
                return(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:idx<catItems.length-1?"0.5px solid var(--border)":"none"}}>
                    <div style={{width:3,height:44,borderRadius:2,background:color,flexShrink:0}} />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-0.2}}>{item.name}</div>
                      <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" as const}}>
                        <span style={{fontWeight:500}}>{item.brand?.name}</span>
                        <span className={`pill fresh-${fresh.level}`} style={{fontSize:10,padding:"1px 7px"}}>{fresh.label}</span>
                        {sav&&<span style={{borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:600,background:"rgba(48,209,88,0.12)",color:"var(--teal)"}}>-{sav}%</span>}
                        {dl!==null&&dl<=3&&<span style={{borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:600,background:"rgba(255,59,48,0.1)",color:"var(--red)"}}>⏰{dl===0?"Last day":`${dl}d`}</span>}
                      </div>
                      <div style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>{srcIcon(item.source)} {item.source||"manual"} · {timeAgo(item.created_at)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:700,color:"var(--gold)",lineHeight:1,letterSpacing:-0.5}}>${item.price?.toFixed(2)}</div>
                      {item.regular_price&&<div style={{fontSize:11,color:"var(--text-dim)",textDecoration:"line-through"}}>${item.regular_price?.toFixed(2)}</div>}
                      <div style={{fontSize:11,color:"var(--text-dim)"}}>/{item.unit||"ea"}</div>
                    </div>
                    <button onClick={()=>handleAdd(item)} style={{padding:"8px 14px",borderRadius:10,fontSize:13,fontWeight:600,border:"none",cursor:"pointer",flexShrink:0,background:inCart?"var(--surf2)":"var(--gold)",color:inCart?"var(--text-muted)":"#fff",boxShadow:inCart?"none":"0 2px 8px rgba(255,159,10,0.35)",transition:"all 0.15s"}}>
                      {inCart?"✓":"+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
