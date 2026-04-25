"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getFreshness, STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

const CATS = ["All","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Household"];
const SORTS = [{v:"newest",l:"Newest"},{v:"price_asc",l:"Price ↑"},{v:"savings",l:"Savings"},{v:"expiring",l:"Expiring"}];
type View = "list"|"table"|"cards";
type Tab = "deals"|"compare";

function DealsContent() {
  const params = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("deals");
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState(params.get("q")||"");
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
  const [cq, setCq] = useState("");
  const [cResults, setCResults] = useState<any[]>([]);
  const [cLoading, setCLoading] = useState(false);
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
    const{data:dealItems}=await supabase.from("deal_items").select("id,deal_id,name,price,regular_price,unit,category,savings_pct,created_at,source").in("deal_id",dealIds).order("created_at",{ascending:false});
    if(!dealItems){setLoading(false);return;}
    const bMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
    const dMap:Record<string,any>={};dealRows.forEach((d:any)=>{dMap[d.id]=d;});
    const merged=dealItems.map((i:any)=>({...i,deal:dMap[i.deal_id],brand:bMap[dMap[i.deal_id]?.brand_id]}));
    setItems(merged);
    setStores([...new Set(merged.map((i:any)=>i.brand?.name).filter(Boolean))] as string[]);
    setLoading(false);
  }

  async function doCompare(term?:string) {
    const q=term||cq; if(!q.trim())return;
    setCLoading(true);
    const{data:di}=await supabase.from("deal_items").select("id,name,price,regular_price,unit,category,created_at,deal_id,source").ilike("normalized_name",`%${q}%`).order("price",{ascending:true}).limit(10);
    if(!di?.length){setCResults([]);setCLoading(false);return;}
    const dealIds=di.map((d:any)=>d.deal_id);
    const{data:deals}=await supabase.from("deals").select("id,sale_end,brand_id,location_id").in("id",dealIds).eq("status","approved");
    const aIds=new Set((deals||[]).map((d:any)=>d.id));
    const filtered=di.filter((i:any)=>aIds.has(i.deal_id));
    const bIds=[...new Set((deals||[]).map((d:any)=>d.brand_id).filter(Boolean))];
    const{data:brands}=await supabase.from("brands").select("id,name,slug").in("id",bIds as string[]);
    const bMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
    const dMap:Record<string,any>={};(deals||[]).forEach((d:any)=>{dMap[d.id]=d;});
    setCResults(filtered.map((i:any)=>({...i,brand:bMap[dMap[i.deal_id]?.brand_id],deal:dMap[i.deal_id]})));
    setCLoading(false);
  }

  function dL(s:string|null){if(!s)return null;return Math.ceil((new Date(s).getTime()-Date.now())/86400000);}
  function src(s:string|null){return s==="receipt"?"🧾":s==="flyer"?"📄":"✏️";}
  function ago(ts:string){const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`;}
  function toB64(f:File):Promise<string>{return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});}

  const aF=[cat!=="All"&&{l:cat,c:()=>setCat("All")},storeFilter!=="All"&&{l:storeFilter,c:()=>setStoreFilter("All")},onSale&&{l:"On Sale",c:()=>setOnSale(false)},expiringSoon&&{l:"Expiring",c:()=>setExpiringSoon(false)},freshToday&&{l:"Fresh",c:()=>setFreshToday(false)},maxPrice<50&&{l:`<$${maxPrice}`,c:()=>setMaxPrice(50)}].filter(Boolean) as {l:string;c:()=>void}[];
  function clrAll(){setCat("All");setStoreFilter("All");setOnSale(false);setExpiringSoon(false);setFreshToday(false);setMaxPrice(50);}

  const filtered=items.filter(item=>{
    const q=search.toLowerCase();
    const dl=dL(item.deal?.sale_end);
    const fr=getFreshness(item.created_at);
    if(q&&!item.name?.toLowerCase().includes(q))return false;
    if(cat!=="All"&&item.category!==cat)return false;
    if(storeFilter!=="All"&&item.brand?.name!==storeFilter)return false;
    if(dl!==null&&dl<0)return false;
    if(onSale&&!item.regular_price)return false;
    if(expiringSoon&&(dl===null||dl>3))return false;
    if(freshToday&&fr.level>1)return false;
    if(item.price>maxPrice)return false;
    return true;
  }).sort((a,b)=>{
    if(sort==="price_asc")return a.price-b.price;
    if(sort==="savings")return(b.savings_pct||0)-(a.savings_pct||0);
    if(sort==="expiring")return(dL(a.deal?.sale_end)||999)-(dL(b.deal?.sale_end)||999);
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });

  const grouped:Record<string,any[]>={};
  filtered.forEach(item=>{const c=item.category||"Other";if(!grouped[c])grouped[c]=[];grouped[c].push(item);});

  function addItem(item:any){
    if(cart.find(i=>i.id===item.id)){toast("Already in cart");return;}
    addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:"🛒"});
    toast.success(`✦ ${item.name} added`);
  }

  async function handleExtract(){
    if(!storeName.trim()){toast.error("Enter store name");return;}
    if(uploadMode==="image"&&!file){toast.error("Select file");return;}
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
    }catch(e:any){toast.error(e.message);}
    setUploading(false);
  }

  async function publishDeals(){
    try{
      const{data:brand}=await supabase.from("brands").select("id").ilike("name",`%${storeName}%`).single();
      if(!brand?.id){toast.error("Store not found");return;}
      const{data:deal}=await supabase.from("deals").insert({brand_id:brand.id,status:"approved",applies_to_all_locations:true,sale_start:new Date().toISOString().split("T")[0],sale_end:saleEnd||null}).select("id").single();
      if(!deal?.id){toast.error("Failed");return;}
      await supabase.from("deal_items").insert(extracted.map(i=>({deal_id:deal.id,name:i.name,normalized_name:i.normalized_name||i.name.toLowerCase(),price:parseFloat(i.price)||0,regular_price:i.regular_price?parseFloat(i.regular_price):null,unit:i.unit||"ea",category:i.category||"Other",source:uploadMode==="image"?"flyer":"manual"})));
      toast.success(`🚀 ${extracted.length} deals published!`);
      setExtracted([]);setStoreName("");setSaleEnd("");setUrl("");setShowUpload(false);fetchDeals();
    }catch(e:any){toast.error(e.message);}
  }

  // ─── VIEW COMPONENTS ───────────────────────────────────────

  function ListRow({item}:{item:any}) {
    const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
    const fr=getFreshness(item.created_at); const dl=dL(item.deal?.sale_end);
    const inCart=!!cart.find(i=>i.id===item.id);
    const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
    return(
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
        <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
          <div style={{fontSize:11,color:"#AEAEB2",marginTop:2,display:"flex",gap:5,flexWrap:"wrap" as const,alignItems:"center"}}>
            <span>{item.brand?.name}</span>
            <span className={`pill fresh-${fr.level}`} style={{fontSize:9,padding:"1px 6px"}}>{fr.label}</span>
            {sav&&<span style={{fontSize:9,fontWeight:600,color:"#30D158"}}>-{sav}%</span>}
            {dl!==null&&dl<=3&&<span style={{fontSize:9,fontWeight:600,color:"#FF3B30"}}>⏰{dl===0?"Last day":`${dl}d`}</span>}
            <span style={{fontSize:10,color:"#C8C8CC"}}>{src(item.source)} {ago(item.created_at)}</span>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:700,color:"#FF9F0A"}}>${item.price?.toFixed(2)}</div>
          {item.regular_price&&<div style={{fontSize:10,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price?.toFixed(2)}</div>}
          <div style={{fontSize:10,color:"#AEAEB2"}}>/{item.unit||"ea"}</div>
        </div>
        <button onClick={()=>addItem(item)} style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",flexShrink:0,background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff",transition:"all 0.15s"}}>
          {inCart?"✓":"+ Add"}
        </button>
      </div>
    );
  }

  function CardItem({item}:{item:any}) {
    const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
    const fr=getFreshness(item.created_at); const dl=dL(item.deal?.sale_end);
    const inCart=!!cart.find(i=>i.id===item.id);
    const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
    return(
      <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",display:"flex",flexDirection:"column" as const}}>
        <div style={{height:4,background:color}}/>
        <div style={{padding:12,flex:1,display:"flex",flexDirection:"column" as const}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{fontSize:10,color:"#AEAEB2",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:0.4}}>{item.category}</div>
            {sav&&<span style={{fontSize:10,fontWeight:700,color:"#30D158",background:"rgba(48,209,88,0.1)",borderRadius:20,padding:"1px 7px"}}>-{sav}%</span>}
          </div>
          <div style={{fontSize:14,fontWeight:700,color:"#1C1C1E",lineHeight:1.3,marginBottom:"auto",minHeight:36}}>{item.name}</div>
          <div style={{marginTop:10}}>
            <div style={{display:"flex",alignItems:"baseline",gap:3,marginBottom:2}}>
              <span style={{fontSize:20,fontWeight:800,color:"#FF9F0A",letterSpacing:-0.5}}>${item.price?.toFixed(2)}</span>
              <span style={{fontSize:10,color:"#AEAEB2"}}>/{item.unit||"ea"}</span>
            </div>
            {item.regular_price&&<div style={{fontSize:10,color:"#AEAEB2",textDecoration:"line-through",marginBottom:4}}>${item.regular_price?.toFixed(2)}</div>}
            <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,marginBottom:8}}>
              <span style={{fontSize:9,fontWeight:600,background:`${color}18`,color,borderRadius:20,padding:"2px 7px"}}>{item.brand?.name}</span>
              <span className={`pill fresh-${fr.level}`} style={{fontSize:9,padding:"1px 6px"}}>{fr.label}</span>
              {dl!==null&&dl<=3&&<span style={{fontSize:9,fontWeight:600,color:"#FF3B30",background:"rgba(255,59,48,0.1)",borderRadius:20,padding:"2px 6px"}}>⏰{dl===0?"Last day":`${dl}d`}</span>}
            </div>
            <div style={{fontSize:10,color:"#C8C8CC",marginBottom:8}}>{src(item.source)} {ago(item.created_at)}</div>
            <button onClick={()=>addItem(item)} style={{width:"100%",padding:"8px",borderRadius:9,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff",transition:"all 0.15s"}}>
              {inCart?"✓ Added":"+ Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const S={padding:"10px 14px",fontSize:13,fontWeight:600,color:"#1C1C1E",borderBottom:"0.5px solid #F2F2F7",verticalAlign:"middle" as const};
  const TH={padding:"9px 14px",fontSize:11,fontWeight:600,color:"#AEAEB2",textAlign:"left" as const,letterSpacing:0.3,textTransform:"uppercase" as const,background:"#F9F9F9",borderBottom:"0.5px solid #F2F2F7",whiteSpace:"nowrap" as const};

  function TableSection({category,catItems}:{category:string;catItems:any[]}) {
    return(
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6,paddingLeft:2}}>{category}</div>
        <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={TH}>Item</th>
                  <th style={TH}>Store</th>
                  <th style={{...TH,textAlign:"right" as const}}>Price</th>
                  <th style={{...TH,textAlign:"right" as const}}>Was</th>
                  <th style={TH}>Save</th>
                  <th style={TH}>Source</th>
                  <th style={TH}>Fresh</th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {catItems.map(item=>{
                  const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
                  const fr=getFreshness(item.created_at); const dl=dL(item.deal?.sale_end);
                  const inCart=!!cart.find(i=>i.id===item.id);
                  const sav=item.regular_price?Math.round((1-item.price/item.regular_price)*100):null;
                  return(
                    <tr key={item.id} style={{background:"#fff"}}>
                      <td style={{...S,fontWeight:600,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{item.name}</td>
                      <td style={S}><span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",marginRight:6,verticalAlign:"middle"}}/>{item.brand?.name}</td>
                      <td style={{...S,textAlign:"right" as const}}><span style={{fontSize:15,fontWeight:700,color:"#FF9F0A"}}>${item.price?.toFixed(2)}</span><span style={{fontSize:10,color:"#AEAEB2"}}>/{item.unit||"ea"}</span></td>
                      <td style={{...S,textAlign:"right" as const}}>{item.regular_price?<span style={{fontSize:11,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price?.toFixed(2)}</span>:<span style={{color:"#AEAEB2"}}>—</span>}</td>
                      <td style={S}>{sav?<span style={{fontSize:10,fontWeight:600,color:"#30D158",background:"rgba(48,209,88,0.1)",borderRadius:20,padding:"2px 8px"}}>-{sav}%</span>:<span style={{color:"#AEAEB2"}}>—</span>}</td>
                      <td style={{...S,fontSize:11,color:"#AEAEB2",whiteSpace:"nowrap" as const}}>{src(item.source)} {ago(item.created_at)}</td>
                      <td style={S}><span className={`pill fresh-${fr.level}`} style={{fontSize:9}}>{fr.label}{dl!==null&&dl<=3&&` ⏰${dl===0?"!":dl+"d"}`}</span></td>
                      <td style={S}><button onClick={()=>addItem(item)} style={{padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff",whiteSpace:"nowrap" as const}}>{inCart?"✓ Added":"+ Add"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const cheapest=cResults[0]?.price;

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container">

        {/* Tab switcher */}
        <div style={{display:"flex",background:"#fff",borderRadius:12,padding:3,gap:2,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          {([["deals","🏷️ Deals"],["compare","⚖️ Compare"]] as const).map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:tab===t?"#F2F2F7":"transparent",color:tab===t?"#1C1C1E":"#AEAEB2",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.08)":"none",transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>

        {/* ─── DEALS TAB ─── */}
        {tab==="deals"&&(
          <>
            {/* Toolbar */}
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap" as const}}>
              {/* Filter */}
              <button onClick={()=>setShowPanel(!showPanel)} style={{display:"flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:showPanel||aF.length>0?"#FF9F0A":"#fff",color:showPanel||aF.length>0?"#fff":"#6D6D72",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",whiteSpace:"nowrap" as const,flexShrink:0}}>
                ⚙️ {aF.length>0?`${aF.length} Active`:"Filter"}
              </button>
              {/* Active chips */}
              <div style={{display:"flex",gap:6,overflowX:"auto",flex:1,msOverflowStyle:"none" as any,scrollbarWidth:"none" as any}}>
                {aF.map((f,i)=>(
                  <button key={i} onClick={f.c} style={{display:"flex",alignItems:"center",gap:3,padding:"6px 10px",borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:"nowrap" as const,cursor:"pointer",border:"none",flexShrink:0,background:"rgba(255,159,10,0.1)",color:"#FF9F0A"}}>{f.l} ✕</button>
                ))}
              </div>
              {/* View toggle */}
              <div style={{display:"flex",background:"#fff",borderRadius:10,padding:2,gap:1,flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                {([["list","≡","List"],["table","⊞","Table"],["cards","▦","Cards"]] as const).map(([v,icon,label])=>(
                  <button key={v} onClick={()=>setView(v)} title={label} style={{width:34,height:32,borderRadius:8,border:"none",cursor:"pointer",fontSize:15,background:view===v?"#F2F2F7":"transparent",color:view===v?"#1C1C1E":"#AEAEB2",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",flexShrink:0}}>
                    {icon}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"#fff",border:"none",borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:600,color:"#6D6D72",cursor:"pointer",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                {SORTS.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
              {/* Post */}
              <button onClick={()=>setShowUpload(!showUpload)} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",color:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const,flexShrink:0,boxShadow:"0 2px 6px rgba(255,159,10,0.3)"}}>
                📷 Post
              </button>
            </div>

            {/* Filter Panel */}
            {showPanel&&(
              <div style={{background:"#fff",borderRadius:14,overflow:"hidden",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:8}}>Category</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>{CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:"none",background:cat===c?"#FF9F0A":"#F2F2F7",color:cat===c?"#fff":"#1C1C1E",transition:"all 0.15s"}}>{c}</button>)}</div>
                </div>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:8}}>Store</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>{["All",...stores].map(s=><button key={s} onClick={()=>setStoreFilter(s)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:"none",background:storeFilter===s?"#FF9F0A":"#F2F2F7",color:storeFilter===s?"#fff":"#1C1C1E",transition:"all 0.15s"}}>{s}</button>)}</div>
                </div>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const}}>Price Range</span><span style={{fontSize:12,fontWeight:600,color:"#FF9F0A"}}>Under ${maxPrice}{maxPrice===50?"+":" "}</span></div>
                  <input type="range" min="1" max="50" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))} style={{width:"100%",accentColor:"#FF9F0A",cursor:"pointer"}}/>
                </div>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7"}}>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
                    {[{l:"🔥 On Sale",v:onSale,s:setOnSale},{l:"⏰ Expiring Soon",v:expiringSoon,s:setExpiringSoon},{l:"🌿 Fresh Today",v:freshToday,s:setFreshToday}].map(t=>(
                      <div key={t.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:13,color:"#1C1C1E"}}>{t.l}</span>
                        <div onClick={()=>t.s(!t.v)} style={{width:44,height:26,borderRadius:13,cursor:"pointer",position:"relative",background:t.v?"#FF9F0A":"#E5E5EA",transition:"background 0.2s",flexShrink:0}}>
                          <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:t.v?20:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,padding:"12px 16px"}}>
                  <button onClick={clrAll} style={{flex:1,padding:"11px",background:"#F2F2F7",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer"}}>Clear All</button>
                  <button onClick={()=>setShowPanel(false)} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer"}}>Show {filtered.length} →</button>
                </div>
              </div>
            )}

            {/* Post Deal */}
            {showUpload&&(
              <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
                <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:12}}>Post a Deal</div>
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  {(["image","url"] as const).map(m=><button key={m} onClick={()=>setUploadMode(m)} style={{flex:1,padding:"9px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:uploadMode===m?"#FF9F0A":"#F2F2F7",color:uploadMode===m?"#fff":"#6D6D72"}}>{m==="image"?"📷 Flyer":"🔗 URL"}</button>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <input style={{background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none"}} value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Store name *"/>
                  <input type="date" style={{background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none"}} value={saleEnd} onChange={e=>setSaleEnd(e.target.value)}/>
                </div>
                {uploadMode==="image"?(
                  <>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} style={{display:"none"}}/>
                    <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} style={{border:`2px dashed ${file?"#FF9F0A":"#E5E5EA"}`,borderRadius:12,padding:"16px",textAlign:"center",cursor:"pointer",marginBottom:10,background:"#F9F9F9"}}>
                      {preview?<img src={preview} alt="" style={{maxHeight:80,borderRadius:8,objectFit:"contain",margin:"0 auto"}}/>:<><div style={{fontSize:22,marginBottom:4}}>📷</div><div style={{fontSize:12,color:"#AEAEB2"}}>Drop flyer or tap</div></>}
                    </div>
                  </>
                ):<input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",marginBottom:10}} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/deals"/>}
                <button onClick={handleExtract} disabled={uploading} style={{width:"100%",padding:12,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,fontSize:14,fontWeight:600,color:"#fff",cursor:"pointer",opacity:uploading?0.7:1}}>
                  {uploading?"🤖 Extracting...":"🤖 Extract with KNOWBOTH AI"}
                </button>
                {extracted.length>0&&(
                  <div style={{marginTop:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:600}}>{extracted.length} items</span>
                      <button onClick={publishDeals} style={{background:"#30D158",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>🚀 Publish</button>
                    </div>
                    <div style={{maxHeight:140,overflowY:"auto",display:"flex",flexDirection:"column" as const,gap:4}}>
                      {extracted.map((item,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",background:"#F9F9F9",borderRadius:10,padding:"9px 12px"}}><span style={{fontSize:13}}>{item.name}</span><span style={{fontSize:13,fontWeight:700,color:"#FF9F0A"}}>${parseFloat(item.price||0).toFixed(2)}</span></div>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{fontSize:12,color:"#AEAEB2",marginBottom:10,fontWeight:500}}>{filtered.length} deals</div>
            {loading&&<div style={{textAlign:"center",padding:"60px 0",color:"#AEAEB2"}}>Loading deals...</div>}
            {!loading&&items.length===0&&<div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:16,fontWeight:600,color:"#1C1C1E"}}>No deals yet</div><p style={{fontSize:13,color:"#AEAEB2",marginTop:6}}>Tap Post to add the first deal</p></div>}
            {!loading&&items.length>0&&filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:15,fontWeight:600,color:"#1C1C1E"}}>No matches</div><button onClick={clrAll} style={{background:"none",border:"none",color:"#FF9F0A",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:8}}>Clear filters</button></div>}

            {/* ── LIST VIEW ── */}
            {view==="list"&&Object.entries(grouped).map(([cat,catItems])=>(
              <div key={cat} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6,paddingLeft:2}}>{cat}</div>
                <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  {catItems.map(item=><ListRow key={item.id} item={item}/>)}
                </div>
              </div>
            ))}

            {/* ── TABLE VIEW ── */}
            {view==="table"&&Object.entries(grouped).map(([cat,catItems])=>(
              <TableSection key={cat} category={cat} catItems={catItems}/>
            ))}

            {/* ── CARDS VIEW ── */}
            {view==="cards"&&(
              <>
                {Object.entries(grouped).map(([cat,catItems])=>(
                  <div key={cat} style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:8,paddingLeft:2}}>{cat}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
                      {catItems.map(item=><CardItem key={item.id} item={item}/>)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ─── COMPARE TAB ─── */}
        {tab==="compare"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input style={{flex:1,background:"#fff",border:"none",borderRadius:12,padding:"12px 16px",fontSize:15,color:"#1C1C1E",outline:"none",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} value={cq} onChange={e=>setCq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCompare()} placeholder="Search toor dal, rice, ghee..."/>
              <button onClick={()=>doCompare()} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",color:"#fff",border:"none",borderRadius:12,padding:"12px 20px",fontSize:14,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const}}>Compare</button>
            </div>
            {cLoading&&<div style={{textAlign:"center",padding:"40px 0",color:"#AEAEB2"}}>Finding best prices...</div>}
            {!cLoading&&cResults.length===0&&cq&&<div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:44,marginBottom:12}}>⚖️</div><div style={{fontSize:15,fontWeight:600,color:"#1C1C1E"}}>No results found</div></div>}
            {cResults.length>0&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:12,color:"#AEAEB2",fontWeight:500}}>{cResults.length} stores · cheapest first</div>
                  {/* View toggle for compare */}
                  <div style={{display:"flex",background:"#fff",borderRadius:10,padding:2,gap:1,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                    {([["list","≡"],["table","⊞"],["cards","▦"]] as const).map(([v,icon])=>(
                      <button key={v} onClick={()=>setView(v)} style={{width:32,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:14,background:view===v?"#F2F2F7":"transparent",color:view===v?"#1C1C1E":"#AEAEB2",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compare List View */}
                {view==="list"&&(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                    {cResults.map((item,i)=>{
                      const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
                      const extra=i>0?(item.price-cheapest).toFixed(2):null;
                      const inCart=!!cart.find((c:any)=>c.id===item.id);
                      const dl=item.deal?.sale_end?Math.ceil((new Date(item.deal.sale_end).getTime()-Date.now())/86400000):null;
                      return(
                        <div key={item.id} style={{background:"#fff",border:`1px solid ${i===0?"rgba(255,159,10,0.4)":"rgba(0,0,0,0.06)"}`,borderRadius:14,padding:"14px 16px",position:"relative",boxShadow:i===0?"0 2px 12px rgba(255,159,10,0.1)":"0 1px 3px rgba(0,0,0,0.04)"}}>
                          {i===0&&<div style={{position:"absolute",top:-9,left:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 10px",borderRadius:20}}>🏆 BEST PRICE</div>}
                          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                            <div style={{width:26,height:26,borderRadius:"50%",background:i===0?"rgba(255,159,10,0.12)":"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?"#FF9F0A":"#AEAEB2",flexShrink:0}}>{i+1}</div>
                            <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,marginTop:6}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",marginBottom:1}}>{item.name}</div>
                              <div style={{fontSize:13,color:"#6D6D72"}}>{item.brand?.name}</div>
                              <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{src(item.source)} {ago(item.created_at)}</div>
                              {dl!==null&&dl>=0&&dl<=7&&<span style={{fontSize:10,fontWeight:600,background:dl<=2?"rgba(255,59,48,0.1)":"rgba(255,159,10,0.1)",color:dl<=2?"#FF3B30":"#FF9F0A",borderRadius:20,padding:"2px 7px",marginTop:4,display:"inline-block"}}>⏰{dl===0?"Last day":`${dl}d`}</span>}
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:21,fontWeight:700,color:i===0?"#FF9F0A":"#1C1C1E",letterSpacing:-0.5}}>${item.price?.toFixed(2)}</div>
                              <div style={{fontSize:10,color:"#AEAEB2"}}>/{item.unit||"ea"}</div>
                              {extra&&<div style={{fontSize:11,color:"#FF3B30",fontWeight:600}}>+${extra}</div>}
                            </div>
                          </div>
                          <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
                            <button onClick={()=>{if(cart.find((c:any)=>c.id===item.id)){toast("Already in cart");return;}addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:"🛒"});toast.success(`✦ Added`);}} style={{padding:"8px 16px",borderRadius:10,fontSize:13,fontWeight:600,border:"none",cursor:"pointer",background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff"}}>
                              {inCart?"✓ Added":"+ Add to Cart"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compare Table View */}
                {view==="table"&&(
                  <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead>
                          <tr>
                            <th style={TH}>#</th>
                            <th style={TH}>Store</th>
                            <th style={TH}>Item</th>
                            <th style={{...TH,textAlign:"right" as const}}>Price</th>
                            <th style={{...TH,textAlign:"right" as const}}>vs Best</th>
                            <th style={TH}>Source</th>
                            <th style={TH}>Expires</th>
                            <th style={TH}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cResults.map((item,i)=>{
                            const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
                            const extra=i>0?(item.price-cheapest).toFixed(2):null;
                            const inCart=!!cart.find((c:any)=>c.id===item.id);
                            const dl=item.deal?.sale_end?Math.ceil((new Date(item.deal.sale_end).getTime()-Date.now())/86400000):null;
                            return(
                              <tr key={item.id} style={{background:i===0?"rgba(255,159,10,0.02)":"#fff"}}>
                                <td style={S}>
                                  <div style={{width:24,height:24,borderRadius:"50%",background:i===0?"rgba(255,159,10,0.12)":"#F2F2F7",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?"#FF9F0A":"#AEAEB2"}}>{i+1}</div>
                                  {i===0&&<span style={{fontSize:9,fontWeight:700,color:"#FF9F0A",marginLeft:4}}>🏆</span>}
                                </td>
                                <td style={S}><span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",marginRight:6,verticalAlign:"middle"}}/>{item.brand?.name}</td>
                                <td style={{...S,fontWeight:600}}>{item.name}</td>
                                <td style={{...S,textAlign:"right" as const}}><span style={{fontSize:15,fontWeight:700,color:i===0?"#FF9F0A":"#1C1C1E"}}>${item.price?.toFixed(2)}</span><span style={{fontSize:10,color:"#AEAEB2"}}>/{item.unit||"ea"}</span></td>
                                <td style={{...S,textAlign:"right" as const}}>{extra?<span style={{fontSize:12,fontWeight:600,color:"#FF3B30"}}>+${extra}</span>:<span style={{color:"#30D158",fontWeight:600,fontSize:12}}>Best ✓</span>}</td>
                                <td style={{...S,fontSize:11,color:"#AEAEB2"}}>{src(item.source)} {ago(item.created_at)}</td>
                                <td style={S}>{dl!==null&&dl>=0?<span style={{fontSize:10,fontWeight:600,background:dl<=2?"rgba(255,59,48,0.1)":"rgba(255,159,10,0.1)",color:dl<=2?"#FF3B30":"#FF9F0A",borderRadius:20,padding:"2px 8px"}}>{dl===0?"Last day":`${dl}d left`}</span>:<span style={{color:"#AEAEB2",fontSize:11}}>—</span>}</td>
                                <td style={S}><button onClick={()=>{if(cart.find((c:any)=>c.id===item.id)){toast("Already in cart");return;}addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:"🛒"});toast.success("Added");}} style={{padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff",whiteSpace:"nowrap" as const}}>{inCart?"✓ Added":"+ Add"}</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Compare Cards View */}
                {view==="cards"&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
                    {cResults.map((item,i)=>{
                      const color=STORE_COLORS[item.brand?.slug]||"#FF9F0A";
                      const extra=i>0?(item.price-cheapest).toFixed(2):null;
                      const inCart=!!cart.find((c:any)=>c.id===item.id);
                      return(
                        <div key={item.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:i===0?"0 2px 12px rgba(255,159,10,0.15)":"0 1px 4px rgba(0,0,0,0.07)",border:i===0?"1px solid rgba(255,159,10,0.3)":"none",position:"relative"}}>
                          {i===0&&<div style={{position:"absolute",top:8,right:8,fontSize:14}}>🏆</div>}
                          <div style={{height:4,background:color}}/>
                          <div style={{padding:12}}>
                            <div style={{fontSize:11,color:"#AEAEB2",marginBottom:2}}>{item.brand?.name}</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#1C1C1E",marginBottom:8,lineHeight:1.3}}>{item.name}</div>
                            <div style={{fontSize:20,fontWeight:800,color:i===0?"#FF9F0A":"#1C1C1E",letterSpacing:-0.5}}>${item.price?.toFixed(2)}</div>
                            <div style={{fontSize:10,color:"#AEAEB2",marginBottom:6}}>/{item.unit||"ea"}</div>
                            {extra&&<div style={{fontSize:11,color:"#FF3B30",fontWeight:600,marginBottom:6}}>+${extra} more</div>}
                            <button onClick={()=>{if(cart.find((c:any)=>c.id===item.id)){toast("Already in cart");return;}addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:"🛒"});toast.success("Added");}} style={{width:"100%",padding:"7px",borderRadius:9,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:inCart?"#F2F2F7":"#FF9F0A",color:inCart?"#AEAEB2":"#fff"}}>
                              {inCart?"✓":"+ Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  return(
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",color:"#FF9F0A"}}>Loading...</div>}>
      <DealsContent/>
    </Suspense>
  );
}
