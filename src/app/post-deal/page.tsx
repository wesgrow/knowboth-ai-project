"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

const CATS = ["Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household","Other"];
const UNITS = ["bag","lb","oz","kg","ea","pack","box","bottle","jar","bunch","dozen","gallon","liter","5 for","7 for","10 for"];
const VALID_CATS = ["Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household","Other"];
type Step = "upload"|"review"|"store"|"confirm";

interface DealItem {
  id: string;
  name: string;
  normalized_name: string;
  price: number;
  regular_price: number|null;
  unit: string;
  category: string;
  notes: string;
  confidence: number; // 0-100
}

interface Brand { id: string; name: string; slug: string; }
interface Location { id: string; branch_name: string; city: string; zip: string; }

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#30D158" : score >= 60 ? "#FF9F0A" : "#FF3B30";
  const label = score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
  return (
    <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "2px 7px", background: `${color}18`, color, border: `1px solid ${color}44` }}>
      {label} {score}%
    </span>
  );
}

function Alert({ type, message }: { type: "error"|"warning"|"info"; message: string }) {
  const colors = { error: "#FF3B30", warning: "#FF9F0A", info: "#0A84FF" };
  const icons = { error: "⚠️", warning: "💡", info: "ℹ️" };
  const c = colors[type];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 14 }}>{icons[type]}</span>
      <span style={{ fontSize: 12, color: c, fontWeight: 500 }}>{message}</span>
    </div>
  );
}

