"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import toast from "react-hot-toast";

const STOCK_CATS = ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"];
const ALL_CATS = ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Gas","Restaurant","Pharmacy","Household","Electronics","Other"];

type Step = "upload"|"review"|"confirm";

interface BillItem {
  id: string;
  name: string;
  unit_price: number;
  actual_price: number;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#30D158" : score >= 60 ? "#FF9F0A" : "#FF3B30";
  const label = score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
  return <span style={{ fontSize:9, fontWeight:700, borderRadius:20, padding:"2px 7px", background:`${color}18`, color, border:`1px solid ${color}44` }}>{label} {score}%</span>;
}

function Alert({ type, message }: { type:"error"|"warning"|"info"; message:string }) {
  const colors = { error:"#FF3B30", warning:"#FF9F0A", info:"#30D158" };
  const icons = { error:"⚠️", warning:"💡", info:"✅" };
  const c = colors[type];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:`${c}10`, border:`1px solid ${c}30`, borderRadius:10, marginBottom:8 }}>
      <span style={{ fontSize:13 }}>{icons[type]}</span>
      <span style={{ fontSize:12, color:c, fontWeight:500 }}>{message}</span>
    </div>
  );
}

function computeConfidence(item: any): number {
  let score = 100;
  if (!item.name || item.name.length < 2) score -= 40;
  if (!item.unit_price || item.unit_price <= 0) score -= 35;
  if (!item.category || item.category === "Other") score -= 10;
  if (item.unit_price > 200) score -= 20;
  if (item.name && item.name.length > 60) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export default function ScanPage() {
  const router = useRouter();
  const { addPoints, moveToPantry, user } = useAppStore();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showBill, setShowBill] = useState(true);
  const [sharePrices, setSharePrices] = useState(true);
  const [editTotal, setEditTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState<number|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setSaved(false); setItems([]); setStep("upload");
  }

  function toB64(f: File): Promise<string> {
    return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  }

  async function scan() {
    if (!file) return;
    setLoading(true);
    try {
      const b64 = await toB64(file);
      const res = await fetch("/api/scan", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({b64, mime:file.type}) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const extracted: BillItem[] = (data.items||[]).map((i:any, idx:number) => {
        const item = { id:`item-${idx}-${Date.now()}`, name:i.name||"", unit_price:parseFloat(i.unit_price)||parseFloat(i.price)||0, actual_price:parseFloat(i.actual_price)||parseFloat(i.price)||0, quantity:parseInt(i.quantity)||1, unit:i.unit||"ea", category:i.category||"Other", confidence:0 };
        item.confidence = computeConfidence(item);
        return item;
      });
      extracted.sort((a,b) => a.confidence - b.confidence);
      setResult(data);
      setManualTotal(data.total||0);
      setItems(extracted);
      setStep("review");
      const low = extracted.filter(i=>i.confidence<60).length;
      toast.success(`✦ ${extracted.length} items found${low>0?` · ${low} need review`:""}`);
    } catch(e:any) { toast.error(e.message); }
    setLoading(false);
  }

  function updateItem(id: string, field: string, value: any) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = {...i, [field]: value};
      updated.confidence = computeConfidence(updated);
      return updated;
    }));
  }

  function removeItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)); }

  function addItem() {
    const newItem: BillItem = { id:`item-new-${Date.now()}`, name:"", unit_price:0, actual_price:0, quantity:1, unit:"ea", category:"Other", confidence:0 };
    setItems(prev => [...prev, newItem]);
    setEditingId(newItem.id);
  }

  async function saveBill() {
    setSaving(true);
    try {
      const { data:{ session } } = await supabaseAuth.auth.getSession();
      const userId = session?.user?.id;
      const total = items.reduce((s,i) => s + (i.actual_price || i.unit_price * i.quantity), 0);

      // 1. Save expense
      const { data:expense } = await supabase.from("expenses").insert({
        user_id: userId,
        store_name: result.store_name || "Unknown Store",
        store_city: result.store_city || "",
        store_zip: result.store_zip || "",
        purchase_date: result.purchase_date || new Date().toISOString().split("T")[0],
        currency: result.currency || "USD",
        total,
        items_count: items.length,
        source: "receipt",
      }).select("id").single();

      // 2. Save expense items
      if (expense?.id) {
        await supabase.from("expense_items").insert(items.map(i => ({
          expense_id: expense.id,
          name: i.name,
          price: i.actual_price,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
        })));
      }

      // 3. Save to stock/pantry
      let stockCount = 0;
      items.forEach(item => {
        if (STOCK_CATS.includes(item.category)) {
          moveToPantry({ id:`scan-${Date.now()}-${Math.random()}`, name:item.name, price:item.unit_price, unit:item.unit, store:result.store_name||"", category:item.category, icon:"🛒", qty:item.quantity, purchased:true });
          stockCount++;
        }
      });

      // 4. Save price history (crowdsourced, anonymous)
      if (sharePrices && result.store_name) {
        const priceHistoryItems = items
          .filter(i => i.unit_price > 0 && i.name.trim())
          .map(i => ({
            normalized_name: i.name.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,""),
            item_name: i.name.trim(),
            store_name: result.store_name,
            store_city: result.store_city || "",
            price: i.unit_price,
            unit: i.unit,
            currency: result.currency || "USD",
            source: "receipt",
            recorded_at: new Date().toISOString(),
          }));
        if (priceHistoryItems.length > 0) {
          await supabase.from("price_history").insert(priceHistoryItems);
        }
      }

      // 5. Award points
      const pts = 5 + (items.length * 2);
      addPoints(pts); // Zustand
      // Also save to Supabase
      try {
        const { data:prof } = await supabase.from("user_profiles").select("points").eq("user_id", userId).single();
        const newPts = (prof?.points || 0) + pts;
        await supabase.from("user_profiles").upsert({ user_id: userId, points: newPts, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        setUser({ ...user!, points: newPts });
      } catch(pe) { console.error("Points save error:", pe); }

      setSaved(true);
      setStep("confirm");
      toast.success(`✦ +${pts} pts · Bill saved${sharePrices?" · Prices shared":""}`);
    } catch(e:any) {
      toast.error(e.message);
    }
    setSaving(false);
  }

  const zeroPriceCount = items.filter(i=>i.unit_price<=0).length;
  const noNameCount = items.filter(i=>!i.name.trim()).length;
  const lowConfCount = items.filter(i=>i.confidence<60).length;
  const avgConfidence = items.length > 0 ? Math.round(items.reduce((s,i)=>s+i.confidence,0)/items.length) : 0;
  const stockItems = items.filter(i=>STOCK_CATS.includes(i.category));
  const historyItems = items.filter(i=>!STOCK_CATS.includes(i.category));
  const total = items.reduce((s,i) => s + (i.actual_price || i.unit_price * i.quantity), 0);
  const progress = step==="upload"?1:step==="review"?2:3;

  return (
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container" style={{maxWidth:step==="review"?1100:680}}>

        {/* Header */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <h1 style={{fontSize:20,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5}}>Scan Bill</h1>
            {step==="review"&&<div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:avgConfidence>=80?"#30D158":avgConfidence>=60?"#FF9F0A":"#FF3B30"}}>Avg Confidence: {avgConfidence}%</div>}
          </div>
          <div style={{display:"flex",background:"#fff",borderRadius:12,padding:3,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            {["Upload","Review","Confirm"].map((s,i)=>(
              <div key={s} style={{flex:1,padding:"8px 4px",borderRadius:10,textAlign:"center" as const,fontSize:12,fontWeight:600,background:progress===i+1?"#FF9F0A":progress>i+1?"rgba(48,209,88,0.1)":"transparent",color:progress===i+1?"#fff":progress>i+1?"#30D158":"#AEAEB2",transition:"all 0.2s"}}>
                {progress>i+1?"✓ ":""}{s}
              </div>
            ))}
          </div>
        </div>

        {/* ── STEP 1: UPLOAD ── */}
        {step==="upload"&&(
          <div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} style={{display:"none"}}/>
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.dataTransfer.files[0]&&handleFile(e.dataTransfer.files[0]);}}
              style={{border:`2px dashed ${file?"#FF9F0A":"#E5E5EA"}`,borderRadius:16,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:"#fff",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",transition:"border-color 0.2s"}}>
              {preview
                ?<img src={preview} alt="" style={{maxHeight:220,borderRadius:10,objectFit:"contain",margin:"0 auto"}}/>
                :<><div style={{fontSize:48,marginBottom:10}}>🧾</div><div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:4}}>Upload Your Bill</div><div style={{fontSize:13,color:"#AEAEB2"}}>JPG · PNG · PDF · Any store · Any language</div></>
              }
            </div>
            {file&&(
              <button onClick={scan} disabled={loading} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:loading?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                {loading?"🤖 Scanning...":"🤖 Scan with KNOWBOTH AI"}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 2: REVIEW — SPLIT SCREEN ── */}
        {step==="review"&&(
          <div style={{display:"grid",gridTemplateColumns:showBill&&preview?"1fr 420px":"1fr",gap:16,alignItems:"start"}}>

            {/* LEFT — Items */}
            <div>
              {/* Store info banner */}
              {result&&(
                <div style={{background:"#fff",borderRadius:12,padding:"12px 16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:result.total_mismatch?8:0}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1C1C1E"}}>🏪 {result.store_name||"Unknown Store"}</div>
                      <div style={{fontSize:11,color:"#AEAEB2"}}>{result.store_city} · {result.purchase_date} · {result.currency||"USD"}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"#AEAEB2",marginBottom:2}}>Receipt Total</div>
                      {editTotal
                        ?<input type="number" step="0.01" autoFocus style={{width:90,background:"#F2F2F7",border:"1px solid #FF9F0A",borderRadius:8,padding:"4px 8px",fontSize:16,fontWeight:900,color:"#FF9F0A",outline:"none",textAlign:"right"}} value={manualTotal||""} onChange={e=>setManualTotal(parseFloat(e.target.value)||0)} onBlur={()=>setEditTotal(false)}/>
                        :<div onClick={()=>setEditTotal(true)} style={{fontSize:20,fontWeight:900,color:"#FF9F0A",cursor:"pointer"}} title="Tap to edit">${(manualTotal||total).toFixed(2)} ✏️</div>
                      }
                      <div style={{fontSize:10,color:"#AEAEB2"}}>Items: ${total.toFixed(2)}</div>
                    </div>
                  </div>
                  {result.total_mismatch&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,159,10,0.08)",border:"1px solid rgba(255,159,10,0.25)",borderRadius:8,fontSize:12,color:"#FF9F0A",fontWeight:500}}>
                      <span>💡</span>
                      <span>Receipt total (${(manualTotal||result.total).toFixed(2)}) doesn't match items total (${total.toFixed(2)}). Some items may be missing or prices may be incorrect. Tap total to edit.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Alerts */}
              <div style={{marginBottom:10}}>
                {noNameCount>0&&<Alert type="error" message={`${noNameCount} item${noNameCount>1?"s":""} missing name`}/>}
                {zeroPriceCount>0&&<Alert type="error" message={`${zeroPriceCount} item${zeroPriceCount>1?"s":""} have $0 price`}/>}
                {lowConfCount>0&&<Alert type="warning" message={`${lowConfCount} item${lowConfCount>1?"s":""} have low confidence — please verify`}/>}
                {zeroPriceCount===0&&noNameCount===0&&lowConfCount===0&&<Alert type="info" message="All items look good! Ready to save."/>}
              </div>

              {/* Toolbar */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{items.length} items · ${total.toFixed(2)}</span>
                <div style={{display:"flex",gap:8}}>
                  {preview&&<button onClick={()=>setShowBill(!showBill)} style={{background:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>{showBill?"Hide Bill":"Show Bill"}</button>}
                  <button onClick={()=>{setStep("upload");setResult(null);setItems([]);}} style={{background:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Rescan</button>
                  <button onClick={addItem} style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#30D158",cursor:"pointer"}}>+ Add</button>
                </div>
              </div>

              {/* Items list */}
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:12}}>
                {items.map(item=>(
                  <div key={item.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",border:item.confidence<60||item.unit_price<=0?"1px solid rgba(255,59,48,0.2)":"1px solid transparent"}}>
                    {editingId!==item.id?(
                      <div onClick={()=>setEditingId(item.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:STOCK_CATS.includes(item.category)?"#30D158":"#AEAEB2",flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                            <span style={{fontSize:14,fontWeight:600,color:item.name?"#1C1C1E":"#FF3B30"}}>{item.name||"⚠️ Missing name"}</span>
                            <ConfidenceBadge score={item.confidence}/>
                            {item.unit_price<=0&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"2px 7px"}}>⚠️ No price</span>}
                          </div>
                          <div style={{fontSize:11,color:"#AEAEB2",marginTop:2,display:"flex",gap:6}}>
                            <span>{item.category}</span>
                            <span>·</span>
                            <span>qty {item.quantity}</span>
                            <span>·</span>
                            <span style={{fontWeight:600,color:STOCK_CATS.includes(item.category)?"#30D158":"#AEAEB2"}}>{STOCK_CATS.includes(item.category)?"📦 Stock":"📋 History"}</span>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:15,fontWeight:700,color:item.unit_price>0?"#FF9F0A":"#FF3B30"}}>${item.actual_price?.toFixed(2)||"0.00"}</div>
                          <div style={{fontSize:10,color:"#AEAEB2"}}>${item.unit_price?.toFixed(2)}/ea · x{item.quantity}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();removeItem(item.id);}} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"5px 8px",fontSize:11,color:"#FF3B30",cursor:"pointer",flexShrink:0}}>✕</button>
                      </div>
                    ):(
                      <div style={{padding:14}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Edit Item</span>
                            <ConfidenceBadge score={item.confidence}/>
                          </div>
                          <button onClick={()=>setEditingId(null)} style={{background:"#FF9F0A",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                          <div style={{gridColumn:"1/-1"}}>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>ITEM NAME {!item.name&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                            <input style={{width:"100%",background:!item.name?"rgba(255,59,48,0.05)":"#F2F2F7",border:!item.name?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="Item name *"/>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>UNIT PRICE ($) {item.unit_price<=0&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                            <input type="number" step="0.01" style={{width:"100%",background:item.unit_price<=0?"rgba(255,59,48,0.05)":"#F2F2F7",border:item.unit_price<=0?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.unit_price||""} onChange={e=>updateItem(item.id,"unit_price",parseFloat(e.target.value)||0)} placeholder="4.99"/>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>ACTUAL PRICE ($)</div>
                            <input type="number" step="0.01" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.actual_price||""} onChange={e=>updateItem(item.id,"actual_price",parseFloat(e.target.value)||0)} placeholder="9.98"/>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>QUANTITY</div>
                            <input type="number" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.quantity} onChange={e=>updateItem(item.id,"quantity",parseInt(e.target.value)||1)}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>UNIT</div>
                            <select style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none",cursor:"pointer"}} value={item.unit} onChange={e=>updateItem(item.id,"unit",e.target.value)}>
                              {["ea","bag","lb","oz","kg","pack","box","bottle","jar","bunch","gallon","liter"].map(u=><option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>CATEGORY</div>
                            <select style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none",cursor:"pointer"}} value={item.category} onChange={e=>updateItem(item.id,"category",e.target.value)}>
                              {ALL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Share prices toggle */}
              <div style={{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",marginBottom:3}}>📊 Share prices with community</div>
                    <div style={{fontSize:12,color:"#6D6D72",lineHeight:1.5}}>Help others find the best prices. Only store name, location, item names & prices are shared. Your personal info is never shared.</div>
                    <div style={{fontSize:11,color:"#AEAEB2",marginTop:4}}>⚠️ Price may vary. We capture as accurately as possible.</div>
                  </div>
                  <div onClick={()=>setSharePrices(!sharePrices)} style={{width:44,height:26,borderRadius:13,cursor:"pointer",position:"relative",background:sharePrices?"#FF9F0A":"#E5E5EA",transition:"background 0.2s",flexShrink:0,marginTop:2}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:sharePrices?20:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                  </div>
                </div>
              </div>

              <button onClick={saveBill} disabled={saving||noNameCount>0||zeroPriceCount>0}
                style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:(noNameCount>0||zeroPriceCount>0)?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                {saving?"💾 Saving...":(noNameCount>0?"Fix missing names first":zeroPriceCount>0?"Fix $0 prices first":"💾 Save Bill")}
              </button>
            </div>

            {/* RIGHT — Bill image */}
            {showBill&&preview&&(
              <div style={{position:"sticky",top:80,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>🧾 Bill Reference</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))} style={{background:"#F2F2F7",border:"none",borderRadius:7,padding:"4px 10px",fontSize:15,cursor:"pointer",fontWeight:700}}>−</button>
                    <span style={{fontSize:11,color:"#6D6D72",fontWeight:600,minWidth:36,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
                    <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={{background:"#F2F2F7",border:"none",borderRadius:7,padding:"4px 10px",fontSize:15,cursor:"pointer",fontWeight:700}}>+</button>
                    <button onClick={()=>setZoom(1)} style={{background:"#F2F2F7",border:"none",borderRadius:7,padding:"4px 8px",fontSize:10,cursor:"pointer",color:"#6D6D72",fontWeight:600}}>Reset</button>
                  </div>
                </div>
                <div style={{overflow:"auto",maxHeight:580,padding:12,cursor:zoom>1?"grab":"default"}}>
                  <img src={preview} alt="Bill" style={{width:`${zoom*100}%`,minWidth:`${zoom*100}%`,borderRadius:10,display:"block",transition:"width 0.2s"}}/>
                </div>
                <div style={{padding:"8px 16px",background:"#F9F9F9",fontSize:11,color:"#AEAEB2",textAlign:"center"}}>
                  Tap items to edit · Reference your bill
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step==="confirm"&&saved&&(
          <div>
            <div style={{background:"rgba(48,209,88,0.08)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:16,padding:"24px 20px",textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:44,marginBottom:10}}>✅</div>
              <div style={{fontSize:18,fontWeight:700,color:"#1C1C1E",marginBottom:6}}>Bill Saved!</div>
              <div style={{fontSize:13,color:"#6D6D72",lineHeight:1.6,marginBottom:4}}>
                {stockItems.length} items → Stock · {historyItems.length} items → History
              </div>
              {sharePrices&&<div style={{fontSize:12,color:"#30D158",fontWeight:500}}>✦ Prices shared with community</div>}
              <div style={{fontSize:11,color:"#AEAEB2",marginTop:4}}>⚠️ Shared prices may vary. Captured as accurately as possible.</div>
            </div>

            {/* Summary */}
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{fontSize:15,fontWeight:600,color:"#1C1C1E"}}>🏪 {result?.store_name}</span>
                <span style={{fontSize:18,fontWeight:900,color:"#FF9F0A"}}>${total.toFixed(2)}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {l:"Items",v:items.length,c:"#FF9F0A"},
                  {l:"→ Stock",v:stockItems.length,c:"#30D158"},
                  {l:"→ History",v:historyItems.length,c:"#6D6D72"},
                ].map(s=>(
                  <div key={s.l} style={{background:"#F9F9F9",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <button onClick={()=>router.push("/stock")} style={{padding:"12px 8px",background:"rgba(48,209,88,0.1)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#30D158",cursor:"pointer"}}>📦 Stock</button>
              <button onClick={()=>router.push("/expenses")} style={{padding:"12px 8px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#FF9F0A",cursor:"pointer"}}>📊 Expenses</button>
              <button onClick={()=>{setStep("upload");setResult(null);setFile(null);setPreview(null);setItems([]);setSaved(false);}} style={{padding:"12px 8px",background:"#F2F2F7",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer"}}>🧾 Scan More</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
