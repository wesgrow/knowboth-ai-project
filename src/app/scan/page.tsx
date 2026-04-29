"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  discount?: number;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score>=80?"#30D158":score>=60?"#FF9F0A":"#FF3B30";
  const label = score>=80?"High":score>=60?"Medium":"Low";
  return <span style={{fontSize:9,fontWeight:700,borderRadius:20,padding:"2px 7px",background:`${color}18`,color,border:`1px solid ${color}44`}}>{label} {score}%</span>;
}

function Alert({ type, message }: { type:"error"|"warning"|"info"; message:string }) {
  const colors = {error:"#FF3B30",warning:"#FF9F0A",info:"#30D158"};
  const icons = {error:"⚠️",warning:"💡",info:"✅"};
  const c = colors[type];
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:`${c}10`,border:`1px solid ${c}30`,borderRadius:10,marginBottom:8}}>
      <span style={{fontSize:13}}>{icons[type]}</span>
      <span style={{fontSize:12,color:c,fontWeight:500}}>{message}</span>
    </div>
  );
}

function computeConfidence(item: any): number {
  let score = 100;
  if (!item.name||item.name.length<2) score-=40;
  if (!item.unit_price||item.unit_price<=0) score-=35;
  if (!item.category||item.category==="Other") score-=10;
  if (item.unit_price>200) score-=20;
  return Math.max(0,Math.min(100,score));
}

