"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { isStockItem } from "@/app/stock/page";
import toast from "react-hot-toast";

const STOCK_CATS = ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"];

export default function ScanPage() {
  const router = useRouter();
  const { addPoints, moveToPantry, user } = useAppStore();
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingItem, setEditingItem] = useState<number|null>(null);
  const [items, setItems] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setSaved(false);
    setItems([]);
  }

  function toB64(f: File): Promise<string> {
    return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  }

  async function scan() {
    if(!file) return;
    setLoading(true);
    try{
      const b64 = await toB64(file);
      const res = await fetch("/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({b64,mime:file.type})});
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      setResult(data);
      setItems(data.items||[]);
      toast.success(`✦ ${data.items?.length||0} items found!`);
    }catch(e:any){toast.error(e.message);}
    setLoading(false);
  }

  function updateItem(idx: number, field: string, value: any) {
    setItems(prev=>prev.map((item,i)=>i===idx?{...item,[field]:value}:item));
  }

  function removeItem(idx: number) {
    setItems(prev=>prev.filter((_,i)=>i!==idx));
  }

  async function saveBill() {
    if(!result||items.length===0){toast.error("No items to save");return;}
    setSaving(true);
    try{
      const{data:{session}}=await supabaseAuth.auth.getSession();
      const userId=session?.user?.id;

      // Save expense to DB
      const{data:expense,error:ee}=await supabase.from("expenses").insert({
        user_id:userId,
        store_name:result.store_name||"Unknown Store",
        store_city:result.store_city||"",
        store_zip:result.store_zip||"",
        purchase_date:result.purchase_date||new Date().toISOString().split("T")[0],
        currency:result.currency||"USD",
        total:result.total||items.reduce((s:number,i:any)=>s+(i.price*i.quantity),0),
        items_count:items.length,
        source:"receipt",
      }).select("id").single();

      // Save expense items
      if(expense?.id){
        await supabase.from("expense_items").insert(items.map((item:any)=>({
          expense_id:expense.id,
          name:item.name,
          price:item.price,
          quantity:item.quantity||1,
          unit:item.unit||"ea",
          category:item.category||"Other",
        })));
      }

      // Add to stock/pantry if food item
      let stockCount = 0;
      items.forEach((item:any)=>{
        if(STOCK_CATS.includes(item.category)){
          moveToPantry({
            id:`scan-${Date.now()}-${Math.random()}`,
            name:item.name,
            price:item.price,
            unit:item.unit||"ea",
            store:result.store_name||"",
            category:item.category||"Other",
            icon:"🛒",
            qty:item.quantity||1,
            purchased:true,
          });
          stockCount++;
        }
      });

      // Award points
      const pts = 5 + (items.length*2);
      addPoints(pts);

      setSaved(true);
      toast.success(`✦ +${pts} pts · Bill saved · ${stockCount} items → Stock`);
    }catch(e:any){
      // If expenses table doesn't exist yet, still save to pantry
      let stockCount = 0;
      items.forEach((item:any)=>{
        if(STOCK_CATS.includes(item.category)){
          moveToPantry({id:`scan-${Date.now()}-${Math.random()}`,name:item.name,price:item.price,unit:item.unit||"ea",store:result.store_name||"",category:item.category||"Other",icon:"🛒",qty:item.quantity||1,purchased:true});
          stockCount++;
        }
      });
      const pts=5+(items.length*2);
      addPoints(pts);
      setSaved(true);
      toast.success(`✦ +${pts} pts · ${stockCount} items → Stock`);
    }
    setSaving(false);
  }

  const stockItems = items.filter(i=>STOCK_CATS.includes(i.category));
  const historyItems = items.filter(i=>!STOCK_CATS.includes(i.category));
  const total = items.reduce((s:number,i:any)=>s+(i.price*(i.quantity||1)),0);

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container" style={{maxWidth:680}}>

        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5}}>Scan Bill</h1>
          <p style={{fontSize:13,color:"#6D6D72",marginTop:3}}>Any store · Any language · Any currency</p>
        </div>

        {/* Upload area */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} style={{display:"none"}}/>
        <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.dataTransfer.files[0]&&handleFile(e.dataTransfer.files[0]);}}
          style={{border:`2px dashed ${file?"#FF9F0A":"#E5E5EA"}`,borderRadius:16,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"#fff",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",transition:"border-color 0.2s"}}>
          {preview
            ?<img src={preview} alt="" style={{maxHeight:200,borderRadius:10,objectFit:"contain",margin:"0 auto"}}/>
            :<>
              <div style={{fontSize:44,marginBottom:10}}>🧾</div>
              <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:4}}>Upload Your Bill</div>
              <div style={{fontSize:13,color:"#AEAEB2"}}>JPG · PNG · PDF · Tap or drag</div>
            </>
          }
        </div>

        {file&&!result&&(
          <button onClick={scan} disabled={loading} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:loading?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)",marginBottom:16}}>
            {loading?"🤖 Scanning...":"🤖 Scan with KNOWBOTH AI"}
          </button>
        )}

        {/* Results */}
        {result&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>

            {/* Store info */}
            <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:"#1C1C1E"}}>🏪 {result.store_name||"Unknown Store"}</div>
                  {result.store_city&&<div style={{fontSize:12,color:"#6D6D72",marginTop:2}}>📍 {result.store_city} {result.store_zip}</div>}
                  <div style={{fontSize:12,color:"#AEAEB2",marginTop:1}}>📅 {result.purchase_date||"Today"} · {result.currency||"USD"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:900,color:"#FF9F0A"}}>${(result.total||total).toFixed(2)}</div>
                  <div style={{fontSize:11,color:"#AEAEB2"}}>Total</div>
                </div>
              </div>
            </div>

            {/* Points + routing summary */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {l:"Points",v:`+${5+(items.length*2)}`,c:"#FF9F0A",i:"✦"},
                {l:"→ Stock",v:stockItems.length,c:"#30D158",i:"📦"},
                {l:"→ History",v:historyItems.length,c:"#6D6D72",i:"📋"},
              ].map(s=>(
                <div key={s.l} style={{background:"#fff",borderRadius:12,padding:"12px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.i} {s.v}</div>
                  <div style={{fontSize:11,color:"#AEAEB2",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Items list — editable */}
            <div style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{items.length} Items</span>
                <span style={{fontSize:12,color:"#AEAEB2"}}>Tap to edit</span>
              </div>
              {items.map((item:any,idx:number)=>(
                <div key={idx} style={{borderBottom:idx<items.length-1?"0.5px solid #F2F2F7":"none"}}>
                  {editingItem===idx?(
                    <div style={{padding:"12px 16px",background:"rgba(255,159,10,0.02)"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>ITEM NAME</div>
                          <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,color:"#1C1C1E",outline:"none"}} value={item.name} onChange={e=>updateItem(idx,"name",e.target.value)}/>
                        </div>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>CATEGORY</div>
                          <select style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,color:"#1C1C1E",outline:"none",cursor:"pointer"}} value={item.category} onChange={e=>updateItem(idx,"category",e.target.value)}>
                            {["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Gas","Restaurant","Pharmacy","Household","Electronics","Other"].map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>PRICE ($)</div>
                          <input type="number" step="0.01" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,color:"#1C1C1E",outline:"none"}} value={item.price||""} onChange={e=>updateItem(idx,"price",parseFloat(e.target.value)||0)}/>
                        </div>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>QTY</div>
                          <input type="number" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:8,padding:"8px 10px",fontSize:13,color:"#1C1C1E",outline:"none"}} value={item.quantity||1} onChange={e=>updateItem(idx,"quantity",parseInt(e.target.value)||1)}/>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setEditingItem(null)} style={{flex:2,padding:"8px",background:"#FF9F0A",border:"none",borderRadius:8,fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                        <button onClick={()=>removeItem(idx)} style={{flex:1,padding:"8px",background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,fontSize:13,fontWeight:600,color:"#FF3B30",cursor:"pointer"}}>Remove</button>
                      </div>
                    </div>
                  ):(
                    <div onClick={()=>setEditingItem(idx)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:STOCK_CATS.includes(item.category)?"#30D158":"#AEAEB2",flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                        <div style={{fontSize:11,color:"#AEAEB2",marginTop:1}}>{item.category} · qty {item.quantity||1}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#FF9F0A"}}>${(item.price*(item.quantity||1)).toFixed(2)}</div>
                        <div style={{fontSize:10,color:"#AEAEB2"}}>${item.price?.toFixed(2)}/ea</div>
                      </div>
                      <span style={{fontSize:10,fontWeight:600,borderRadius:20,padding:"2px 7px",background:STOCK_CATS.includes(item.category)?"rgba(48,209,88,0.1)":"rgba(174,174,178,0.15)",color:STOCK_CATS.includes(item.category)?"#30D158":"#AEAEB2",flexShrink:0}}>
                        {STOCK_CATS.includes(item.category)?"📦 Stock":"📋 History"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <div style={{padding:"12px 16px",background:"#F9F9F9",display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Total</span>
                <span style={{fontSize:16,fontWeight:900,color:"#FF9F0A"}}>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            {!saved?(
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setResult(null);setFile(null);setPreview(null);setItems([]);}} style={{flex:1,padding:13,background:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Rescan</button>
                <button onClick={saveBill} disabled={saving} style={{flex:2,padding:13,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:saving?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                  {saving?"Saving...":"💾 Save Bill"}
                </button>
              </div>
            ):(
              <div style={{background:"rgba(48,209,88,0.08)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:14,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontSize:15,fontWeight:700,color:"#1C1C1E",marginBottom:4}}>Bill Saved!</div>
                <div style={{fontSize:13,color:"#6D6D72",marginBottom:16}}>{stockItems.length} items added to Stock · {historyItems.length} in History</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <button onClick={()=>router.push("/stock")} style={{padding:"9px 16px",background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#30D158",cursor:"pointer"}}>📦 View Stock</button>
                  <button onClick={()=>router.push("/expenses")} style={{padding:"9px 16px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#FF9F0A",cursor:"pointer"}}>📊 View Expenses</button>
                  <button onClick={()=>{setResult(null);setFile(null);setPreview(null);setItems([]);setSaved(false);}} style={{padding:"9px 16px",background:"#F2F2F7",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer"}}>🧾 Scan Another</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
