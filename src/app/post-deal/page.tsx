"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

const CATS = ["Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Household","Other"];
const UNITS = ["bag","lb","oz","kg","ea","pack","box","bottle","jar","bunch","dozen","gallon","liter"];
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
}

interface Brand { id: string; name: string; slug: string; }
interface Location { id: string; branch_name: string; city: string; zip: string; }

export default function PostDealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [uploadMode, setUploadMode] = useState<"image"|"url">("image");
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
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

  function toB64(f:File):Promise<string> {
    return new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r((rd.result as string).split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  }

  async function extract() {
    if(uploadMode==="image"&&!file){toast.error("Select a file");return;}
    if(uploadMode==="url"&&!url.trim()){toast.error("Enter URL");return;}
    setExtracting(true);
    try{
      const body:any={store:selectedBrand?.name||"Unknown Store"};
      if(uploadMode==="image"&&file){body.b64=await toB64(file);body.mime=file.type;}
      else{body.url=url;}
      const res=await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();
      if(data.error)throw new Error(data.error);
      const extracted=(data.items||[]).map((i:any,idx:number)=>({
        id:`item-${idx}`,
        name:i.name||"",
        normalized_name:i.normalized_name||(i.name||"").toLowerCase(),
        price:parseFloat(i.price)||0,
        regular_price:i.regular_price?parseFloat(i.regular_price):null,
        unit:i.unit||"ea",
        category:i.category||"Other",
        notes:i.notes||"",
      }));
      if(extracted.length===0){toast.error("No items found — try another image");return;}
      setItems(extracted);
      setStep("review");
      toast.success(`✦ ${extracted.length} items extracted!`);
    }catch(e:any){toast.error(e.message);}
    setExtracting(false);
  }

  function updateItem(id:string, field:string, value:any) {
    setItems(prev=>prev.map(i=>i.id===id?{...i,[field]:value,normalized_name:field==="name"?value.toLowerCase():i.normalized_name}:i));
  }

  function deleteItem(id:string) {
    setItems(prev=>prev.filter(i=>i.id!==id));
    toast.success("Item removed");
  }

  function addItem() {
    const newItem:DealItem={id:`item-${Date.now()}`,name:"",normalized_name:"",price:0,regular_price:null,unit:"ea",category:"Other",notes:""};
    setItems(prev=>[...prev,newItem]);
    setEditingId(newItem.id);
  }

  async function publish() {
    if(!selectedBrand){toast.error("Select a store");return;}
    if(items.length===0){toast.error("No items to publish");return;}
    if(items.some(i=>!i.name.trim())){toast.error("All items need a name");return;}
    if(items.some(i=>i.price<=0)){toast.error("All items need a valid price");return;}
    setPublishing(true);
    try{
      // Create deal
      const dealData:any={
        brand_id:selectedBrand.id,
        status:"approved",
        applies_to_all_locations:locationMode==="all",
        sale_start:saleStart,
        sale_end:saleEnd||null,
      };
      const{data:deal,error:de}=await supabase.from("deals").insert(dealData).select("id").single();
      if(de||!deal?.id)throw new Error(de?.message||"Failed to create deal");

      // Link specific locations
      if(locationMode==="specific"&&selectedLocs.length>0){
        await supabase.from("deal_locations").insert(selectedLocs.map(lid=>({deal_id:deal.id,location_id:lid})));
      }

      // Insert items
      const{error:ie}=await supabase.from("deal_items").insert(items.map(i=>({
        deal_id:deal.id,
        name:i.name.trim(),
        normalized_name:i.normalized_name||i.name.toLowerCase().trim(),
        price:i.price,
        regular_price:i.regular_price||null,
        unit:i.unit,
        category:i.category,
        notes:i.notes||null,
        source:uploadMode==="image"?"flyer":"manual",
      })));
      if(ie)throw new Error(ie.message);

      toast.success(`🚀 ${items.length} deals published!`);
      router.push("/deals");
    }catch(e:any){toast.error(e.message);}
    setPublishing(false);
  }

  const progress=step==="upload"?1:step==="review"?2:step==="store"?3:4;

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7"}} className="page-body">
      <Navbar />
      <div className="container" style={{maxWidth:640}}>

        {/* Header */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <button onClick={()=>router.push("/deals")} style={{background:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Back</button>
            <h1 style={{fontSize:20,fontWeight:700,color:"#1C1C1E",letterSpacing:-0.5}}>Post a Deal</h1>
          </div>
          {/* Progress */}
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
            <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Upload Flyer or Paste URL</div>

            {/* Mode toggle */}
            <div style={{display:"flex",background:"#F2F2F7",borderRadius:12,padding:3,gap:3,marginBottom:16}}>
              {(["image","url"] as const).map(m=>(
                <button key={m} onClick={()=>setUploadMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:uploadMode===m?"#fff":"transparent",color:uploadMode===m?"#1C1C1E":"#AEAEB2",boxShadow:uploadMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                  {m==="image"?"📷 Upload Flyer":"🔗 Paste URL"}
                </button>
              ))}
            </div>

            {uploadMode==="image"&&(
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} style={{display:"none"}}/>
                <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}}
                  style={{border:`2px dashed ${file?"#FF9F0A":"#E5E5EA"}`,borderRadius:14,padding:"28px 20px",textAlign:"center",cursor:"pointer",marginBottom:16,background:"#F9F9F9",transition:"border-color 0.2s"}}>
                  {preview
                    ?<img src={preview} alt="" style={{maxHeight:160,borderRadius:10,objectFit:"contain",margin:"0 auto"}}/>
                    :<><div style={{fontSize:36,marginBottom:8}}>📷</div><div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",marginBottom:4}}>Drop flyer here or tap to upload</div><div style={{fontSize:12,color:"#AEAEB2"}}>JPG · PNG · PDF supported</div></>
                  }
                </div>
                {file&&<div style={{fontSize:12,color:"#30D158",textAlign:"center",marginBottom:16,fontWeight:600}}>✓ {file.name}</div>}
              </>
            )}
            {uploadMode==="url"&&(
              <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:12,padding:"13px 16px",fontSize:14,color:"#1C1C1E",outline:"none",marginBottom:16}} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/weekly-deals"/>
            )}

            <button onClick={extract} disabled={extracting||(uploadMode==="image"&&!file)||(uploadMode==="url"&&!url.trim())}
              style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:extracting?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
              {extracting?"🤖 Extracting items...":"🤖 Extract with AI"}
            </button>
          </div>
        )}

        {/* ── STEP 2: REVIEW & EDIT ── */}
        {step==="review"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E"}}>{items.length} items extracted</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setStep("upload")} style={{background:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:"#6D6D72",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>← Re-upload</button>
                <button onClick={addItem} style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:"#30D158",cursor:"pointer"}}>+ Add Item</button>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginBottom:16}}>
              {items.map(item=>(
                <div key={item.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  {/* Collapsed view */}
                  {editingId!==item.id?(
                    <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name||<span style={{color:"#AEAEB2"}}>Unnamed item</span>}</div>
                        <div style={{fontSize:12,color:"#6D6D72",marginTop:2}}>{item.category} · {item.unit}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:"#FF9F0A"}}>${item.price.toFixed(2)}</div>
                        {item.regular_price&&<div style={{fontSize:11,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                      </div>
                      <button onClick={()=>setEditingId(item.id)} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#1C1C1E",cursor:"pointer",flexShrink:0}}>✏️ Edit</button>
                      <button onClick={()=>deleteItem(item.id)} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#FF3B30",cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  ):(
                    /* Expanded edit view */
                    <div style={{padding:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Edit Item</div>
                        <button onClick={()=>setEditingId(null)} style={{background:"#FF9F0A",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>ITEM NAME</div>
                          <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="e.g. Toor Dal 4lb"/>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>PRICE</div>
                            <input type="number" step="0.01" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={item.price||""} onChange={e=>updateItem(item.id,"price",parseFloat(e.target.value)||0)} placeholder="4.99"/>
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:4}}>WAS</div>
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

            <button onClick={()=>setStep("store")} disabled={items.length===0}
              style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
              Continue → Select Store
            </button>
          </div>
        )}

        {/* ── STEP 3: STORE & LOCATION ── */}
        {step==="store"&&(
          <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Store & Location</div>

            {/* Store selector */}
            <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:8}}>SELECT STORE</div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:20}}>
              {brands.map(b=>(
                <div key={b.id} onClick={()=>{setSelectedBrand(b);setSelectedLocs([]);fetchLocations(b.id);}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:selectedBrand?.id===b.id?"rgba(255,159,10,0.06)":"#F9F9F9",borderRadius:12,cursor:"pointer",border:selectedBrand?.id===b.id?"1.5px solid rgba(255,159,10,0.4)":"1.5px solid transparent",transition:"all 0.15s"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,159,10,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏪</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{b.name}</div>
                  </div>
                  {selectedBrand?.id===b.id&&<div style={{width:22,height:22,borderRadius:"50%",background:"#FF9F0A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>✓</div>}
                </div>
              ))}
            </div>

            {/* Location mode */}
            {selectedBrand&&(
              <>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:8}}>VALID AT</div>
                <div style={{display:"flex",background:"#F2F2F7",borderRadius:12,padding:3,gap:3,marginBottom:16}}>
                  {([["all","🌐 All Branches"],["specific","📍 Specific Branches"]] as const).map(([m,l])=>(
                    <button key={m} onClick={()=>setLocationMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:locationMode===m?"#fff":"transparent",color:locationMode===m?"#1C1C1E":"#AEAEB2",boxShadow:locationMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                      {l}
                    </button>
                  ))}
                </div>

                {locationMode==="specific"&&locations.length>0&&(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
                    {locations.map(loc=>(
                      <div key={loc.id} onClick={()=>setSelectedLocs(prev=>prev.includes(loc.id)?prev.filter(id=>id!==loc.id):[...prev,loc.id])}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:selectedLocs.includes(loc.id)?"rgba(255,159,10,0.06)":"#F9F9F9",borderRadius:12,cursor:"pointer",border:selectedLocs.includes(loc.id)?"1.5px solid rgba(255,159,10,0.4)":"1.5px solid transparent",transition:"all 0.15s"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#1C1C1E"}}>{loc.branch_name}</div>
                          <div style={{fontSize:12,color:"#6D6D72"}}>{loc.city} · {loc.zip}</div>
                        </div>
                        <div style={{width:22,height:22,borderRadius:"50%",background:selectedLocs.includes(loc.id)?"#FF9F0A":"#E5E5EA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700,transition:"all 0.15s"}}>
                          {selectedLocs.includes(loc.id)?"✓":""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Dates */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:6}}>SALE STARTS</div>
                <input type="date" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={saleStart} onChange={e=>setSaleStart(e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",marginBottom:6}}>SALE ENDS</div>
                <input type="date" style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"11px 12px",fontSize:14,color:"#1C1C1E",outline:"none"}} value={saleEnd} onChange={e=>setSaleEnd(e.target.value)} placeholder="Optional"/>
              </div>
            </div>

            <button onClick={()=>setStep("confirm")} disabled={!selectedBrand||(locationMode==="specific"&&selectedLocs.length===0)}
              style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:!selectedBrand?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
              Continue → Review & Publish
            </button>
          </div>
        )}

        {/* ── STEP 4: CONFIRM & PUBLISH ── */}
        {step==="confirm"&&(
          <div>
            <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:600,color:"#1C1C1E",marginBottom:16}}>Confirm Deal</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid #F2F2F7"}}>
                  <span style={{fontSize:13,color:"#6D6D72"}}>Store</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{selectedBrand?.name}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid #F2F2F7"}}>
                  <span style={{fontSize:13,color:"#6D6D72"}}>Valid at</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{locationMode==="all"?"All Branches":`${selectedLocs.length} branch${selectedLocs.length>1?"es":""}`}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid #F2F2F7"}}>
                  <span style={{fontSize:13,color:"#6D6D72"}}>Sale Period</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#1C1C1E"}}>{saleStart}{saleEnd?` → ${saleEnd}`:" (no end date)"}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0"}}>
                  <span style={{fontSize:13,color:"#6D6D72"}}>Total Items</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#FF9F0A"}}>{items.length} deals</span>
                </div>
              </div>
            </div>

            {/* Items summary */}
            <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:16}}>
              <div style={{padding:"12px 16px",borderBottom:"0.5px solid #F2F2F7",fontSize:13,fontWeight:600,color:"#1C1C1E"}}>Items to Publish</div>
              {items.map((item,i)=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:i<items.length-1?"0.5px solid #F2F2F7":"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#1C1C1E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#AEAEB2"}}>{item.category} · {item.unit}</div>
                  </div>
                  <div style={{textAlign:"right" as const,flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#FF9F0A"}}>${item.price.toFixed(2)}</div>
                    {item.regular_price&&<div style={{fontSize:10,color:"#AEAEB2",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                  </div>
                </div>
              ))}
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
