"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getFreshness, CAT_ICONS, STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

function CompareContent() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("item")||"");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToCart, cart } = useAppStore();

  useEffect(() => { if(params.get("item")) doCompare(params.get("item")!); }, []);

  async function doCompare(term?: string) {
    const search = term||q; if(!search.trim()) return;
    setLoading(true);
    const { data } = await supabase.from("deal_items")
      .select(`id,name,normalized_name,price,regular_price,unit,category,savings_pct,
        deals!inner(sale_end,status,brands(id,name,slug),store_locations(branch_name,city,zip,lat,lng))`)
      .ilike("normalized_name",`%${search}%`)
      .eq("deals.status","approved")
      .order("price",{ascending:true})
      .limit(10);
    setResults(data||[]);
    setLoading(false);
  }

  function handleAdd(item: any) {
    const brand = item.deals?.brands;
    if(cart.find(i=>i.id===item.id)){ toast("Already in cart"); return; }
    addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:brand?.name||"",store_slug:brand?.slug||"",category:item.category||"Other",icon:CAT_ICONS[item.category]||"🛒"});
    toast.success(`✦ Added from ${brand?.name}`);
  }

  const cheapest = results[0]?.price;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <Navbar />
      <div style={{maxWidth:800,margin:"0 auto",padding:"16px 14px"}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:4,color:"var(--text)"}}>Price Compare</h1>
          <p style={{fontSize:12,color:"var(--text-muted)"}}>Find the cheapest store for any item near you</p>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCompare()} placeholder="Search toor dal, rice, ghee..." style={{flex:1}} />
          <button className="btn-gold" onClick={()=>doCompare()} style={{padding:"10px 20px",whiteSpace:"nowrap"}}>Compare</button>
        </div>
        {loading && <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-muted)"}}>Finding best prices...</div>}
        {!loading && results.length===0 && q && <div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:44,marginBottom:12}}>⚖️</div><div style={{fontSize:16,fontWeight:700}}>No results found</div></div>}
        {results.length>0 && <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>{results.length} stores · sorted cheapest first</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {results.map((item,i)=>{
            const brand=item.deals?.brands;
            const loc=item.deals?.store_locations;
            const color=STORE_COLORS[brand?.slug]||"var(--gold)";
            const fresh=getFreshness(item.created_at);
            const extra=i>0?(item.price-cheapest).toFixed(2):null;
            const inCart=cart.find(c=>c.id===item.id);
            return (
              <div key={item.id} style={{background:"var(--surf)",border:`1px solid ${i===0?"rgba(245,166,35,0.4)":"var(--border)"}`,borderRadius:14,padding:"14px 16px",position:"relative",boxShadow:i===0?"0 0 20px rgba(245,166,35,0.08)":"none"}}>
                {i===0 && <div style={{position:"absolute",top:-9,left:14,background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",color:"#000",fontSize:9,fontWeight:900,padding:"2px 8px",borderRadius:20}}>🏆 BEST PRICE</div>}
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:i===0?"rgba(245,166,35,0.12)":"var(--surf2)",border:`1px solid ${i===0?"rgba(245,166,35,0.35)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:i===0?"var(--gold)":"var(--text-dim)",flexShrink:0}}>{i+1}</div>
                  <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{brand?.name}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{loc?.branch_name} · {loc?.city}</div>
                    <span className={`pill fresh-${fresh.level}`} style={{fontSize:9,marginTop:4,display:"inline-flex"}}>{fresh.label}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:900,color:i===0?"var(--gold)":"var(--text)"}}>${item.price?.toFixed(2)}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)"}}>/{item.unit||"ea"}</div>
                    {extra && <div style={{fontSize:10,color:"var(--red)",fontWeight:700}}>+${extra} more</div>}
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
                  <button onClick={()=>handleAdd(item)} className={inCart?"btn-ghost":"btn-gold"} style={{padding:"7px 16px",fontSize:12}}>
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

export default function ComparePage() {
  return <Suspense fallback={<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--gold)"}}>Loading...</div>}><CompareContent /></Suspense>;
}
