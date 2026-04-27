"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import toast from "react-hot-toast";

const STOCK_CATS = ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"];
const HISTORY_CATS = ["Gas","Restaurant","Pharmacy","Electronics","Other"];

const CAT_ICONS: Record<string,string> = {
  Grocery:"🛒",Vegetables:"🥦",Fruits:"🍎",Dairy:"🥛",
  "Rice & Grains":"🌾","Lentils & Dals":"🫘",Spices:"🌶️",
  Snacks:"🍿",Beverages:"🧃","Oils & Ghee":"🫙",Frozen:"❄️",
  "Meat & Fish":"🍗",Bakery:"🍞",Household:"🏠",
  Gas:"⛽",Restaurant:"🍽️",Pharmacy:"💊",Electronics:"💻",Other:"📦",
};

interface StockItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  store_name: string;
  purchase_date: string;
  expense_id: string;
}

interface PurchaseHistory {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  store_name: string;
  purchase_date: string;
}

export default function StockPage() {
  const router = useRouter();
  const { user, addToCart, cart } = useAppStore();
  const [tab, setTab] = useState<"inventory"|"history">("inventory");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [historyItems, setHistoryItems] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState("");
  const [restockItem, setRestockItem] = useState<StockItem|null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [catFilter, setCatFilter] = useState("All");

  const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:user?.currency||"USD"}).format(n);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data:{ session }, error:authErr } = await supabaseAuth.auth.getSession();
      if (authErr) throw new Error(authErr.message);
      if (!session?.user?.id) { router.push("/auth"); return; }

      // Get all expenses for this user
      const { data:expenses, error:expErr } = await supabase
        .from("expenses")
        .select("id,store_name,purchase_date")
        .eq("user_id", session.user.id)
        .order("purchase_date", { ascending: false });

      if (expErr) throw new Error(expErr.message);
      if (!expenses?.length) { setStockItems([]); setHistoryItems([]); setLoading(false); return; }

      const expenseIds = expenses.map(e => e.id);
      const expMap: Record<string,any> = {};
      expenses.forEach(e => { expMap[e.id] = e; });

      // Get all expense items
      const { data:items, error:itemErr } = await supabase
        .from("expense_items")
        .select("id,expense_id,name,price,quantity,unit,category")
        .in("expense_id", expenseIds)
        .order("name");

      if (itemErr) throw new Error(itemErr.message);

      const allItems = (items||[]).map(i => ({
        ...i,
        store_name: expMap[i.expense_id]?.store_name || "Unknown Store",
        purchase_date: expMap[i.expense_id]?.purchase_date || "",
      }));

      // Split into stock (food) vs history (non-food)
      setStockItems(allItems.filter(i => STOCK_CATS.includes(i.category)));
      setHistoryItems(allItems.filter(i => !STOCK_CATS.includes(i.category)));

    } catch (e: any) {
      console.error("Stock fetch error:", e);
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredStock = stockItems.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "All" && i.category !== catFilter) return false;
    return true;
  });

  const filteredHistory = historyItems.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lowStock = stockItems.filter(i => i.quantity <= 1).length;
  const totalValue = stockItems.reduce((s,i) => s + (i.price * i.quantity), 0);

  // Group stock by category
  const grouped: Record<string,StockItem[]> = {};
  filteredStock.forEach(i => {
    if (!grouped[i.category]) grouped[i.category] = [];
    grouped[i.category].push(i);
  });

  // Group history by category
  const historyGrouped: Record<string,PurchaseHistory[]> = {};
  filteredHistory.forEach(i => {
    if (!historyGrouped[i.category]) historyGrouped[i.category] = [];
    historyGrouped[i.category].push(i);
  });

  return (
    <>
      <div style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{padding:"20px 24px",maxWidth:1200,width:"100%"}}>
          <div style={{padding:"20px 24px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5}}>Stock</h1>
            <p style={{fontSize:13,color:"#6D6D72",marginTop:3}}>{stockItems.length} items · {lowStock} low stock</p>
          </div>
          <button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(255,159,10,0.3)"}}>
            🧾 Scan Bill
          </button>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
          {[
            {l:"Items",v:stockItems.length,c:"#FF9F0A",i:"📦"},
            {l:"Low Stock",v:lowStock,c:"#FF3B30",i:"⚠️"},
            {l:"Est. Value",v:fmt(totalValue),c:"#30D158",i:"💰"},
          ].map(s=>(
            <div key={s.l} style={{background:"#fff",borderRadius:14,padding:"12px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:18}}>{s.i}</div>
              <div style={{fontSize:typeof s.v==="string"?14:20,fontWeight:800,color:s.c,marginTop:4,letterSpacing:-0.5}}>{s.v}</div>
              <div style={{fontSize:10,color:"#AEAEB2",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",background:"#fff",borderRadius:12,padding:3,gap:2,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          {([["inventory",`📦 Inventory (${stockItems.length})`],["history",`📋 Purchase History (${historyItems.length})`]] as const).map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:tab===t?"#F2F2F7":"transparent",color:tab===t?"#1C1C1E":"#AEAEB2",boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.08)":"none",transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#AEAEB2",fontSize:15}}>🔍</span>
          <input style={{width:"100%",background:"#fff",border:"none",borderRadius:12,padding:"11px 16px 11px 42px",fontSize:14,color:"#1C1C1E",outline:"none",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="inventory"?"Search stock items...":"Search purchase history..."}/>
        </div>

        {/* Error */}
        {error&&(
          <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#FF3B30"}}>⚠️ {error}</span>
            <button onClick={fetchData} style={{background:"#FF3B30",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading&&<div style={{textAlign:"center",padding:"60px 0",color:"#AEAEB2"}}><div style={{fontSize:32,marginBottom:8}}>⏳</div>Loading...</div>}

        {/* ── INVENTORY TAB ── */}
        {!loading&&tab==="inventory"&&(
          <>
            {/* Category filter */}
            {stockItems.length>0&&(
              <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
                {["All",...[...new Set(stockItems.map(i=>i.category))]].map(c=>(
                  <button key={c} onClick={()=>setCatFilter(c)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,border:"none",background:catFilter===c?"#FF9F0A":"#fff",color:catFilter===c?"#fff":"#6D6D72",cursor:"pointer",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                    {CAT_ICONS[c]||""} {c}
                  </button>
                ))}
              </div>
            )}

            {filteredStock.length===0&&!loading&&(
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>📦</div>
                <div style={{fontSize:16,fontWeight:600,color:"#1C1C1E",marginBottom:8}}>{stockItems.length===0?"No stock yet":"No matches"}</div>
                {stockItems.length===0&&<button onClick={()=>router.push("/scan")} style={{background:"linear-gradient(135deg,#FF9F0A,#D4800A)",color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,cursor:"pointer"}}>🧾 Scan Your First Bill</button>}
              </div>
            )}

            {Object.entries(grouped).map(([cat,catItems])=>(
              <div key={cat} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6,paddingLeft:2}}>
                  {CAT_ICONS[cat]||"📦"} {cat} ({catItems.length})
                </div>
                <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  {catItems.map((item,i)=>(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<catItems.length-1?"0.5px solid #F2F2F7":"none",background:item.quantity<=1?"rgba(255,59,48,0.02)":"#fff"}}>
                      <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,159,10,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                        {CAT_ICONS[item.category]||"📦"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</span>
                          {item.quantity<=1&&<span style={{fontSize:9,fontWeight:700,color:"#FF3B30",background:"rgba(255,59,48,0.1)",borderRadius:20,padding:"2px 6px",flexShrink:0}}>LOW</span>}
                        </div>
                        <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>
                          {item.store_name} · {item.purchase_date}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:"#FF9F0A"}}>{fmt(item.price)}<span style={{fontSize:10,color:"#AEAEB2",fontWeight:400}}>/{item.unit}</span></div>
                        <div style={{fontSize:11,color:"#6D6D72",marginTop:1}}>qty: {item.quantity}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:5,flexShrink:0}}>
                        <button onClick={()=>{setRestockItem(item);setRestockQty(1);}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",whiteSpace:"nowrap" as const,boxShadow:"0 2px 6px rgba(255,159,10,0.3)"}}>🔄 Restock</button>
                        <button onClick={()=>{if(window.confirm(`Remove ${item.name} from stock?`)){setStockItems(prev=>prev.filter(i=>i.id!==item.id));toast.success(`${item.name} removed`);}}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:700,color:"#FF3B30",cursor:"pointer",whiteSpace:"nowrap" as const}}>✕ Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── PURCHASE HISTORY TAB ── */}
        {!loading&&tab==="history"&&(
          <>
            {filteredHistory.length===0&&!loading&&(
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:16,fontWeight:600,color:"#1C1C1E",marginBottom:8}}>{historyItems.length===0?"No purchase history":"No matches"}</div>
                {historyItems.length===0&&<p style={{fontSize:13,color:"#AEAEB2"}}>Gas, restaurant, pharmacy and other purchases appear here</p>}
              </div>
            )}

            {Object.entries(historyGrouped).map(([cat,catItems])=>(
              <div key={cat} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6,paddingLeft:2}}>
                  {CAT_ICONS[cat]||"📦"} {cat} ({catItems.length})
                </div>
                <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  {catItems.map((item,i)=>(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<catItems.length-1?"0.5px solid #F2F2F7":"none"}}>
                      <div style={{width:36,height:36,borderRadius:10,background:"#F2F2F7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                        {CAT_ICONS[item.category]||"📦"}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                        <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{item.store_name} · {item.purchase_date}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E"}}>{fmt(item.price*item.quantity)}</div>
                        {item.quantity>1&&<div style={{fontSize:10,color:"#AEAEB2"}}>{fmt(item.price)}/ea × {item.quantity}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Restock Modal */}
      {restockItem&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setRestockItem(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:480}}>
            <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E",marginBottom:4}}>🔄 Restock</div>
            <div style={{fontSize:13,color:"#6D6D72",marginBottom:4}}>{restockItem.name}</div>
            <div style={{fontSize:12,color:"#AEAEB2",marginBottom:20}}>{restockItem.store_name} · {fmt(restockItem.price)}/{restockItem.unit}</div>
            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,marginBottom:8}}>QUANTITY TO ORDER</div>
            <div style={{display:"flex",alignItems:"center",gap:16,background:"#F2F2F7",borderRadius:12,padding:"12px 16px",marginBottom:20}}>
              <button onClick={()=>setRestockQty(q=>Math.max(1,q-1))} style={{width:36,height:36,borderRadius:8,border:"none",background:"#fff",fontSize:18,cursor:"pointer",fontWeight:700,color:"#1C1C1E",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>−</button>
              <span style={{flex:1,textAlign:"center",fontSize:28,fontWeight:900,color:"#FF9F0A"}}>{restockQty}</span>
              <button onClick={()=>setRestockQty(q=>q+1)} style={{width:36,height:36,borderRadius:8,border:"none",background:"#fff",fontSize:18,cursor:"pointer",fontWeight:700,color:"#1C1C1E",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>+</button>
            </div>
            <div style={{fontSize:13,color:"#6D6D72",marginBottom:16,textAlign:"center"}}>Est. cost: {fmt(restockItem.price*restockQty)}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setRestockItem(null)} style={{flex:1,padding:"12px",background:"#F2F2F7",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"#6D6D72",cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>{
                const inCart=cart.find((c:any)=>c.id===restockItem.id);
                if(inCart){toast("Already in cart");setRestockItem(null);return;}
                for(let i=0;i<restockQty;i++){
                  addToCart({id:`restock-${restockItem.id}-${Date.now()}-${i}`,name:restockItem.name,price:restockItem.price,unit:restockItem.unit,store:restockItem.store_name,store_slug:"",category:restockItem.category,icon:"🛒"});
                }
                toast.success(`✦ ${restockQty}x ${restockItem.name} added to cart`);
                setRestockItem(null);
              }} style={{flex:2,padding:"12px",background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                🛒 Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </>
  );
}