export default function PostDealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [uploadMode, setUploadMode] = useState<"image"|"url">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [activePreview, setActivePreview] = useState(0);
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [items, setItems] = useState<DealItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand|null>(null);
  const [locationMode, setLocationMode] = useState<"all"|"specific">("all");
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);
  const [saleStart, setSaleStart] = useState(new Date().toISOString().split("T")[0]);
  const [saleEnd, setSaleEnd] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [showFlyer, setShowFlyer] = useState(true);
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ fetchBrands(); },[]);

  async function fetchBrands() {
    const{data}=await supabase.from("brands").select("id,name,slug").order("name");
    setBrands(data||[]);
  }

  async function fetchLocations(brandId:string) {
    const{data}=await supabase.from("store_locations").select("id,branch_name,city,zip").eq("brand_id",brandId).order("city");
    setLocations(data||[]);
  }

  function handleFiles(newFiles: FileList|null) {
    if(!newFiles) return;
    const arr = Array.from(newFiles).filter(f=>f.type.startsWith("image/")||f.type==="application/pdf");
    if(arr.length===0){toast.error("Only images and PDFs supported");return;}
    setFiles(prev=>[...prev,...arr]);
    const newPreviews = arr.map(f=>f.type.startsWith("image/")?URL.createObjectURL(f):"pdf");
    setPreviews(prev=>[...prev,...newPreviews]);
  }

  function removeFile(idx:number) {
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
    setPreviews(prev=>prev.filter((_,i)=>i!==idx));
    if(activePreview>=idx) setActivePreview(Math.max(0,activePreview-1));
  }

  function toB64(f:File):Promise<string> {
    return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  }

  // Compute confidence score per item
  function computeConfidence(item:any): number {
    let score = 100;
    if(!item.name||item.name.length<2) score -= 40;
    if(!item.price||item.price<=0) score -= 30;
    if(!item.unit||item.unit==="ea") score -= 5;
    if(!item.regular_price) score -= 5;
    if(!item.category||item.category==="Other") score -= 10;
    if(item.price>100) score -= 20; // suspiciously high
    if(item.name&&item.name.length>60) score -= 10; // too long name
    return Math.max(0, Math.min(100, score));
  }

  async function extract() {
    if(uploadMode==="image"&&files.length===0){toast.error("Select at least one file");return;}
    if(uploadMode==="url"&&!url.trim()){toast.error("Enter URL");return;}
    setExtracting(true);
    const allItems:DealItem[] = [];
    try{
      if(uploadMode==="image") {
        for(let i=0;i<files.length;i++) {
          setExtractProgress(`Extracting file ${i+1} of ${files.length}...`);
          const b64 = await toB64(files[i]);
          const body = { store:selectedBrand?.name||"Unknown Store", b64, mime:files[i].type };
          const res = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
          const data = await res.json();
          if(data.error) { toast.error(`File ${i+1}: ${data.error}`); continue; }
          const extracted = (data.items||[]).map((item:any,idx:number)=>{
            const raw = {
              id:`file${i}-item${idx}-${Date.now()}`,
              name:item.name||"",
              normalized_name:item.normalized_name||(item.name||"").toLowerCase(),
              price:parseFloat(item.price)||0,
              regular_price:item.regular_price?parseFloat(item.regular_price):null,
              unit:item.unit||"ea",
              category:VALID_CATS.includes(item.category)?item.category:"Other",
              notes:item.notes||"",
              confidence:0,
            };
            raw.confidence = computeConfidence(raw);
            return raw;
          });
          allItems.push(...extracted);
          toast.success(`File ${i+1}: ${extracted.length} items found`);
        }
      } else {
        setExtractProgress("Extracting from URL...");
        const body = { store:selectedBrand?.name||"Unknown Store", url };
        const res = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        allItems.push(...(data.items||[]).map((item:any,idx:number)=>{
          const raw = {
            id:`url-item${idx}-${Date.now()}`,
            name:item.name||"",
            normalized_name:item.normalized_name||(item.name||"").toLowerCase(),
            price:parseFloat(item.price)||0,
            regular_price:item.regular_price?parseFloat(item.regular_price):null,
            unit:item.unit||"ea",
            category:VALID_CATS.includes(item.category)?item.category:"Other",
            notes:item.notes||"",
            confidence:0,
          };
          raw.confidence = computeConfidence(raw);
          return raw;
        }));
      }
      if(allItems.length===0){toast.error("No items found");return;}
      const seen = new Set<string>();
      const deduped = allItems.filter(i=>{
        const key = i.name.toLowerCase().trim();
        if(seen.has(key))return false;
        seen.add(key);
        return true;
      });
      // Sort: low confidence first so user fixes them
      deduped.sort((a,b)=>a.confidence-b.confidence);
      setItems(deduped);
      setStep("review");
      const lowConf = deduped.filter(i=>i.confidence<60).length;
      toast.success(`✦ ${deduped.length} items extracted${lowConf>0?` · ${lowConf} need review`:""}`);
    }catch(e:any){toast.error(e.message);}
    setExtracting(false);
    setExtractProgress("");
  }

  function updateItem(id:string, field:string, value:any) {
    setItems(prev=>prev.map(i=>{
      if(i.id!==id) return i;
      const updated = {...i,[field]:value,normalized_name:field==="name"?value.toLowerCase():i.normalized_name};
      updated.confidence = computeConfidence(updated);
      return updated;
    }));
  }

  function deleteItem(id:string) { setItems(prev=>prev.filter(i=>i.id!==id)); toast("Item removed"); }

  function addItem() {
    const newItem:DealItem={id:`item-${Date.now()}`,name:"",normalized_name:"",price:0,regular_price:null,unit:"ea",category:"Other",notes:"",confidence:0};
    setItems(prev=>[...prev,newItem]);
    setEditingId(newItem.id);
  }

  async function publish() {
    if(!selectedBrand){toast.error("Select a store");return;}
    if(items.length===0){toast.error("No items to publish");return;}
    const noName = items.filter(i=>!i.name.trim());
    if(noName.length>0){toast.error(`${noName.length} items missing name`);setEditingId(noName[0].id);setStep("review");return;}
    const noPrice = items.filter(i=>i.price<=0);
    if(noPrice.length>0){toast.error(`${noPrice.length} items have $0 price`);setEditingId(noPrice[0].id);setStep("review");return;}
    setPublishing(true);
    try{
      const{data:deal,error:de}=await supabase.from("deals").insert({
        brand_id:selectedBrand.id,status:"approved",applies_to_all_locations:locationMode==="all",
        sale_start:saleStart,sale_end:saleEnd||null,
      }).select("id").single();
      if(de||!deal?.id)throw new Error(de?.message||"Failed to create deal");
      if(locationMode==="specific"&&selectedLocs.length>0){
        await supabase.from("deal_locations").insert(selectedLocs.map(lid=>({deal_id:deal.id,location_id:lid})));
      }
      const{error:ie}=await supabase.from("deal_items").insert(items.map(i=>({
        deal_id:deal.id,name:i.name.trim(),
        normalized_name:(i.normalized_name||i.name.toLowerCase().trim()).replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,""),
        price:i.price,regular_price:i.regular_price||null,unit:i.unit,
        category:VALID_CATS.includes(i.category)?i.category:"Other",
        notes:i.notes||null,source:uploadMode==="image"?"flyer":"manual",
      })));
      if(ie)throw new Error(ie.message);
      toast.success(`🚀 ${items.length} deals published!`);
      router.push("/deals");
    }catch(e:any){toast.error(e.message);}
    setPublishing(false);
  }

  // Alerts
  const zeroPriceCount = items.filter(i=>i.price<=0).length;
  const lowConfCount = items.filter(i=>i.confidence<60).length;
  const noNameCount = items.filter(i=>!i.name.trim()).length;
  const highPriceCount = items.filter(i=>i.price>50).length;
  const avgConfidence = items.length>0 ? Math.round(items.reduce((s,i)=>s+i.confidence,0)/items.length) : 0;

  const progress=step==="upload"?1:step==="review"?2:step==="store"?3:4;

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container" style={{maxWidth:step==="review"?1100:640}}>

        {/* Header */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <button onClick={()=>router.push("/deals")} style={{background:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Back</button>
            <h1 style={{fontSize:20,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5}}>Post a Deal</h1>
            {step==="review"&&<div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:avgConfidence>=80?"#30D158":avgConfidence>=60?"#FF9F0A":"#FF3B30"}}>Avg Confidence: {avgConfidence}%</div>}
          </div>
          <div style={{display:"flex",gap:0,background:"#fff",borderRadius:12,padding:3,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            {["Upload","Review","Store","Publish"].map((s,i)=>(
              <div key={s} style={{flex:1,padding:"8px 4px",borderRadius:10,textAlign:"center" as const,fontSize:12,fontWeight:600,background:progress===i+1?"#FF9F0A":progress>i+1?"rgba(48,209,88,0.1)":"transparent",color:progress===i+1?"#fff":progress>i+1?"#30D158":"#AEAEB2",transition:"all 0.2s"}}>
                {progress>i+1?"✓ ":""}{s}
              </div>
            ))}
          </div>
        </div>

        {/* ── STEP 1: UPLOAD ── */}
        {step==="upload"&&(
          <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Upload Flyers or Paste URL</div>
            <div style={{display:"flex",background:"#F2F2F7",borderRadius:12,padding:3,gap:3,marginBottom:16}}>
              {(["image","url"] as const).map(m=>(
                <button key={m} onClick={()=>setUploadMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:uploadMode===m?"#fff":"transparent",color:uploadMode===m?"#1C1C1E":"#AEAEB2",boxShadow:uploadMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                  {m==="image"?"📷 Upload Flyers":"🔗 Paste URL"}
                </button>
              ))}
            </div>
            {uploadMode==="image"&&(
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={e=>handleFiles(e.target.files)} style={{display:"none"}}/>
                <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}}
                  style={{border:`2px dashed ${files.length>0?"#FF9F0A":"#E5E5EA"}`,borderRadius:14,padding:"24px 20px",textAlign:"center",cursor:"pointer",marginBottom:12,background:"#F9F9F9"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📷</div>
                  <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",marginBottom:4}}>{files.length>0?`${files.length} file${files.length>1?"s":""} selected — tap to add more`:"Drop flyers here or tap to upload"}</div>
                  <div style={{fontSize:12,color:"#AEAEB2"}}>JPG · PNG · PDF · Multiple files supported</div>
                </div>
                {files.length>0&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8,marginBottom:16}}>
                    {files.map((f,i)=>(
                      <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid #E5E5EA",aspectRatio:"1",background:"#F9F9F9",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {previews[i]!=="pdf"?<img src={previews[i]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{textAlign:"center"}}><div style={{fontSize:22}}>📄</div><div style={{fontSize:9,color:"#AEAEB2",marginTop:2}}>{f.name.slice(0,12)}</div></div>}
                        <button onClick={e=>{e.stopPropagation();removeFile(i);}} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"rgba(255,59,48,0.9)",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {uploadMode==="url"&&(
              <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:12,padding:"13px 16px",fontSize:14,color:"#1C1C1E",outline:"none",marginBottom:16}} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/weekly-deals"/>
            )}
            {extracting&&<div style={{background:"rgba(255,159,10,0.08)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#FF9F0A",fontWeight:500,textAlign:"center"}}>{extractProgress}</div>}
            <button onClick={extract} disabled={extracting||(uploadMode==="image"&&files.length===0)||(uploadMode==="url"&&!url.trim())}
              style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:extracting?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
              {extracting?`🤖 ${extractProgress}`:`🤖 Extract from ${files.length>0?`${files.length} file${files.length>1?"s":""}`:"Flyer"}`}
            </button>
          </div>
        )}

        {/* ── STEP 2: REVIEW — SPLIT SCREEN ── */}
        {step==="review"&&(
          <div style={{display:"grid",gridTemplateColumns:showFlyer&&previews.length>0?"1fr 420px":"1fr",gap:16,alignItems:"start"}}>

            {/* LEFT — Items list */}
            <div>
              {/* Alerts */}
              <div style={{marginBottom:12}}>
                {noNameCount>0&&<Alert type="error" message={`${noNameCount} item${noNameCount>1?"s":""} missing name — must fix before publishing`}/>}
                {zeroPriceCount>0&&<Alert type="error" message={`${zeroPriceCount} item${zeroPriceCount>1?"s":""} have $0 price — must fix before publishing`}/>}
                {lowConfCount>0&&<Alert type="warning" message={`${lowConfCount} item${lowConfCount>1?"s":""} have low confidence — please verify`}/>}
                {highPriceCount>0&&<Alert type="warning" message={`${highPriceCount} item${highPriceCount>1?"s":""} have price >$50 — please verify`}/>}
                {zeroPriceCount===0&&noNameCount===0&&lowConfCount===0&&<Alert type="info" message="All items look good! Ready to publish."/>}
              </div>

              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <span style={{fontSize:15,fontWeight:600,color:"#1C1C1E"}}>{items.length} items</span>
                  <span style={{fontSize:12,color:"#AEAEB2",marginLeft:8}}>Avg confidence: {avgConfidence}%</span>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {previews.length>0&&<button onClick={()=>setShowFlyer(!showFlyer)} style={{background:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                    {showFlyer?"Hide Flyer":"Show Flyer"}
                  </button>}
                  <button onClick={()=>setStep("upload")} style={{background:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Re-upload</button>
                  <button onClick={addItem} style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#30D158",cursor:"pointer"}}>+ Add</button>
                </div>
              </div>

              {/* Items */}
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
                {items.map(item=>(
                  <div key={item.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",border:item.confidence<60?"1px solid rgba(255,59,48,0.2)":item.price<=0?"1px solid rgba(255,59,48,0.3)":"1px solid transparent"}}>
                    {editingId!==item.id?(
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                            <span style={{fontSize:14,fontWeight:600,color:item.name?"#1C1C1E":"#FF3B30"}}>{item.name||"⚠️ Missing name"}</span>
                            <ConfidenceBadge score={item.confidence}/>
                            {item.price<=0&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"2px 7px"}}>⚠️ No price</span>}
                            {item.price>50&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,159,10,0.1)",color:"#FF9F0A",borderRadius:20,padding:"2px 7px"}}>💡 High price</span>}
                          </div>
                          <div style={{fontSize:12,color:"#6D6D72",marginTop:2}}>{item.category} · {item.unit}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:16,fontWeight:700,color:item.price>0?"#FF9F0A":"#FF3B30"}}>{item.price>0?`$${item.price.toFixed(2)}`:"$0.00"}</div>
                          {item.regular_price&&<div style={{fontSize:10,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                        </div>
                        <button onClick={()=>setEditingId(item.id)} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:600,color:"#1C1C1E",cursor:"pointer",flexShrink:0}}>✏️</button>
                        <button onClick={()=>deleteItem(item.id)} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"6px 8px",fontSize:12,color:"#FF3B30",cursor:"pointer",flexShrink:0}}>✕</button>
                      </div>
                    ):(
                      <div style={{padding:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Edit Item</span>
                            <ConfidenceBadge score={item.confidence}/>
                          </div>
                          <button onClick={()=>setEditingId(null)} style={{background:"#FF9F0A",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>ITEM NAME {!item.name&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                            <input style={{width:"100%",background:!item.name?"rgba(255,59,48,0.05)":"#F2F2F7",border:!item.name?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="e.g. Toor Dal 4lb *"/>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>PRICE ($) {item.price<=0&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                              <input type="number" step="0.01" style={{width:"100%",background:item.price<=0?"rgba(255,59,48,0.05)":"#F2F2F7",border:item.price<=0?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.price||""} onChange={e=>updateItem(item.id,"price",parseFloat(e.target.value)||0)} placeholder="4.99"/>
                            </div>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>WAS ($)</div>
                              <input type="number" step="0.01" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.regular_price||""} onChange={e=>updateItem(item.id,"regular_price",parseFloat(e.target.value)||null)} placeholder="6.99"/>
                            </div>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>UNIT</div>
                              <select style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none",cursor:"pointer"}} value={item.unit} onChange={e=>updateItem(item.id,"unit",e.target.value)}>
                                {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>CATEGORY</div>
                            <select style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none",cursor:"pointer"}} value={item.category} onChange={e=>updateItem(item.id,"category",e.target.value)}>
                              {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>NOTES (optional)</div>
                            <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.notes} onChange={e=>updateItem(item.id,"notes",e.target.value)} placeholder="Any extra info..."/>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={()=>setStep("store")} disabled={items.length===0||noNameCount>0||zeroPriceCount>0}
                style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:(noNameCount>0||zeroPriceCount>0)?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                {noNameCount>0?"Fix missing names first":zeroPriceCount>0?"Fix $0 prices first":"Continue → Select Store"}
              </button>
            </div>

            {/* RIGHT — Flyer preview */}
            {showFlyer&&previews.length>0&&(
              <div style={{position:"sticky",top:80,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
                <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>📄 Flyer Reference</span>
                  <div style={{display:"flex",gap:4}}>
                    {previews.map((_,i)=>(
                      <button key={i} onClick={()=>setActivePreview(i)} style={{width:24,height:24,borderRadius:6,border:"none",background:activePreview===i?"#FF9F0A":"#F2F2F7",color:activePreview===i?"#fff":"#6D6D72",fontSize:11,fontWeight:700,cursor:"pointer"}}>{i+1}</button>
                    ))}
                  </div>
                </div>
                <div style={{padding:12}}>
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginBottom:8}}>
                    <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"5px 14px",fontSize:16,cursor:"pointer",fontWeight:700,color:"#1C1C1E"}}>−</button>
                    <span style={{fontSize:12,color:"#6D6D72",fontWeight:600}}>{Math.round(zoom*100)}%</span>
                    <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"5px 14px",fontSize:16,cursor:"pointer",fontWeight:700,color:"#1C1C1E"}}>+</button>
                    <button onClick={()=>setZoom(1)} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:"#6D6D72",fontWeight:600}}>Reset</button>
                  </div>
                  <div style={{overflow:"auto",maxHeight:560,borderRadius:10,cursor:zoom>1?"grab":"default"}}>
                    {previews[activePreview]==="pdf"
                      ?<div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:44,marginBottom:8}}>📄</div><div style={{fontSize:13,color:"#AEAEB2"}}>{files[activePreview]?.name}</div></div>
                      :<img src={previews[activePreview]} alt="Flyer" style={{width:`${zoom*100}%`,minWidth:`${zoom*100}%`,borderRadius:10,display:"block",transition:"width 0.2s"}}/>
                    }
                  </div>
                </div>
                <div style={{padding:"8px 16px",background:"#F9F9F9",fontSize:11,color:"#AEAEB2",textAlign:"center"}}>
                  Tap items to edit while referencing the flyer
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: STORE ── */}
        {step==="store"&&(
          <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Store & Location</div>
            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:8}}>SELECT STORE</div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:20}}>
              {brands.map(b=>(
                <div key={b.id} onClick={()=>{setSelectedBrand(b);setSelectedLocs([]);fetchLocations(b.id);}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:selectedBrand?.id===b.id?"rgba(255,159,10,0.06)":"#F9F9F9",borderRadius:12,cursor:"pointer",border:selectedBrand?.id===b.id?"1.5px solid rgba(255,159,10,0.4)":"1.5px solid transparent",transition:"all 0.15s"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,159,10,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏪</div>
                  <div style={{flex:1,fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{b.name}</div>
                  {selectedBrand?.id===b.id&&<div style={{width:22,height:22,borderRadius:"50%",background:"#FF9F0A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>✓</div>}
                </div>
              ))}
            </div>
            {selectedBrand&&(
              <>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:8}}>VALID AT</div>
                <div style={{display:"flex",background:"#F2F2F7",borderRadius:12,padding:3,gap:3,marginBottom:16}}>
                  {([["all","🌐 All Branches"],["specific","📍 Specific Branches"]] as const).map(([m,l])=>(
                    <button key={m} onClick={()=>setLocationMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:locationMode===m?"#fff":"transparent",color:locationMode===m?"#1C1C1E":"#AEAEB2",boxShadow:locationMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{l}</button>
                  ))}
                </div>
                {locationMode==="specific"&&locations.length>0&&(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
                    {locations.map(loc=>(
                      <div key={loc.id} onClick={()=>setSelectedLocs(prev=>prev.includes(loc.id)?prev.filter(id=>id!==loc.id):[...prev,loc.id])}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:selectedLocs.includes(loc.id)?"rgba(255,159,10,0.06)":"#F9F9F9",borderRadius:12,cursor:"pointer",border:selectedLocs.includes(loc.id)?"1.5px solid rgba(255,159,10,0.4)":"1.5px solid transparent"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{loc.branch_name}</div>
                          <div style={{fontSize:12,color:"#6D6D72"}}>{loc.city} · {loc.zip}</div>
                        </div>
                        <div style={{width:22,height:22,borderRadius:"50%",background:selectedLocs.includes(loc.id)?"#FF9F0A":"#E5E5EA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>
                          {selectedLocs.includes(loc.id)?"✓":""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {locationMode==="specific"&&locations.length===0&&<div style={{fontSize:13,color:"#AEAEB2",textAlign:"center",padding:"16px 0",marginBottom:16}}>No branches found for this store</div>}
              </>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:6}}>SALE STARTS</div>
                <input type="date" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={saleStart} onChange={e=>setSaleStart(e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:6}}>SALE ENDS</div>
                <input type="date" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={saleEnd} onChange={e=>setSaleEnd(e.target.value)}/>
              </div>
            </div>
            <button onClick={()=>setStep("confirm")} disabled={!selectedBrand||(locationMode==="specific"&&selectedLocs.length===0)}
              style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:!selectedBrand?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
              Continue → Review & Publish
            </button>
          </div>
        )}

        {/* ── STEP 4: CONFIRM ── */}
        {step==="confirm"&&(
          <div>
            <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Confirm Deal</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:0}}>
                {[
                  {l:"Store",v:selectedBrand?.name},
                  {l:"Valid at",v:locationMode==="all"?"All Branches":`${selectedLocs.length} branch${selectedLocs.length>1?"es":""}`},
                  {l:"Sale Period",v:`${saleStart}${saleEnd?` → ${saleEnd}`:" (no end date)"}`},
                  {l:"Total Items",v:`${items.length} deals`},
                  {l:"Avg Confidence",v:`${avgConfidence}%`},
                  {l:"Source",v:uploadMode==="image"?`📄 Flyer (${files.length} file${files.length>1?"s":""})`:"🔗 URL"},
                ].map((r,i,arr)=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:i<arr.length-1?"0.5px solid #F2F2F7":"none"}}>
                    <span style={{fontSize:13,color:"#6D6D72"}}>{r.l}</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:16}}>
              <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7",fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Items ({items.length})</div>
              <div style={{maxHeight:300,overflowY:"auto"}}>
                {items.map((item,i)=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<items.length-1?"0.5px solid #F2F2F7":"none"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"#AEAEB2"}}>{item.category} · {item.unit}</div>
                    </div>
                    <ConfidenceBadge score={item.confidence}/>
                    <div style={{textAlign:"right" as const,flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#FF9F0A"}}>${item.price.toFixed(2)}</div>
                      {item.regular_price&&<div style={{fontSize:10,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep("store")} style={{flex:1,padding:14,background:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Edit</button>
              <button onClick={publish} disabled={publishing}
                style={{flex:2,padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:publishing?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                {publishing?"Publishing...":"🚀 Publish Live"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
