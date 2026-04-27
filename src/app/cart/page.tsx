"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { STORE_COLORS } from "@/lib/utils";
import toast from "react-hot-toast";

const CAT_ICONS: Record<string,string> = {
  Grocery:"🛒",Vegetables:"🥦",Fruits:"🍎",Dairy:"🥛",
  "Rice & Grains":"🌾","Lentils & Dals":"🫘",Spices:"🌶️",
  Snacks:"🍿",Beverages:"🧃","Oils & Ghee":"🫙",Frozen:"❄️",
  "Meat & Fish":"🍗",Bakery:"🍞",Household:"🏠",Other:"📦",
};

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQty, clearCart, user } = useAppStore();
  const [showSummary, setShowSummary] = useState(false);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency}).format(n);

  const groups: Record<string,any[]> = {};
  cart.forEach(item => {
    const s = item.store || "Other";
    if (!groups[s]) groups[s] = [];
    groups[s].push(item);
  });

  const total = cart.reduce((s,i) => (i.price||0)*i.qty + s, 0);
  const itemCount = cart.reduce((s,i) => s+i.qty, 0);
  const storeCount = Object.keys(groups).length;
  const storeTotals = Object.entries(groups).map(([store,items]) => ({
    store, slug: items[0]?.store_slug || "",
    total: items.reduce((s,i)=>(i.price||0)*i.qty+s,0),
    count: items.reduce((s,i)=>s+i.qty,0),
  })).sort((a,b)=>b.total-a.total);

  return (
    <>
      <div style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{padding:"20px 24px",maxWidth:1200,width:"100%"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,color:"var(--text)",letterSpacing:-0.5}}>My Cart</h1>
              <p style={{fontSize:13,color:"var(--text2)",marginTop:3}}>{itemCount} items · {storeCount} store{storeCount!==1?"s":""}</p>
            </div>
            {cart.length>0&&(
              <button onClick={()=>{if(window.confirm("Clear all items?"))clearCart();}}
                style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:"var(--red)",cursor:"pointer"}}>
                Clear All
              </button>
            )}
          </div>

          {/* Empty state */}
          {cart.length===0&&(
            <div style={{textAlign:"center",padding:"80px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>🛒</div>
              <div style={{fontSize:18,fontWeight:700,color:"var(--text)",marginBottom:8}}>Cart is empty</div>
              <p style={{fontSize:14,color:"var(--text2)",marginBottom:24}}>Browse deals and add items to your cart</p>
              <button onClick={()=>router.push("/deals")}
                style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"12px 24px",fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                Browse Deals →
              </button>
            </div>
          )}

          {/* Store grouped items */}
          {Object.entries(groups).map(([storeName,items])=>{
            const color = STORE_COLORS[items[0]?.store_slug] || "#FF9F0A";
            const storeTotal = items.reduce((s,i)=>(i.price||0)*i.qty+s,0);
            return(
              <div key={storeName} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,paddingLeft:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                    <span style={{fontSize:12,fontWeight:700,color:"var(--text)"}}>{storeName}</span>
                    <span style={{fontSize:11,color:"var(--text3)"}}>({items.length} item{items.length!==1?"s":""})</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color}}>{fmt(storeTotal)}</span>
                </div>
                <div style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)"}}>
                  {items.map((item,i)=>(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<items.length-1?"0.5px solid var(--border2)":"none"}}>
                      <div style={{width:38,height:38,borderRadius:10,background:`${color}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                        {CAT_ICONS[item.category]||"📦"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{item.category} · {item.unit}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <button onClick={()=>updateQty(item.id,item.qty-1)} style={{width:26,height:26,borderRadius:8,border:"none",background:"var(--bg)",color:"var(--text)",cursor:"pointer",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                        <span style={{fontSize:14,fontWeight:700,color:"var(--text)",minWidth:20,textAlign:"center"}}>{item.qty}</span>
                        <button onClick={()=>updateQty(item.id,item.qty+1)} style={{width:26,height:26,borderRadius:8,border:"none",background:"var(--bg)",color:"var(--text)",cursor:"pointer",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,minWidth:56}}>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--gold)"}}>{fmt((item.price||0)*item.qty)}</div>
                        {item.qty>1&&<div style={{fontSize:10,color:"var(--text3)"}}>{fmt(item.price)}/ea</div>}
                        <button onClick={()=>{removeFromCart(item.id);toast(`${item.name} removed`);}}
                          style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:16,padding:"4px",flexShrink:0}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          {cart.length>0&&(
            <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:20}}>
              <button onClick={()=>setShowSummary(!showSummary)}
                style={{width:"100%",padding:"14px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>🧾 Checkout Summary</span>
                <span style={{fontSize:14,color:"var(--text3)"}}>{showSummary?"▲":"▼"}</span>
              </button>
              {showSummary&&(
                <div style={{borderTop:"0.5px solid var(--border2)"}}>
                  {storeTotals.map((s,i)=>{
                    const color = STORE_COLORS[s.slug] || "#FF9F0A";
                    return(
                      <div key={s.store} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:i<storeTotals.length-1?"0.5px solid var(--border2)":"none"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{s.store}</div>
                          <div style={{fontSize:11,color:"var(--text3)"}}>{s.count} item{s.count!==1?"s":""}</div>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color}}>{fmt(s.total)}</div>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>Total ({itemCount} items)</div>
                      {storeCount>1&&<div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{storeCount} stores to visit</div>}
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:"var(--gold)"}}>{fmt(total)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom action */}
          {cart.length>0&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--surf)",borderRadius:14,padding:"16px 20px",boxShadow:"var(--shadow)"}}>
              <div>
                <div style={{fontSize:11,color:"var(--text3)",fontWeight:600,letterSpacing:0.5}}>ESTIMATED TOTAL</div>
                <div style={{fontSize:24,fontWeight:900,color:"var(--gold)",letterSpacing:-0.5}}>{fmt(total)}</div>
              </div>
              <button onClick={()=>router.push("/scan")}
                style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"12px 20px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                🧾 Upload Bill →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
