"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { getFreshness, CAT_ICONS, STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

function CompareContent() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("item")||"");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart, cart } = useAppStore();

  useEffect(()=>{ if(params.get("item")) doCompare(params.get("item")!); },[]);

  function srcIcon(s:string|null){ return s==="receipt"?"🧾":s==="flyer"?"📄":"✏️"; }
  function timeAgo(ts:string){
    const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);
    if(m<60)return `${m}m ago`;
    const h=Math.floor(m/60);
    if(h<24)return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }

  async function doCompare(term?:string) {
    const search=term||q;
    if(!search.trim())return;
    setLoading(true);
    const {data:dealItems}=await supabase.from("deal_items")
      .select("id,name,price,regular_price,unit,category,created_at,deal_id,source")
      .ilike("normalized_name",`%${search}%`)
      .order("price",{ascending:true}).limit(10);
    if(!dealItems?.length){setResults([]);setLoading(false);return;}
    const dealIds=dealItems.map((d:any)=>d.deal_id);
    const {data:deals}=await supabase.from("deals").select("id,sale_end,brand_id,location_id").in("id",dealIds).eq("status","approved");
    const approvedIds=new Set((deals||[]).map((d:any)=>d.id));
    const filtered=dealItems.filter((i:any)=>approvedIds.has(i.deal_id));
    const brandIds=[...new Set((deals||[]).map((d:any)=>d.brand_id).filter(Boolean))];
    const locIds=[...new Set((deals||[]).map((d:any)=>d.location_id).filter(Boolean))];
    const {data:brands}=await supabase.from("brands").select("id,name,slug").in("id",brandIds as string[]);
    const {data:locs}=locIds.length>0?await supabase.from("store_locations").select("id,branch_name,city").in("id",locIds as string[]):{data:[]};
    const brandMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{brandMap[b.id]=b;});
    const dealMap:Record<string,any>={};(deals||[]).forEach((d:any)=>{dealMap[d.id]=d;});
    const locMap:Record<string,any>={};(locs||[]).forEach((l:any)=>{locMap[l.id]=l;});
    const merged=filtered.map((item:any)=>{const deal=dealMap[item.deal_id];return{...item,deal,brand:brandMap[deal?.brand_id],location:locMap[deal?.location_id]};});
    setResults(merged);
    setLoading(false);
  }

  function handleAdd(item:any) {
    if(cart.find((i:any)=>i.id===item.id)){toast("Already in cart");return;}
    addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:item.brand?.name||"",store_slug:item.brand?.slug||"",category:item.category||"Other",icon:CAT_ICONS[item.category]||"🛒"});
    toast.success(`✦ Added from ${item.brand?.name}`);
  }

  const cheapest=results[0]?.price;

  return (
    <>
      <div className="page-body" style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div className="container" style={{padding:"20px 24px"}}>
          <div style={{marginBottom:16}}>
            <h1 style={{fontSize:22,fontWeight:700,color:"var(--text)"}}>Price Compare</h1>
            <p style={{fontSize:12,color:"var(--text-muted)",marginTop:3}}>Find cheapest store · See price source</p>
          </div>

          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCompare()} placeholder="Search toor dal, rice, ghee..." style={{flex:1}} />
            <button className="btn-gold" onClick={()=>doCompare()} style={{padding:"10px 20px",whiteSpace:"nowrap"}}>Compare</button>
          </div>

          {loading&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--text-muted)"}}>Finding best prices...</div>}

          {!loading&&results.length===0&&q&&(
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:44,marginBottom:12}}>⚖️</div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--text)"}}>No results found</div>
              <p style={{fontSize:12,color:"var(--text-muted)",marginTop:6}}>Try a different item name</p>
            </div>
          )}

          {results.length>0&&<div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>{results.length} stores · cheapest first</div>}

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {results.map((item,i)=>{
              const color=STORE_COLORS[item.brand?.slug]||"var(--gold)";
              const fresh=getFreshness(item.created_at);
              const extra=i>0?(item.price-cheapest).toFixed(2):null;
              const inCart=cart.find((c:any)=>c.id===item.id);
              const dl=item.deal?.sale_end?Math.ceil((new Date(item.deal.sale_end).getTime()-Date.now())/86400000):null;
              return(
                <div key={item.id} style={{background:"var(--surf)",border:`1px solid ${i===0?"rgba(245,166,35,0.4)":"var(--border)"}`,borderRadius:14,padding:"14px 16px",position:"relative",boxShadow:i===0?"0 0 20px rgba(245,166,35,0.06)":"none"}}>
                  {i===0&&<div style={{position:"absolute",top:-9,left:14,background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",color:"#000",fontSize:9,fontWeight:900,padding:"2px 10px",borderRadius:20}}>🏆 BEST PRICE</div>}
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    {/* Rank */}
                    <div style={{width:28,height:28,borderRadius:"50%",background:i===0?"rgba(245,166,35,0.12)":"var(--surf2)",border:`1px solid ${i===0?"rgba(245,166,35,0.35)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:i===0?"var(--gold)":"var(--text-dim)",flexShrink:0}}>
                      {i+1}
                    </div>
                    {/* Store dot */}
                    <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,marginTop:6}} />
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:2}}>{item.name}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text-muted)"}}>{item.brand?.name}</div>
                      {item.location&&<div style={{fontSize:11,color:"var(--text-dim)",marginTop:1}}>{item.location.branch_name} · {item.location.city}</div>}
                      {/* Source */}
                      <div style={{fontSize:10,color:"var(--text-dim)",marginTop:4}}>{srcIcon(item.source)} {item.source||"manual"} · {timeAgo(item.created_at)}</div>
                      {/* Badges */}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,marginTop:6}}>
                        <span className={`pill fresh-${fresh.level}`} style={{fontSize:9}}>{fresh.label}</span>
                        {dl!==null&&dl>=0&&<span style={{borderRadius:20,padding:"2px 7px",fontSize:9,fontWeight:700,background:dl<=2?"rgba(255,71,87,0.1)":"rgba(245,166,35,0.1)",color:dl<=2?"var(--red)":"var(--gold)",border:`1px solid ${dl<=2?"rgba(255,71,87,0.3)":"rgba(245,166,35,0.3)"}`}}>⏰ {dl===0?"Last day":`${dl}d left`}</span>}
                      </div>
                    </div>
                    {/* Price */}
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:22,fontWeight:900,color:i===0?"var(--gold)":"var(--text)",lineHeight:1}}>${item.price?.toFixed(2)}</div>
                      <div style={{fontSize:10,color:"var(--text-dim)"}}>/{item.unit||"ea"}</div>
                      {item.regular_price&&<div style={{fontSize:10,color:"var(--text-dim)",textDecoration:"line-through"}}>${item.regular_price?.toFixed(2)}</div>}
                      {extra&&<div style={{fontSize:10,color:"var(--red)",fontWeight:700}}>+${extra} more</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
                    <button onClick={()=>handleAdd(item)} className={inCart?"btn-ghost":"btn-gold"} style={{padding:"7px 16px",fontSize:12,opacity:i>0?0.85:1}}>
                      {inCart?"✓ Added":"+ Add to Cart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ComparePage() {
  return(
    <Suspense fallback={<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--gold)"}}>Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}