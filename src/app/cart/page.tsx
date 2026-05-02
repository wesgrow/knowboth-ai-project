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
  // highPriceMap: highest known price per normalized_name (for savings calc)
  // cheapMap: cheapest price elsewhere per normalized_name (for "also at" hint)
  const [highPriceMap, setHighPriceMap] = useState<Record<string, {price:number, label:string}>>({});
  const [cheapMap, setCheapMap] = useState<Record<string, {price:number, store:string}>>({});
  const currency = user?.currency || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency}).format(n);
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"");

  useEffect(() => {
    const priced = cart.filter(i => (i.price||0) > 0);
    if (!priced.length) { setHighPriceMap({}); setCheapMap({}); return; }
    const normNames = [...new Set(priced.map(i => norm(i.name)))];
    // price lookup keyed by normalized_name → cart price (for comparison)
    const cartPriceByNorm: Record<string, number> = {};
    priced.forEach(i => { cartPriceByNorm[norm(i.name)] = Math.min(cartPriceByNorm[norm(i.name)] ?? Infinity, i.price); });
    const cartStoreByNorm: Record<string, string> = {};
    priced.forEach(i => { cartStoreByNorm[norm(i.name)] = (i.store||"").toLowerCase(); });

    Promise.all([
      // Scenario 1+2: deal_items → regular_price AND other-store deal prices
      supabase.from("deal_items").select("normalized_name,price,regular_price").in("normalized_name", normNames),
      // Scenario 3: price_history → community prices (max & cheapest elsewhere)
      supabase.from("price_history").select("normalized_name,store_name,price").in("normalized_name", normNames),
    ]).then(([r1, r2]) => {
      const hMap: Record<string, {price:number, label:string}> = {};
      const cMap: Record<string, {price:number, store:string}> = {};

      const bump = (n: string, price: number, label: string) => {
        if (price > (cartPriceByNorm[n] ?? 0) && (!hMap[n] || price > hMap[n].price))
          hMap[n] = { price, label };
      };

      // deal_items: check regular_price + all prices (highest = what others pay)
      for (const row of r1.data || []) {
        if (row.regular_price) bump(row.normalized_name, row.regular_price, "regular price");
        bump(row.normalized_name, row.price, "other stores");
      }

      // price_history: max community price + cheapest elsewhere
      for (const row of r2.data || []) {
        const isSameStore = cartStoreByNorm[row.normalized_name] === (row.store_name||"").toLowerCase().trim();
        bump(row.normalized_name, row.price, `at ${row.store_name}`);
        if (!isSameStore) {
          const ex = cMap[row.normalized_name];
          if (!ex || row.price < ex.price) cMap[row.normalized_name] = { price: row.price, store: row.store_name };
        }
      }

      setHighPriceMap(hMap);
      setCheapMap(cMap);
    });
  }, [cart]);

  async function logAsExpense(item: ReturnType<typeof useAppStore.getState>["cart"][0]) {
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) return toast.error("Sign in required");
      const { data: dup } = await supabase.from("expense_items").select("id").ilike("name", item.name).limit(1);
      if (dup?.length && !window.confirm(`"${item.name}" may already be in expenses. Add anyway?`)) return;
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
      <style>{`
        .cart-item-row{transition:opacity .2s}
        .cart-action-btn{border:none;border-radius:6px;padding:3px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit}
        .qty-btn{width:26px;height:26px;border-radius:8px;border:none;background:var(--bg);color:var(--text);cursor:pointer;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center}
        @media(hover:none){.cart-item-row:active{opacity:.85}}
      `}</style>
      <div style={{background:"var(--bg)",minHeight:"100vh",paddingBottom:80}}>
        <div style={{maxWidth:720,width:"100%",margin:"0 auto",padding:"20px 18px"}}>

          {/* Header */}
          <div className="fade-up" style={{marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8,margin:0}}>My Cart</h1>
                <p style={{fontSize:13,color:"var(--text3)",marginTop:3,marginBottom:0}}>
                  {itemCount > 0 ? `${itemCount} item${itemCount!==1?"s":""} · ${storeCount} store${storeCount!==1?"s":""}` : "Empty"}
                </p>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setShowAddForm(true)}
                  style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 3px 10px rgba(255,159,10,.3)"}}>
                  + Add Item
                </button>
                {cart.length > 0 && (
                  <button onClick={()=>{if(window.confirm("Clear all items?"))clearCart();}}
                    style={{background:"rgba(255,59,48,.08)",border:"1px solid rgba(255,59,48,.2)",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {cart.length === 0 && (
            <div className="fade-up" style={{textAlign:"center",padding:"72px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>🛒</div>
              <div style={{fontSize:18,fontWeight:700,color:"var(--text)",marginBottom:8}}>Your cart is empty</div>
              <p style={{fontSize:14,color:"var(--text2)",marginBottom:24}}>Browse deals and add items to your cart</p>
              <button onClick={()=>router.push("/deals")}
                style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"12px 24px",fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,.3)",fontFamily:"inherit"}}>
                Browse Deals →
              </button>
            </div>
          )}

          {/* Store grouped items */}
          {Object.entries(groups).map(([storeName, items]) => {
            const color = STORE_COLORS[items[0]?.store_slug] || "#FF9F0A";
            const storeTotal = items.reduce((s,i)=>(i.price||0)*i.qty+s,0);
            return (
              <div key={storeName} className="fade-up" style={{marginBottom:16}}>
                {/* Store label */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingLeft:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{storeName}</span>
                    <span style={{fontSize:11,color:"var(--text3)"}}>({items.length} item{items.length!==1?"s":""})</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color}}>{fmt(storeTotal)}</span>
                </div>

                {/* Item rows */}
                <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow)"}}>
                  {items.map((item, i) => (
                    <div key={item.id} className="cart-item-row"
                      style={{display:"flex",alignItems:"flex-start",gap:10,padding:"13px 16px",borderBottom:i<items.length-1?"0.5px solid var(--border2)":"none",opacity:item.purchased?0.45:1}}>

                      {/* Checkbox */}
                      <button onClick={()=>togglePurchased(item.id)}
                        style={{width:26,height:26,marginTop:2,borderRadius:8,border:`2px solid ${item.purchased?"var(--green)":"var(--border)"}`,background:item.purchased?"var(--green)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s",fontFamily:"inherit"}}>
                        {item.purchased && <span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                      </button>

                      {/* Icon */}
                      <div style={{width:36,height:36,borderRadius:10,background:`${color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
                        {CAT_ICONS[item.category]||"📦"}
                      </div>

                      {/* Info + actions */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--text)",wordBreak:"break-word",lineHeight:1.3,textDecoration:item.purchased?"line-through":"none"}}>{item.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{item.category} · {item.unit}</div>
                        <input
                          key={`note-${item.id}`}
                          type="text"
                          defaultValue={item.notes || ""}
                          placeholder="Add note…"
                          onBlur={e => updateNotes(item.id, e.target.value)}
                          style={{marginTop:5,width:"100%",fontSize:11,color:"var(--text2)",background:"transparent",border:"none",borderBottom:"0.5px solid var(--border2)",padding:"2px 0",outline:"none",fontFamily:"inherit"}}
                        />
                        <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                          <button className="cart-action-btn" onClick={()=>{moveToPantry(item);toast.success(`${item.name} moved to stock`);}}
                            style={{background:"rgba(48,209,88,.1)",color:"var(--green)"}}>📦 Stock</button>
                          <button className="cart-action-btn" onClick={()=>logAsExpense(item)}
                            style={{background:"rgba(10,132,255,.1)",color:"var(--blue)"}}>💸 Add to Expenses</button>
                          <button onClick={()=>{removeFromCart(item.id);toast(`${item.name} removed`);}}
                            style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,padding:"2px 5px",lineHeight:1,fontFamily:"inherit"}}>✕</button>
                        </div>
                      </div>

                      {/* Qty + Price */}
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <button className="qty-btn" onClick={()=>updateQty(item.id,item.qty-1)}>−</button>
                          <input
                            key={`qty-${item.id}-${item.qty}`}
                            type="number"
                            defaultValue={item.qty}
                            min="0.01"
                            step="0.01"
                            onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0)updateQty(item.id,v);}}
                            style={{width:46,fontSize:13,fontWeight:700,color:"var(--text)",textAlign:"center",border:"1px solid var(--border)",borderRadius:7,background:"var(--bg)",padding:"2px 4px",outline:"none",fontFamily:"inherit"}}
                          />
                          <button className="qty-btn" onClick={()=>updateQty(item.id,item.qty+1)}>+</button>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:14,fontWeight:700,color:"var(--gold)"}}>{fmt((item.price||0)*item.qty)}</div>
                          {item.qty > 1 && <div style={{fontSize:10,color:"var(--text3)"}}>{fmt(item.price)}/ea</div>}
                          {(()=>{
                            const n = norm(item.name);
                            const high = highPriceMap[n];
                            if (!high) return null;
                            const saved = high.price - (item.price||0);
                            const pct = Math.round(saved / high.price * 100);
                            return (
                              <div style={{fontSize:10,color:"#30D158",fontWeight:700,marginTop:2,whiteSpace:"nowrap"}}>
                                🏷️ {fmt(saved)}/ea off ({pct}%) vs {high.label}
                              </div>
                            );
                          })()}
                          {(()=>{
                            const n = norm(item.name);
                            const cheaper = cheapMap[n];
                            const iStore = (item.store||"").toLowerCase().trim();
                            if (cheaper && cheaper.price < (item.price||0) && cheaper.store.toLowerCase().trim() !== iStore) {
                              return <div style={{fontSize:10,color:"var(--blue)",fontWeight:600,marginTop:1,whiteSpace:"nowrap"}}>Also @ {cheaper.store} {fmt(cheaper.price)}</div>;
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

          {/* Deal savings banner */}
          {(()=>{
            const dealSavingsTotal = cart.reduce((sum, item) => {
              const high = highPriceMap[norm(item.name)];
              if (high && high.price > (item.price||0)) return sum + (high.price - (item.price||0)) * item.qty;
              return sum;
            }, 0);
            if (dealSavingsTotal <= 0) return null;
            const dealItemCount = cart.filter(i => { const h = highPriceMap[norm(i.name)]; return h && h.price > (i.price||0); }).length;
            return (
              <div className="fade-up" style={{display:"flex",alignItems:"center",gap:12,background:"rgba(48,209,88,0.07)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:14,padding:"14px 18px",marginBottom:16}}>
                <div style={{fontSize:28,flexShrink:0}}>🏷️</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#30D158"}}>You're saving {fmt(dealSavingsTotal)} on deals!</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{dealItemCount} item{dealItemCount!==1?"s":""} at deal price vs regular price</div>
                </div>
                <div style={{fontSize:20,fontWeight:900,color:"#30D158",flexShrink:0}}>{fmt(dealSavingsTotal)}</div>
              </div>
            );
          })()}

          {/* Checkout summary */}
          {cart.length > 0 && (
            <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:16}}>
              <button onClick={()=>setShowSummary(!showSummary)}
                style={{width:"100%",padding:"14px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"inherit"}}>
                <span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>🧾 Checkout Summary</span>
                <span style={{fontSize:13,color:"var(--text3)"}}>{showSummary?"▲":"▼"}</span>
              </button>
              {showSummary && (
                <div style={{borderTop:"0.5px solid var(--border2)"}}>
                  {storeTotals.map((s, i) => {
                    const color = STORE_COLORS[s.slug] || "#FF9F0A";
                    return (
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
                  {(()=>{
                    const ds = cart.reduce((sum,i)=>{
                      const high = highPriceMap[norm(i.name)];
                      if(high&&high.price>(i.price||0)) return sum+(high.price-(i.price||0))*i.qty;
                      return sum;
                    },0);
                    if(ds<=0) return null;
                    return (
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"rgba(48,209,88,0.05)",borderTop:"0.5px solid rgba(48,209,88,0.15)"}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#30D158"}}>🏷️ Deal savings</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#30D158"}}>−{fmt(ds)}</div>
                      </div>
                    );
                  })()}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text2)"}}>Total ({itemCount} items)</div>
                      {storeCount > 1 && <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{storeCount} stores to visit</div>}
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:"var(--gold)"}}>{fmt(total)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom bar */}
          {cart.length > 0 && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--surf)",borderRadius:16,padding:"16px 20px",boxShadow:"var(--shadow)"}}>
              <div>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,letterSpacing:0.6,textTransform:"uppercase"}}>Estimated Total</div>
                <div style={{fontSize:26,fontWeight:900,color:"var(--gold)",letterSpacing:-0.5,lineHeight:1.1}}>{fmt(total)}</div>
              </div>
              <button onClick={()=>router.push("/scan")}
                style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,padding:"13px 20px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,.3)",fontFamily:"inherit"}}>
                🧾 Upload Bill →
              </button>
            </div>
          )}
        </div>
      </div>
      {showAddForm && <AddCartItemForm onClose={()=>setShowAddForm(false)}/>}
    </>
  );
}