export default function ScanPage() {
  const router = useRouter();
  const { addPoints, user, setUser } = useAppStore();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [dupWarn, setDupWarn] = useState<{matchedOn:string}|null>(null);
  const [scanError, setScanError] = useState<string|null>(null);
  const [zoom, setZoom] = useState(1);
  const [showBill, setShowBill] = useState(true);
  const [sharePrices, setSharePrices] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentSharePrices, setConsentSharePrices] = useState(false);
  const [manualTotal, setManualTotal] = useState<number|null>(null);
  const [editTotal, setEditTotal] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [linkedBrand, setLinkedBrand] = useState<any>(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [addingBrand, setAddingBrand] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [linkedLocation, setLinkedLocation] = useState<any>(null);
  const [newBrandWebsite, setNewBrandWebsite] = useState("");
  const [newBrandPhone, setNewBrandPhone] = useState("");
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [newLocBranch, setNewLocBranch] = useState("");
  const [newLocAddress, setNewLocAddress] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [newLocState, setNewLocState] = useState("");
  const [newLocZip, setNewLocZip] = useState("");
  const [newLocPhone, setNewLocPhone] = useState("");
  const [newLocLat, setNewLocLat] = useState<number|null>(null);
  const [newLocLng, setNewLocLng] = useState<number|null>(null);
  const [newLocMapLink, setNewLocMapLink] = useState("");
  const [lookingUpLoc, setLookingUpLoc] = useState(false);
  const [addingLoc, setAddingLoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    supabase.from("brands").select("id,name,slug").order("name").then(({data})=>setBrands(data||[]));
    if (!localStorage.getItem("kb_scan_consent")) setShowConsent(true);
  },[]);

  async function fetchBrandLocations(brandId:string) {
    const {data}=await supabase.from("store_locations").select("id,branch_name,address,city,state,zip,phone,lat,lng,map_link").eq("brand_id",brandId).order("city");
    setLocations(data||[]);
  }

  function toSlug(name:string){ return name.toLowerCase().trim().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""); }

  async function lookupLocation() {
    const q = [newLocAddress, newLocCity, newLocZip, "US"].filter(Boolean).join(", ");
    if (!q.replace(/,\s*/g,"").trim()) { toast.error("Enter address or zip first"); return; }
    setLookingUpLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&countrycodes=us`).then(r=>r.json());
      if (!res?.length) { toast.error("Location not found"); setLookingUpLoc(false); return; }
      const d = res[0]; const addr = d.address||{};
      const lat = parseFloat(d.lat), lng = parseFloat(d.lon);
      if (addr.city||addr.town||addr.suburb) setNewLocCity(addr.city||addr.town||addr.suburb||"");
      if (addr.state) setNewLocState(addr.state);
      if (addr.postcode) setNewLocZip(addr.postcode);
      setNewLocLat(lat); setNewLocLng(lng);
      setNewLocMapLink(`https://maps.google.com/maps?q=${lat},${lng}`);
      toast.success("Location details auto-filled ✓");
    } catch { toast.error("Could not look up location"); }
    setLookingUpLoc(false);
  }

  async function createBrand() {
    const name = newBrandName.trim();
    if (!name) { toast.error("Enter store name"); return; }
    setAddingBrand(true);
    const brandPayload: any = { name, slug:toSlug(name) };
    if (newBrandWebsite.trim()) brandPayload.website = newBrandWebsite.trim();
    if (newBrandPhone.trim()) brandPayload.phone = newBrandPhone.trim();
    const { data, error } = await supabase.from("brands").insert(brandPayload).select("id,name,slug").single();
    if (error) { console.error("createBrand error:", error); toast.error(error.code==="23505"?"Store already exists":`Error: ${error.message}`); setAddingBrand(false); return; }
    setBrands(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    setLinkedBrand(data); setLinkedLocation(null); fetchBrandLocations(data.id);
    setNewBrandName(""); setNewBrandWebsite(""); setNewBrandPhone(""); setShowAddBrand(false);
    toast.success(`✦ ${name} added`);
    setAddingBrand(false);
  }

  async function createLocation() {
    if (!linkedBrand) return;
    const city = newLocCity.trim();
    if (!city) { toast.error("Enter city"); return; }
    setAddingLoc(true);
    const branch_name = newLocBranch.trim() || `${linkedBrand.name} - ${city}`;
    const locPayload: any = { brand_id:linkedBrand.id, branch_name, city };
    if (newLocAddress.trim()) locPayload.address = newLocAddress.trim();
    if (newLocState.trim()) locPayload.state = newLocState.trim();
    if (newLocZip.trim()) locPayload.zip = newLocZip.trim();
    if (newLocPhone.trim()) locPayload.phone = newLocPhone.trim();
    if (newLocLat != null) locPayload.lat = newLocLat;
    if (newLocLng != null) locPayload.lng = newLocLng;
    if (newLocMapLink) locPayload.map_link = newLocMapLink;
    const { data, error } = await supabase.from("store_locations").insert(locPayload).select("id,branch_name,address,city,state,zip,phone,lat,lng,map_link").single();
    if (error) { console.error("createLocation error:", error); toast.error(`Could not add location: ${error.message}`); setAddingLoc(false); return; }
    setLocations(prev=>[...prev,data]);
    setLinkedLocation(data);
    setNewLocBranch(""); setNewLocAddress(""); setNewLocCity(""); setNewLocState(""); setNewLocZip(""); setNewLocPhone(""); setNewLocLat(null); setNewLocLng(null); setNewLocMapLink(""); setShowAddLoc(false);
    toast.success("Location added");
    setAddingLoc(false);
  }

  function handleFile(f: File) {
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setSaved(false); setItems([]); setBillNumber(""); setDupWarn(null); setScanError(null);
    setLinkedBrand(null); setLinkedLocation(null); setLocations([]); setStep("upload");
  }

  function toB64(f: File): Promise<string> {
    return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  }

  async function scan() {
    if (!file) return;
    setLoading(true);
    setScanError(null);
    try {
      const b64 = await toB64(file);
      const res = await fetch("/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({b64,mime:file.type})});
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const extracted: BillItem[] = (data.items||[]).map((i:any,idx:number)=>{
        const item = {id:`item-${idx}-${Date.now()}`,name:i.name||"",unit_price:parseFloat(i.unit_price)||0,actual_price:parseFloat(i.actual_price)||0,quantity:parseInt(i.quantity)||1,unit:i.unit||"ea",category:i.category||"Other",confidence:0};
        item.confidence = computeConfidence(item);
        return item;
      });
      extracted.sort((a,b)=>a.confidence-b.confidence);
      setResult(data); setItems(extracted); setManualTotal(data.total||0); setBillNumber(data.bill_number||"");
      setStep("review");
      toast.success(`✦ ${extracted.length} items found!`);
    } catch(e:any) {
      setScanError(e.message||"Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  function updateItem(id: string, field: string, value: any) {
    setItems(prev=>prev.map(i=>{
      if (i.id!==id) return i;
      const updated = {...i,[field]:value};
      updated.confidence = computeConfidence(updated);
      return updated;
    }));
  }

  function removeItem(id: string) { setItems(prev=>prev.filter(i=>i.id!==id)); }

  function addItem() {
    const newItem: BillItem = {id:`item-new-${Date.now()}`,name:"",unit_price:0,actual_price:0,quantity:1,unit:"ea",category:"Other",confidence:0};
    setItems(prev=>[...prev,newItem]);
    setEditingId(newItem.id);
  }

  async function saveBill(force=false) {
    setSaving(true);
    try {
      const {data:{session}} = await supabaseAuth.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("You must be signed in to save a bill");

      const storeName = result.store_name||"Unknown Store";
      const purchaseDate = result.purchase_date||new Date().toISOString().split("T")[0];
      const total = manualTotal || items.reduce((s,i)=>s+i.actual_price,0);

      if (!force) {
        const {data:existingBills} = await supabase
          .from("expenses")
          .select("id,bill_number,total")
          .eq("user_id",userId)
          .eq("store_name",storeName)
          .eq("purchase_date",purchaseDate);

        if (existingBills&&existingBills.length>0) {
          const byBillNum = billNumber
            ? existingBills.find(b=>b.bill_number&&b.bill_number===billNumber)
            : null;
          const byTotal = existingBills.find(b=>Math.abs((b.total||0)-total)<0.01);
          const match = byBillNum||byTotal;
          if (match) {
            setDupWarn({matchedOn: byBillNum?"bill number":"store, date & total"});
            return;
          }
        }
      }

      const {data:expRows, error:expErr} = await supabase.from("expenses").insert({
        user_id:userId,store_name:storeName,
        store_city:result.store_city||"",store_zip:result.store_zip||"",
        bill_number:billNumber||null,
        purchase_date:purchaseDate,
        currency:result.currency||"USD",total,items_count:items.length,source:"receipt",
      }).select("id");
      if (expErr) { console.error("expenses insert error:", expErr); throw new Error(expErr.message||"Failed to save bill"); }
      const expense = expRows?.[0];

      if (expense?.id) {
        const {error:itemsErr} = await supabase.from("expense_items").insert(items.map(i=>({
          expense_id:expense.id,name:i.name,price:i.actual_price,
          quantity:i.quantity,unit:i.unit,category:i.category,
        })));
        if (itemsErr) console.error("expense_items insert error:", itemsErr);
      }

      if (sharePrices&&(result.store_name||linkedBrand)) {
        const storeNameForHistory = linkedBrand?.name||result.store_name;
        const storeCityForHistory = linkedLocation?.city||result.store_city||"";
        const phItems = items.filter(i=>i.unit_price>0&&i.name.trim()).map(i=>({
          normalized_name:i.name.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,""),
          item_name:i.name.trim(),category:i.category||"Other",
          store_name:storeNameForHistory,store_city:storeCityForHistory,
          price:i.unit_price,unit:i.unit,currency:result.currency||"USD",
          source:"receipt",recorded_at:new Date().toISOString(),
        }));
        if (phItems.length) {
          const {error:phErr} = await supabase.from("price_history").insert(phItems);
          if (phErr) console.error("price_history insert error:", phErr);
        }
      }

      const pts = 5+(items.length*2);
      addPoints(pts);
      if (userId) {
        const {data:prof} = await supabase.from("user_profiles").select("points").eq("user_id",userId).single();
        const newPts = (prof?.points||0)+pts;
        await supabase.from("user_profiles").upsert({user_id:userId,points:newPts,updated_at:new Date().toISOString()},{onConflict:"user_id"});
        if (user) setUser({...user,points:newPts});
      }

      setSaved(true); setStep("confirm");
      toast.success(`✦ +${pts} pts · Bill saved!`);
    } catch(e:any) {
      console.error("saveBill error:", e);
      toast.error(e.message||"Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  const zeroPriceCount = items.filter(i=>i.unit_price<=0).length;
  const noNameCount = items.filter(i=>!i.name.trim()).length;
  const lowConfCount = items.filter(i=>i.confidence<60).length;
  const avgConf = items.length>0?Math.round(items.reduce((s,i)=>s+i.confidence,0)/items.length):0;
  const stockItems = items.filter(i=>STOCK_CATS.includes(i.category));
  const historyItems = items.filter(i=>!STOCK_CATS.includes(i.category));
  const total = items.reduce((s,i)=>s+i.actual_price,0);
  const progress = step==="upload"?1:step==="review"?2:3;

  function acceptConsent() {
    localStorage.setItem("kb_scan_consent","1");
    setSharePrices(consentSharePrices);
    setShowConsent(false);
  }

  return (
    <>
      {/* ── Scan Consent Modal ── */}
      {showConsent && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:"var(--surf)",borderRadius:20,padding:"28px 24px",maxWidth:420,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.3)"}}>
            <div style={{fontSize:28,marginBottom:12,textAlign:"center" as const}}>🔒</div>
            <div style={{fontSize:17,fontWeight:700,color:"var(--text)",marginBottom:6,textAlign:"center" as const}}>Before you scan</div>
            <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.6,marginBottom:20,textAlign:"center" as const}}>
              To read your receipt, your image is sent to <strong>Claude AI by Anthropic</strong> for text extraction. The image is not stored by KNOWBOTH.
            </div>

            <div style={{display:"flex",flexDirection:"column" as const,gap:10,marginBottom:22}}>
              {[
                {icon:"🤖", text:"Receipt image → Claude AI (Anthropic) for item extraction"},
                {icon:"🗄️", text:"Extracted expenses stored securely in your KNOWBOTH account"},
                {icon:"🔐", text:"Personal details (card numbers, loyalty IDs) are masked and never captured"},
              ].map(r=>(
                <div key={r.icon} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 12px",background:"var(--bg)",borderRadius:10,border:"1px solid var(--border)"}}>
                  <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
                  <span style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{r.text}</span>
                </div>
              ))}

              {/* Community price sharing opt-in */}
              <div
                onClick={()=>setConsentSharePrices(p=>!p)}
                style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",background: consentSharePrices?"rgba(48,209,88,0.06)":"var(--bg)",borderRadius:10,border:`1px solid ${consentSharePrices?"rgba(48,209,88,0.3)":"var(--border)"}`,cursor:"pointer",transition:"all 0.15s"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${consentSharePrices?"#30D158":"var(--border)"}`,background:consentSharePrices?"#30D158":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
                  {consentSharePrices&&<span style={{color:"#fff",fontSize:10,fontWeight:700,lineHeight:1}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>Share prices with community <span style={{fontWeight:400,color:"var(--text3)"}}>(optional)</span></div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Item names, prices and store name only — no personal data.</div>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>router.back()}
                style={{flex:1,padding:"11px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:12,fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
                Cancel
              </button>
              <button onClick={acceptConsent}
                style={{flex:2,padding:"11px",background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:12,fontSize:13,fontWeight:700,color:"#000",cursor:"pointer"}}>
                I Understand — Continue
              </button>
            </div>
            <div style={{marginTop:12,textAlign:"center" as const,fontSize:10,color:"var(--text3)"}}>
              This notice is shown once. You can review our privacy policy in Settings.
            </div>
          </div>
        </div>
      )}

      <div style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{padding:"20px 24px",maxWidth:1200,width:"100%"}}>

          {/* Header */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <h1 style={{fontSize:20,fontWeight:700,color:"var(--text)",letterSpacing:-0.5}}>Scan Bill</h1>
              {step==="review"&&<div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:avgConf>=80?"#30D158":avgConf>=60?"#FF9F0A":"#FF3B30"}}>Avg: {avgConf}%</div>}
            </div>
            <div style={{display:"flex",background:"var(--surf)",borderRadius:12,padding:3,boxShadow:"var(--shadow)"}}>
              {["Upload","Review","Confirm"].map((s,i)=>(
                <div key={s} style={{flex:1,padding:"8px 4px",borderRadius:10,textAlign:"center" as const,fontSize:12,fontWeight:600,background:progress===i+1?"#FF9F0A":progress>i+1?"rgba(48,209,88,0.1)":"transparent",color:progress===i+1?"#fff":progress>i+1?"#30D158":"var(--text3)",transition:"all 0.2s"}}>
                  {progress>i+1?"✓ ":""}{s}
                </div>
              ))}
            </div>
          </div>

          {/* STEP 1: UPLOAD */}
          {step==="upload"&&(
            <div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} style={{display:"none"}}/>

              {/* Inline scan error */}
              {scanError&&(
                <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"14px 16px",background:"rgba(255,59,48,0.06)",border:"1px solid rgba(255,59,48,0.25)",borderRadius:14,marginBottom:12}}>
                  <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#FF3B30",marginBottom:3}}>Scan Failed</div>
                    <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{scanError}</div>
                  </div>
                  <button onClick={()=>setScanError(null)} style={{background:"none",border:"none",fontSize:14,color:"var(--text3)",cursor:"pointer",flexShrink:0,padding:"0 2px"}}>✕</button>
                </div>
              )}

              <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.dataTransfer.files[0]&&handleFile(e.dataTransfer.files[0]);}}
                style={{border:`2px dashed ${file?"#FF9F0A":"var(--border)"}`,borderRadius:16,padding:"32px 20px",textAlign:"center",background:"var(--surf)",marginBottom:12,boxShadow:"var(--shadow)",position:"relative"}}>
                {preview?(
                  <>
                    <img src={preview} alt="" style={{maxHeight:200,borderRadius:10,objectFit:"contain",margin:"0 auto",display:"block"}}/>
                    <div style={{marginTop:10,fontSize:12,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{file?.name}</div>
                    <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
                      <button onClick={e=>{e.stopPropagation();fileRef.current?.click();}}
                        style={{padding:"7px 16px",background:"rgba(255,159,10,0.1)",border:"1px solid rgba(255,159,10,0.3)",borderRadius:9,fontSize:12,fontWeight:600,color:"#FF9F0A",cursor:"pointer"}}>
                        🔄 Change
                      </button>
                      <button onClick={e=>{e.stopPropagation();setFile(null);setPreview(null);}}
                        style={{padding:"7px 16px",background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:9,fontSize:12,fontWeight:600,color:"#FF3B30",cursor:"pointer"}}>
                        ✕ Remove
                      </button>
                    </div>
                  </>
                ):(
                  <div onClick={()=>fileRef.current?.click()} style={{cursor:"pointer"}}>
                    <div style={{fontSize:48,marginBottom:10}}>🧾</div>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:4}}>Upload Your Bill</div>
                    <div style={{fontSize:13,color:"var(--text3)"}}>JPG · PNG · PDF · Any store · Any language</div>
                  </div>
                )}
              </div>
              {file&&(
                <button onClick={scan} disabled={loading} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:loading?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                  {loading?"🤖 Scanning...":"🤖 Scan with KNOWBOTH AI"}
                </button>
              )}
            </div>
          )}

          {/* STEP 2: REVIEW */}
          {step==="review"&&(
            <div style={{display:"grid",gridTemplateColumns:showBill&&preview?"1fr 400px":"1fr",gap:16,alignItems:"start"}}>
              <div>
                {/* Store info */}
                {result&&(
                  <div style={{background:"var(--surf)",borderRadius:12,padding:"12px 16px",marginBottom:12,boxShadow:"var(--shadow)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:2}}>🏪 {result.store_name||"Unknown Store"}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>{result.store_city} · {result.purchase_date}</div>
                        {/* Bill number — editable */}
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:10,fontWeight:700,color:"var(--text3)",whiteSpace:"nowrap" as const}}>BILL #</span>
                          <input
                            value={billNumber}
                            onChange={e=>setBillNumber(e.target.value)}
                            placeholder="Not detected — enter manually"
                            style={{flex:1,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:7,padding:"5px 8px",fontSize:11,color:"var(--text)",outline:"none"}}
                          />
                        </div>
                      </div>
                      <div style={{textAlign:"right" as const,flexShrink:0}}>
                        {editTotal
                          ?<input type="number" step="0.01" autoFocus style={{width:90,background:"var(--bg)",border:"1px solid #FF9F0A",borderRadius:8,padding:"4px 8px",fontSize:16,fontWeight:900,color:"#FF9F0A",outline:"none",textAlign:"right"}} value={manualTotal||""} onChange={e=>setManualTotal(parseFloat(e.target.value)||0)} onBlur={()=>setEditTotal(false)}/>
                          :<div onClick={()=>setEditTotal(true)} style={{fontSize:20,fontWeight:900,color:"#FF9F0A",cursor:"pointer"}} title="Tap to edit">${(manualTotal||total).toFixed(2)} ✏️</div>
                        }
                        <div style={{fontSize:10,color:"var(--text3)"}}>Items: ${total.toFixed(2)}</div>
                      </div>
                    </div>
                    {result.total_mismatch&&(
                      <div style={{marginTop:8,padding:"6px 10px",background:"rgba(255,159,10,0.08)",border:"1px solid rgba(255,159,10,0.25)",borderRadius:8,fontSize:11,color:"#FF9F0A"}}>
                        💡 Total mismatch — some items may be missing. Tap total to edit.
                      </div>
                    )}
                  </div>
                )}

                {/* Link to Store Brand */}
                <div style={{background:"var(--surf)",borderRadius:12,padding:"12px 16px",marginBottom:12,boxShadow:"var(--shadow)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>🏪 Link to Store</div>
                    {linkedBrand&&<span style={{fontSize:11,color:"#30D158",fontWeight:600}}>✓ {linkedBrand.name}</span>}
                  </div>
                  {!showAddBrand?(
                    <div style={{display:"flex",gap:6,marginBottom:linkedBrand?10:0}}>
                      <select value={linkedBrand?.id||""} onChange={e=>{const b=brands.find(b=>b.id===e.target.value)||null;setLinkedBrand(b);setLinkedLocation(null);if(b)fetchBrandLocations(b.id);else setLocations([]);}}
                        style={{flex:1,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:9,padding:"9px 10px",fontSize:13,color:"var(--text)",outline:"none",cursor:"pointer"}}>
                        <option value="">— Select store —</option>
                        {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button onClick={()=>{setShowAddBrand(true);setNewBrandName(result?.store_name||"");}}
                        style={{padding:"9px 12px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:9,fontSize:12,fontWeight:600,color:"#FF9F0A",cursor:"pointer",whiteSpace:"nowrap" as const}}>
                        + New
                      </button>
                    </div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:7,marginBottom:10,padding:"12px",background:"rgba(255,159,10,0.04)",border:"1px dashed rgba(255,159,10,0.3)",borderRadius:10}}>
                      <input value={newBrandName} onChange={e=>setNewBrandName(e.target.value)} autoFocus placeholder="Store name *"
                        style={{background:"var(--bg)",border:"1px solid rgba(255,159,10,0.4)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"var(--text)",outline:"none"}}/>
                      <input value={newBrandWebsite} onChange={e=>setNewBrandWebsite(e.target.value)} placeholder="Website (e.g. walmart.com)"
                        style={{background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"var(--text)",outline:"none"}}/>
                      <input value={newBrandPhone} onChange={e=>setNewBrandPhone(e.target.value)} placeholder="Phone (optional)"
                        style={{background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"var(--text)",outline:"none"}}/>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={createBrand} disabled={addingBrand||!newBrandName.trim()}
                          style={{flex:2,padding:"8px",background:"#FF9F0A",border:"none",borderRadius:8,fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",opacity:!newBrandName.trim()?0.5:1}}>
                          {addingBrand?"Adding...":"Add Store"}
                        </button>
                        <button onClick={()=>setShowAddBrand(false)}
                          style={{flex:1,padding:"8px",background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)",cursor:"pointer"}}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {linkedBrand&&(
                    <>
                      <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:6}}>LOCATION (optional)</div>
                      {!showAddLoc?(
                        <div>
                          <div style={{display:"flex",gap:6,marginBottom:linkedLocation?.map_link?6:0}}>
                            <select value={linkedLocation?.id||""} onChange={e=>setLinkedLocation(locations.find(l=>l.id===e.target.value)||null)}
                              style={{flex:1,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:9,padding:"8px 10px",fontSize:12,color:"var(--text)",outline:"none",cursor:"pointer"}}>
                              <option value="">— All / Unknown —</option>
                              {locations.map(l=><option key={l.id} value={l.id}>{l.branch_name}{l.city?` · ${l.city}`:""}{l.zip?` ${l.zip}`:""}</option>)}
                            </select>
                            <button onClick={()=>setShowAddLoc(true)}
                              style={{padding:"8px 10px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:9,fontSize:11,fontWeight:600,color:"#FF9F0A",cursor:"pointer",whiteSpace:"nowrap" as const}}>
                              + Add
                            </button>
                          </div>
                          {linkedLocation?.map_link&&(
                            <a href={linkedLocation.map_link} target="_blank" rel="noreferrer"
                              style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"#0A84FF",fontWeight:500,textDecoration:"none",marginTop:4}}>
                              🗺️ View on Google Maps ↗
                            </a>
                          )}
                        </div>
                      ):(
                        <div style={{display:"flex",flexDirection:"column" as const,gap:6,padding:"10px",background:"rgba(255,159,10,0.04)",border:"1px dashed rgba(255,159,10,0.3)",borderRadius:9}}>
                          <input value={newLocBranch} onChange={e=>setNewLocBranch(e.target.value)} placeholder="Branch name (optional)" autoFocus
                            style={{background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"var(--text)",outline:"none"}}/>
                          <input value={newLocAddress} onChange={e=>setNewLocAddress(e.target.value)} placeholder="Street address"
                            style={{background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"var(--text)",outline:"none"}}/>
                          <div style={{display:"flex",gap:5}}>
                            <input value={newLocCity} onChange={e=>setNewLocCity(e.target.value)} placeholder="City *"
                              style={{flex:2,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"var(--text)",outline:"none"}}/>
                            <input value={newLocState} onChange={e=>setNewLocState(e.target.value.toUpperCase().slice(0,2))} placeholder="ST" maxLength={2}
                              style={{width:40,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 6px",fontSize:12,color:"var(--text)",outline:"none",textAlign:"center" as const}}/>
                            <input value={newLocZip} onChange={e=>setNewLocZip(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="ZIP" maxLength={5}
                              style={{width:64,background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 8px",fontSize:12,color:"var(--text)",outline:"none"}}/>
                          </div>
                          <input value={newLocPhone} onChange={e=>setNewLocPhone(e.target.value)} placeholder="Phone (optional)"
                            style={{background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"var(--text)",outline:"none"}}/>
                          <button onClick={lookupLocation} disabled={lookingUpLoc}
                            style={{padding:"8px",background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:8,fontSize:11,fontWeight:600,color:"#0A84FF",cursor:"pointer"}}>
                            {lookingUpLoc?"🔍 Looking up...":"📍 Auto-fill from address / zip"}
                          </button>
                          {newLocMapLink&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 9px",background:"rgba(48,209,88,0.06)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:8}}>
                              <span style={{fontSize:12}}>🗺️</span>
                              <a href={newLocMapLink} target="_blank" rel="noreferrer" style={{flex:1,fontSize:11,color:"#30D158",fontWeight:600,textDecoration:"none"}}>View on Google Maps ↗</a>
                              {newLocLat&&<span style={{fontSize:9,color:"var(--text3)"}}>{newLocLat.toFixed(4)}, {newLocLng?.toFixed(4)}</span>}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={createLocation} disabled={addingLoc||!newLocCity.trim()}
                              style={{flex:2,padding:"8px",background:"#FF9F0A",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",opacity:!newLocCity.trim()?0.5:1}}>
                              {addingLoc?"Saving...":"Save Location"}
                            </button>
                            <button onClick={()=>setShowAddLoc(false)}
                              style={{flex:1,padding:"8px",background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text2)",cursor:"pointer"}}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Alerts */}
                <div style={{marginBottom:10}}>
                  {noNameCount>0&&<Alert type="error" message={`${noNameCount} item${noNameCount>1?"s":""} missing name`}/>}
                  {zeroPriceCount>0&&<Alert type="error" message={`${zeroPriceCount} item${zeroPriceCount>1?"s":""} have $0 price`}/>}
                  {lowConfCount>0&&<Alert type="warning" message={`${lowConfCount} item${lowConfCount>1?"s":""} have low confidence`}/>}
                  {zeroPriceCount===0&&noNameCount===0&&lowConfCount===0&&<Alert type="info" message="All items look good!"/>}
                </div>

                {/* Toolbar */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{items.length} items · ${total.toFixed(2)}</span>
                  <div style={{display:"flex",gap:8}}>
                    {preview&&<button onClick={()=>setShowBill(!showBill)} style={{background:"var(--surf)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>{showBill?"Hide Bill":"Show Bill"}</button>}
                    <button onClick={()=>{setStep("upload");setResult(null);setItems([]);}} style={{background:"var(--surf)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>← Rescan</button>
                    <button onClick={addItem} style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#30D158",cursor:"pointer"}}>+ Add</button>
                  </div>
                </div>

                {/* Items */}
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:12}}>
                  {items.map(item=>(
                    <div key={item.id} style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)",border:item.confidence<60||item.unit_price<=0?"1px solid rgba(255,59,48,0.2)":"1px solid transparent"}}>
                      {editingId!==item.id?(
                        <div onClick={()=>setEditingId(item.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer"}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:STOCK_CATS.includes(item.category)?"#30D158":"#AEAEB2",flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                              <span style={{fontSize:14,fontWeight:600,color:item.name?"var(--text)":"#FF3B30"}}>{item.name||"⚠️ Missing name"}</span>
                              <ConfidenceBadge score={item.confidence}/>
                              {item.unit_price<=0&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"2px 7px"}}>⚠️ No price</span>}
                            <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                              {item.category} · qty {item.quantity} · <span style={{fontWeight:600,color:STOCK_CATS.includes(item.category)?"#30D158":"var(--text3)"}}>{STOCK_CATS.includes(item.category)?"📦 Stock":"📋 History"}</span>
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:15,fontWeight:700,color:item.unit_price>0?"#FF9F0A":"#FF3B30"}}>${item.actual_price.toFixed(2)}</div>
                            <div style={{fontSize:10,color:"var(--text3)"}}>${item.unit_price.toFixed(2)}/ea × {item.quantity}</div>
                            {item.discount>0&&<div style={{fontSize:10,color:"#30D158",fontWeight:600}}>−${item.discount.toFixed(2)} saved</div>}
                          </div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();removeItem(item.id);}} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"5px 8px",fontSize:11,color:"#FF3B30",cursor:"pointer",flexShrink:0}}>✕</button>
                        </div>
                      ):(
                        <div style={{padding:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Edit Item</span>
                              <ConfidenceBadge score={item.confidence}/>
                            </div>
                            <button onClick={()=>setEditingId(null)} style={{background:"#FF9F0A",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                            <div style={{gridColumn:"1/-1"}}>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>ITEM NAME</div>
                              <input style={{width:"100%",background:"var(--bg)",border:!item.name?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none"}} value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="Item name"/>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>UNIT PRICE ($)</div>
                              <input type="number" step="0.01" style={{width:"100%",background:"var(--bg)",border:item.unit_price<=0?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none"}} value={item.unit_price||""} onChange={e=>updateItem(item.id,"unit_price",parseFloat(e.target.value)||0)} placeholder="4.99"/>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>ACTUAL PRICE ($)</div>
                              <input type="number" step="0.01" style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none"}} value={item.actual_price||""} onChange={e=>updateItem(item.id,"actual_price",parseFloat(e.target.value)||0)} placeholder="9.98"/>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>QTY</div>
                              <input type="number" style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none"}} value={item.quantity} onChange={e=>updateItem(item.id,"quantity",parseInt(e.target.value)||1)}/>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>UNIT</div>
                              <select style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none",cursor:"pointer"}} value={item.unit} onChange={e=>updateItem(item.id,"unit",e.target.value)}>
                                {["ea","bag","lb","oz","kg","pack","box","bottle","jar","bunch","gallon","liter","dozen"].map(u=><option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",marginBottom:4}}>CATEGORY</div>
                              <select style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text)",outline:"none",cursor:"pointer"}} value={item.category} onChange={e=>updateItem(item.id,"category",e.target.value)}>
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
                <div style={{background:"var(--surf)",borderRadius:12,padding:"14px 16px",marginBottom:12,boxShadow:"var(--shadow)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3}}>📊 Share prices with community</div>
                      <div style={{fontSize:11,color:"var(--text2)"}}>Store name, location, items & prices only. No personal info shared.</div>
                      <div style={{fontSize:10,color:"var(--text3)",marginTop:3}}>⚠️ Price may vary. Captured as accurately as possible.</div>
                    </div>
                    <div onClick={()=>setSharePrices(!sharePrices)} style={{width:44,height:26,borderRadius:13,cursor:"pointer",position:"relative",background:sharePrices?"#FF9F0A":"#E5E5EA",transition:"background 0.2s",flexShrink:0}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:sharePrices?20:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
                    </div>
                  </div>
                </div>

                {/* Duplicate warning */}
                {dupWarn&&(
                  <div style={{background:"rgba(255,159,10,0.06)",border:"1.5px solid rgba(255,159,10,0.35)",borderRadius:14,padding:"16px",marginBottom:12}}>
                    <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
                      <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,159,10,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🔁</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:4}}>This bill has already been saved</div>
                        <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.6}}>
                          A bill from <strong>{result?.store_name||"this store"}</strong> dated <strong>{result?.purchase_date||"this date"}</strong> was found in your history — matched by <strong>{dupWarn.matchedOn}</strong>.
                        </div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>Saving again will create a duplicate. Are you sure this is a different bill?</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setDupWarn(null)}
                        style={{flex:1,padding:"10px",background:"var(--bg)",border:"0.5px solid var(--border)",borderRadius:10,fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
                        ← Go Back
                      </button>
                      <button onClick={()=>saveBill(true)} disabled={saving}
                        style={{flex:2,padding:"10px",background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",opacity:saving?0.7:1}}>
                        {saving?"Saving...":"Yes, Save as New Bill"}
                      </button>
                    </div>
                  </div>
                )}

                {!dupWarn&&(
                  <button onClick={()=>saveBill()} disabled={saving||noNameCount>0||zeroPriceCount>0}
                    style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:(noNameCount>0||zeroPriceCount>0)?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                    {saving?"💾 Saving...":(noNameCount>0?"Fix missing names":zeroPriceCount>0?"Fix $0 prices":"💾 Save Bill")}
                  </button>
                )}
              </div>

              {/* Bill image */}
              {showBill&&preview&&(
                <div style={{position:"sticky",top:80,background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow-md)"}}>
                  <div style={{padding:"12px 16px",borderBottom:"0.5px solid var(--border2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>🧾 Bill Reference</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))} style={{background:"var(--bg)",border:"none",borderRadius:7,padding:"4px 10px",fontSize:15,cursor:"pointer",fontWeight:700,color:"var(--text)"}}>−</button>
                      <span style={{fontSize:11,color:"var(--text2)",fontWeight:600,minWidth:36,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
                      <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={{background:"var(--bg)",border:"none",borderRadius:7,padding:"4px 10px",fontSize:15,cursor:"pointer",fontWeight:700,color:"var(--text)"}}>+</button>
                      <button onClick={()=>setZoom(1)} style={{background:"var(--bg)",border:"none",borderRadius:7,padding:"4px 8px",fontSize:10,cursor:"pointer",color:"var(--text2)",fontWeight:600}}>Reset</button>
                    </div>
                  </div>
                  <div style={{overflow:"auto",maxHeight:560,padding:12,cursor:zoom>1?"grab":"default"}}>
                    <img src={preview} alt="Bill" style={{width:`${zoom*100}%`,minWidth:`${zoom*100}%`,borderRadius:10,display:"block",transition:"width 0.2s"}}/>
                  </div>
                  <div style={{padding:"8px 16px",background:"var(--bg3)",fontSize:11,color:"var(--text3)",textAlign:"center"}}>Tap items to edit · Reference your bill</div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CONFIRM */}
          {step==="confirm"&&saved&&(
            <div>
              <div style={{background:"rgba(48,209,88,0.08)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:16,padding:"24px 20px",textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:44,marginBottom:10}}>✅</div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--text)",marginBottom:6}}>Bill Saved!</div>
                <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.6}}>
                  {stockItems.length} items → Stock · {historyItems.length} items → History
                </div>
                {sharePrices&&<div style={{fontSize:12,color:"#30D158",fontWeight:500,marginTop:4}}>✦ Prices shared with community</div>}
              </div>
              <div style={{background:"var(--surf)",borderRadius:14,padding:"14px 16px",marginBottom:16,boxShadow:"var(--shadow)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <span style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>🏪 {result?.store_name}</span>
                  <span style={{fontSize:18,fontWeight:900,color:"#FF9F0A"}}>${(manualTotal||total).toFixed(2)}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[{l:"Items",v:items.length,c:"#FF9F0A"},{l:"→ Stock",v:stockItems.length,c:"#30D158"},{l:"→ History",v:historyItems.length,c:"var(--text3)"}].map(s=>(
                    <div key={s.l} style={{background:"var(--bg)",borderRadius:10,padding:"10px",textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <button onClick={()=>router.push("/stock")} style={{padding:"12px 8px",background:"rgba(48,209,88,0.1)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#30D158",cursor:"pointer"}}>📦 Stock</button>
                <button onClick={()=>router.push("/expenses")} style={{padding:"12px 8px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"#FF9F0A",cursor:"pointer"}}>📊 Expenses</button>
                <button onClick={()=>{setStep("upload");setResult(null);setFile(null);setPreview(null);setItems([]);setSaved(false);}} style={{padding:"12px 8px",background:"var(--bg)",border:"none",borderRadius:12,fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>🧾 Scan More</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
