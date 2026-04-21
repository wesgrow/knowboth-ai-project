"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getFreshness, CAT_ICONS, STORE_COLORS } from "@/lib/utils";
import { PriceSource } from "@/components/PriceSource";
import toast from "react-hot-toast";

const CATS = ["All","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Household"];

export default function DealsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [storeFilter, setStoreFilter] = useState("All");
  const [sort, setSort] = useState("newest");
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

  useEffect(() => { fetchDeals(); }, []);

  async function fetchDeals() {
    setLoading(true);
    const { data: dealRows } = await supabase.from("deals").select("id,sale_end,brand_id,location_id").eq("status","approved");
    if (!dealRows || dealRows.length === 0) { setItems([]); setLoading(false); return; }
    const dealIds = dealRows.map((d:any) => d.id);
    const brandIds = [...new Set(dealRows.map((d:any) => d.brand_id).filter(Boolean))] as string[];
    const { data: brandRows } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
    const { data: dealItems } = await supabase.from("deal_items")
      .select("id,deal_id,name,normalized_name,price,regular_price,unit,category,savings_pct,created_at,source")
      .in("deal_id", dealIds).order("created_at", { ascending: false });
    if (!dealItems) { setLoading(false); return; }
    const brandMap: Record<string,any> = {};
    (brandRows||[]).forEach((b:any) => { brandMap[b.id] = b; });
    const dealMap: Record<string,any> = {};
    dealRows.forEach((d:any) => { dealMap[d.id] = d; });
    const merged = dealItems.map((item:any) => ({ ...item, deal: dealMap[item.deal_id], brand: brandMap[dealMap[item.deal_id]?.brand_id] }));
    setItems(merged);
    setStores([...new Set(merged.map((i:any) => i.brand?.name).filter(Boolean))] as string[]);
    setLoading(false);
  }

  function getDaysLeft(saleEnd: string|null) {
    if (!saleEnd) return null;
    return Math.ceil((new Date(saleEnd).getTime() - Date.now()) / 86400000);
  }

  function getExpiryBadge(saleEnd: string|null) {
    const d = getDaysLeft(saleEnd);
    if (d === null) return null;
    if (d < 0) return { label:"Expired", color:"#FF4757", bg:"rgba(255,71,87,0.1)" };
    if (d === 0) return { label:"Last Day!", color:"#FF4757", bg:"rgba(255,71,87,0.1)" };
    if (d <= 2) return { label:`${d}d left`, color:"#e08918", bg:"rgba(224,137,24,0.1)" };
    if (d <= 7) return { label:`${d}d left`, color:"var(--gold)", bg:"rgba(245,166,35,0.1)" };
    return { label:`${d}d left`, color:"var(--teal)", bg:"rgba(0,212,170,0.1)" };
  }

  function toB64(f:File): Promise<string> {
    return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res((r.result as string).split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });
  }

  async function handleExtract() {
    if (!storeName.trim()) { toast.error("Enter store name"); return; }
    if (uploadMode==="image" && !file) { toast.error("Select a file"); return; }
    if (uploadMode==="url" && !url.trim()) { toast.error("Enter URL"); return; }
    setUploading(true);
    try {
      let body: any = { store: storeName };
      if (uploadMode==="image" && file) { body.b64 = await toB64(file); body.mime = file.type; }
      else { body.url = url; }
      const res = await fetch("/api/extract", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExtracted(data.items||[]);
      setFile(null); setPreview(null);
      toast.success(`✦ Found ${data.items?.length||0} deals!`);
    } catch(e:any) { toast.error("Extract failed: "+e.message); }
    setUploading(false);
  }

  async function publishDeals() {
    if (!extracted.length || !storeName.trim()) return;
    try {
      const { data: brand } = await supabase.from("brands").select("id").ilike("name",`%${storeName}%`).single();
      if (!brand?.id) { toast.error("Store not found"); return; }
      const { data: deal } = await supabase.from("deals").insert({ brand_id:brand.id, status:"approved", applies_to_all_locations:true, sale_start:new Date().toISOString().split("T")[0], sale_end:saleEnd||null }).select("id").single();
      if (!deal?.id) { toast.error("Failed to create deal"); return; }
      await supabase.from("deal_items").insert(extracted.map(item => ({
        deal_id:deal.id, name:item.name,
        normalized_name:item.normalized_name||item.name.toLowerCase(),
        price:parseFloat(item.price)||0,
        regular_price:item.regular_price?parseFloat(item.regular_price):null,
        unit:item.unit||"ea", category:item.category||"Other",
        source: uploadMode==="image" ? "flyer" : "manual",
      })));
      toast.success(`🚀 ${extracted.length} deals published!`);
      setExtracted([]); setStoreName(""); setSaleEnd(""); setUrl(""); setShowUpload(false);
      fetchDeals();
    } catch(e:any) { toast.error("Publish failed: "+e.message); }
  }

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const notExpired = getDaysLeft(item.deal?.sale_end)===null || getDaysLeft(item.deal?.sale_end)! >= 0;
    return (!q||item.name?.toLowerCase().includes(q)) && (cat==="All"||item.category===cat) && (storeFilter==="All"||item.brand?.name===storeFilter) && notExpired;
  }).sort((a,b) => {
    if (sort==="price_asc") return a.price-b.price;
    if (sort==="savings") return (b.savings_pct||0)-(a.savings_pct||0);
    if (sort==="expiring") return (getDaysLeft(a.deal?.sale_end)||999)-(getDaysLeft(b.deal?.sale_end)||999);
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });

  function handleAdd(item:any) {
    if (cart.find(i=>i.id===item.id)) { toast("Already in cart"); return; }
    addToCart({ id:item.id, name:item.name, price:item.price, unit:item.unit||"ea", store:item.brand?.name||"", store_slug:item.brand?.slug||"", category:item.category||"Other", icon:CAT_ICONS[item.category]||"🛒" });
    toast.success(`✦ ${item.name} added`);
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">

        {/* Header row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ position:"relative", flex:1, marginRight:10 }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-dim)" }}>🔍</span>
            <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search any item..." style={{ paddingLeft:36 }} />
          </div>
          <button onClick={()=>setShowUpload(!showUpload)} className="btn-gold" style={{ padding:"10px 14px", fontSize:12, whiteSpace:"nowrap" }}>
            📷 Post Deal
          </button>
        </div>

        {/* Upload Panel */}
        {showUpload && (
          <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:12 }}>Post a Deal</div>
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
              {(["image","url"] as const).map(m=>(
                <button key={m} onClick={()=>setUploadMode(m)} style={{ flex:1, padding:"8px", fontSize:12, fontWeight:700, cursor:"pointer", borderRadius:9, border:"none", background:uploadMode===m?"rgba(245,166,35,0.12)":"var(--surf2)", color:uploadMode===m?"var(--gold)":"var(--text-muted)", outline:uploadMode===m?"1px solid rgba(245,166,35,0.35)":"1px solid var(--border)" }}>
                  {m==="image"?"📷 Upload Flyer":"🔗 Paste URL"}
                </button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <input className="input" value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Store name *" />
              <input className="input" type="date" value={saleEnd} onChange={e=>setSaleEnd(e.target.value)} />
            </div>
            {uploadMode==="image" && (
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>{ const f=e.target.files?.[0]; if(f){setFile(f);setPreview(URL.createObjectURL(f));} }} style={{ display:"none" }} />
                <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){setFile(f);setPreview(URL.createObjectURL(f));} }}
                  style={{ border:`2px dashed ${file?"var(--gold)":"var(--border2)"}`, borderRadius:10, padding:"20px", textAlign:"center", cursor:"pointer", marginBottom:10, background:"var(--surf2)" }}>
                  {preview ? <img src={preview} alt="" style={{ maxHeight:120, borderRadius:8, objectFit:"contain" }} /> : <><div style={{ fontSize:28, marginBottom:6 }}>📷</div><div style={{ fontSize:13, color:"var(--text-muted)" }}>Drop flyer or tap to upload</div></>}
                </div>
              </>
            )}
            {uploadMode==="url" && (
              <input className="input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/weekly-deals" style={{ marginBottom:10 }} />
            )}
            <button onClick={handleExtract} disabled={uploading} className="btn-gold" style={{ width:"100%", padding:12, fontSize:13, opacity:uploading?0.7:1 }}>
              {uploading?"🤖 Extracting...":"🤖 Extract with KNOWBOTH AI"}
            </button>
            {extracted.length>0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{extracted.length} items found</span>
                  <button onClick={publishDeals} style={{ background:"linear-gradient(135deg,var(--teal),#00A882)", color:"#000", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>🚀 Publish</button>
                </div>
                <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
                  {extracted.map((item,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", background:"var(--surf2)", borderRadius:8, padding:"8px 12px" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{item.name}</div>
                        <div style={{ fontSize:10, color:"var(--text-muted)" }}>{item.category} · {item.unit}</div>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:"var(--gold)" }}>${parseFloat(item.price||0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category Pills */}
        <div className="pills-row" style={{ marginBottom:10 }}>
          {CATS.map(c=>(
            <button key={c} onClick={()=>setCat(c)} style={{ borderRadius:20, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", border:"none", background:cat===c?"rgba(245,166,35,0.12)":"var(--surf2)", color:cat===c?"var(--gold)":"var(--text-muted)", outline:cat===c?"1px solid rgba(245,166,35,0.35)":"1px solid var(--border)" }}>
              {c}
            </button>
          ))}
        </div>

        {/* Store Pills */}
        {stores.length>0 && (
          <div className="pills-row" style={{ marginBottom:12 }}>
            {["All",...stores].map(s=>(
              <button key={s} onClick={()=>setStoreFilter(s)} style={{ borderRadius:20, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", border:"none", background:storeFilter===s?"rgba(245,166,35,0.12)":"var(--surf2)", color:storeFilter===s?"var(--gold)":"var(--text-muted)", outline:storeFilter===s?"1px solid rgba(245,166,35,0.35)":"1px solid var(--border)" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Sort + Count */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>{filtered.length} deals</span>
          <select className="input" value={sort} onChange={e=>setSort(e.target.value)} style={{ width:"auto", padding:"6px 12px", fontSize:12 }}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price Low</option>
            <option value="savings">Best Savings</option>
            <option value="expiring">Expiring Soon</option>
          </select>
        </div>

        {loading && <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text-muted)" }}>Loading deals...</div>}
        {!loading && items.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🏪</div>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>No deals yet</div>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:6 }}>Tap Post Deal to add the first deal</p>
          </div>
        )}
        {!loading && items.length>0 && filtered.length===0 && (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>No matches</div>
          </div>
        )}

        {/* Deal Grid */}
        <div className="deals-grid">
          {filtered.map(item => {
            const color = STORE_COLORS[item.brand?.slug]||"var(--gold)";
            const fresh = getFreshness(item.created_at);
            const inCart = cart.find(i=>i.id===item.id);
            const sav = item.regular_price ? Math.round((1-item.price/item.regular_price)*100) : null;
            const expiry = getExpiryBadge(item.deal?.sale_end);
            return (
              <div key={item.id} className="card" style={{ overflow:"hidden" }}>
                <div style={{ height:3, background:color }} />
                <div style={{ padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:9, color:"var(--text-dim)", fontWeight:700, textTransform:"uppercase" }}>{item.category}</span>
                    {sav && <span className="pill pill-teal" style={{ fontSize:9 }}>-{sav}%</span>}
                  </div>
                  <div style={{ fontSize:24, marginBottom:6 }}>{CAT_ICONS[item.category]||"🛒"}</div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:4, lineHeight:1.3, color:"var(--text)" }}>{item.name}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:4 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:"var(--gold)" }}>${item.price?.toFixed(2)}</span>
                    <span style={{ fontSize:10, color:"var(--text-dim)" }}>/{item.unit||"ea"}</span>
                  </div>
                  {item.regular_price && <div style={{ fontSize:10, color:"var(--text-dim)", textDecoration:"line-through", marginBottom:4 }}>${item.regular_price?.toFixed(2)}</div>}

                  {/* Price Source */}
                  <PriceSource
                    storeName={item.brand?.name}
                    lastUpdated={item.created_at}
                    source={item.source}
                    size="sm"
                  />

                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", margin:"8px 0 10px" }}>
                    <span style={{ borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:700, background:`${color}18`, color, border:`1px solid ${color}44` }}>{item.brand?.name}</span>
                    <span className={`pill fresh-${fresh.level}`} style={{ fontSize:9 }}>{fresh.label}</span>
                    {expiry && <span style={{ borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:700, background:expiry.bg, color:expiry.color, border:`1px solid ${expiry.color}44` }}>⏰ {expiry.label}</span>}
                  </div>
                  <button onClick={()=>handleAdd(item)} className={inCart?"btn-ghost":"btn-gold"} style={{ width:"100%", padding:"7px", fontSize:11 }}>
                    {inCart?"✓ Added":"+ Add to Cart"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
