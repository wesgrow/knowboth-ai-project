"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { STORE_COLORS } from "@/lib/utils";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { AddCartItemForm } from "@/components/AddCartItemForm";
import toast from "react-hot-toast";

const CAT_ICONS: Record<string,string> = {
  Grocery:"🛒",Vegetables:"🥦",Fruits:"🍎",Dairy:"🥛",
  "Rice & Grains":"🌾","Lentils & Dals":"🫘",Spices:"🌶️",
  Snacks:"🍿",Beverages:"🧃","Oils & Ghee":"🫙",Frozen:"❄️",
  "Meat & Fish":"🍗",Bakery:"🍞",Household:"🏠",Other:"📦",
};

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQty, clearCart, togglePurchased, moveToPantry, updateNotes, user } = useAppStore();
  const [showSummary, setShowSummary] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingsMap, setSavingsMap] = useState<Record<string, {price:number, store:string}>>({});
  const currency = user?.currency || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency}).format(n);

  useEffect(() => {
    const itemsWithPrice = cart.filter(i => (i.price || 0) > 0);
    if (!itemsWithPrice.length) { setSavingsMap({}); return; }
    const normNames = [...new Set(itemsWithPrice.map(i =>
      i.name.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"")
    ))];
    Promise.resolve(
      supabase.from("price_history").select("normalized_name,store_name,price").in("normalized_name", normNames)
    ).then(({ data }) => {
      if (!data) return;
      const map: Record<string, {price:number, store:string}> = {};
      for (const row of data) {
        const ex = map[row.normalized_name];
        if (!ex || row.price < ex.price) map[row.normalized_name] = { price: row.price, store: row.store_name };
      }
      setSavingsMap(map);
    });
  }, [cart]);

  async function logAsExpense(item: ReturnType<typeof useAppStore.getState>["cart"][0]) {
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) return toast.error("Sign in required");
      const { data: exp, error: e1 } = await supabase.from("expenses").insert({
        user_id: session.user.id,
        store_name: item.store || "Unknown",
        store_city: "",
        brand_id: item.store_id || null,
        purchase_date: new Date().toISOString().split("T")[0],
        currency,
        total: (item.price || 0) * item.qty,
        items_count: 1,
        source: "manual",
      }).select("id").single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("expense_items").insert({
        expense_id: exp.id,
        name: item.name,
        price: item.price || 0,
        quantity: item.qty,
        unit: item.unit || "ea",
        category: item.category,
        notes: item.notes || null,
      });
      if (e2) throw e2;
      removeFromCart(item.id);
      toast.success(`${item.name} logged as expense`);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  }

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
              <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>My Cart</h1>
              <p style={{fontSize:13,color:"var(--text2)",marginTop:3}}>{itemCount} items · {storeCount} store{storeCount!==1?"s":""}</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setShowAddForm(true)}
                style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"9px 14px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                + Add Item
              </button>
              {cart.length>0&&(
                <button onClick={()=>{if(window.confirm("Clear all items?"))clearCart();}}
                  style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:"var(--red)",cursor:"pointer"}}>
                  Clear All
                </button>
              )}
            </div>
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
                    <div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 16px",borderBottom:i<items.length-1?"0.5px solid var(--border2)":"none",opacity:item.purchased?0.5:1,transition:"opacity 0.2s"}}>

                      {/* Mark as purchased */}
                      <button onClick={()=>togglePurchased(item.id)}
                        style={{width:26,height:26,marginTop:2,borderRadius:8,border:`2px solid ${item.purchased?"var(--green)":"var(--border)"}`,background:item.purchased?"var(--green)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                        {item.purchased&&<span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                      </button>

                      <div style={{width:36,height:36,borderRadius:10,background:`${color}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
                        {CAT_ICONS[item.category]||"📦"}
                      </div>

                      {/* Name + category + action buttons */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--text)",wordBreak:"break-word",lineHeight:1.3,textDecoration:item.purchased?"line-through":"none"}}>{item.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{item.category} · {item.unit}</div>
                        <input
                          key={`note-${item.id}`}
                          type="text"
                          defaultValue={item.notes || ""}
                          placeholder="Add note…"
                          onBlur={e => updateNotes(item.id, e.target.value)}
                          style={{marginTop:4,width:"100%",fontSize:11,color:"var(--text2)",background:"transparent",border:"none",borderBottom:"0.5px solid var(--border2)",padding:"2px 0",outline:"none",fontFamily:"inherit"}}
                        />
                        <div style={{display:"flex",gap:4,marginTop:7,flexWrap:"wrap"}}>
                          <button onClick={()=>{moveToPantry(item);toast.success(`${item.name} moved to stock`);}}
                            title="Move to Stock"
                            style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:"var(--green)",cursor:"pointer"}}>
                            📦 Stock
                          </button>
                          <button onClick={()=>logAsExpense(item)}
                            title="Log as Expense"
                            style={{background:"rgba(10,132,255,0.1)",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:"var(--blue)",cursor:"pointer"}}>
                            💸 Expense
                          </button>
                          <button onClick={()=>{removeFromCart(item.id);toast(`${item.name} removed`);}}
                            style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,padding:"2px 4px",lineHeight:1}}>✕</button>
                        </div>
                      </div>

                      {/* Qty + price stacked on the right */}
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <button onClick={()=>updateQty(item.id,item.qty-1)} style={{width:24,height:24,borderRadius:7,border:"none",background:"var(--bg)",color:"var(--text)",cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                          <input
                            key={`qty-${item.id}-${item.qty}`}
                            type="number"
                            defaultValue={item.qty}
                            min="0.01"
                            step="0.01"
                            onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0)updateQty(item.id,v);}}
                            style={{width:46,fontSize:13,fontWeight:700,color:"var(--text)",textAlign:"center",border:"1px solid var(--border)",borderRadius:7,background:"var(--bg)",padding:"2px 4px",outline:"none"}}
                          />
                          <button onClick={()=>updateQty(item.id,item.qty+1)} style={{width:24,height:24,borderRadius:7,border:"none",background:"var(--bg)",color:"var(--text)",cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:14,fontWeight:700,color:"var(--gold)"}}>{fmt((item.price||0)*item.qty)}</div>
                          {item.qty>1&&<div style={{fontSize:10,color:"var(--text3)"}}>{fmt(item.price)}/ea</div>}
                          {(()=>{
                            const norm = item.name.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"");
                            const cheaper = savingsMap[norm];
                            const iStore = (item.store||"").toLowerCase().trim();
                            const cStore = (cheaper?.store||"").toLowerCase().trim();
                            if (cheaper && (item.price||0) > 0 && cheaper.price < (item.price||0) && cStore !== iStore) {
                              return <div style={{fontSize:10,color:"#30D158",fontWeight:700,marginTop:2,whiteSpace:"nowrap"}}>Save {fmt((item.price||0)-cheaper.price)}/ea @ {cheaper.store}</div>;
                            }
                            return null;
                          })()}
                        </div>
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
      {showAddForm && <AddCartItemForm onClose={() => setShowAddForm(false)} />}
    </>
  );
}
