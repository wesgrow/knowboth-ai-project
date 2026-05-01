"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseAuth, timedRetry } from "@/lib/supabase";
import { BottomSheet } from "@/ui";
import toast from "react-hot-toast";

const CATS = ["Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household","Other"];
const UNITS = ["bag","lb","oz","kg","ea","pack","box","bottle","jar","bunch","dozen","gallon","liter","2 for","3 for","4 for","5 for","6 for","7 for","10 for"];
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
  confidence: number;
}

interface Brand { id: string; name: string; slug: string; website?: string; phone?: string; }
interface Location { id: string; branch_name: string; address?: string; city: string; state?: string; zip: string; phone?: string; lat?: number; lng?: number; map_link?: string; }
interface ExtractedLoc { address?: string; city: string; state?: string; zip?: string; phone?: string; }

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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
  const [saleStart, setSaleStart] = useState(localDate);
  const [saleEnd, setSaleEnd] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [showFlyer, setShowFlyer] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandWebsite, setNewBrandWebsite] = useState("");
  const [newBrandPhone, setNewBrandPhone] = useState("");
  const [addingBrand, setAddingBrand] = useState(false);
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
  const [extractedStoreName, setExtractedStoreName] = useState<string>("");
  const [pendingExtractedLocs, setPendingExtractedLocs] = useState<ExtractedLoc[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ fetchBrands(); },[]);
  useEffect(()=>{
    if(step==="store" && extractedStoreName && !selectedBrand) setShowAddBrand(true);
  },[step]);

  async function fetchBrands() {
    const{data}=await supabase.from("brands").select("id,name,slug").order("name");
    setBrands(data||[]);
  }

  async function fetchLocations(brandId:string): Promise<Location[]> {
    const{data}=await supabase.from("store_locations").select("id,branch_name,address,city,state,zip,phone,lat,lng,map_link").eq("brand_id",brandId).order("city");
    const locs = data||[];
    setLocations(locs);
    return locs;
  }

  function norm(s:string){ return s.toLowerCase().replace(/[^a-z0-9]/g,""); }

  async function autoCreateLocations(brandId: string, brandName: string, locs: ExtractedLoc[]): Promise<string[]> {
    const ids: string[] = [];
    for (const loc of locs) {
      const city = loc.city.trim();
      if (!city) continue;
      const payload: any = { brand_id: brandId, branch_name: `${brandName} - ${city}`, city };
      if (loc.address?.trim()) payload.address = loc.address.trim();
      if (loc.state?.trim()) payload.state = loc.state.trim();
      if (loc.zip?.trim()) payload.zip = loc.zip.trim();
      if (loc.phone?.trim()) payload.phone = loc.phone.trim();
      const { data } = await supabase.from("store_locations").insert(payload).select("id").single();
      if (data) ids.push(data.id);
    }
    return ids;
  }

  async function matchAndApplyLocations(brandId: string, brandName: string, extracted: ExtractedLoc[], dbLocs: Location[]) {
    const matchedIds: string[] = [];
    const toCreate: ExtractedLoc[] = [];
    for (const el of extracted) {
      const hit = dbLocs.find(dl =>
        (el.zip && dl.zip && el.zip.replace(/\D/g,"") === dl.zip.replace(/\D/g,"")) ||
        (el.city && dl.city && norm(el.city) === norm(dl.city))
      );
      if (hit) matchedIds.push(hit.id);
      else toCreate.push(el);
    }
    if (toCreate.length > 0) {
      const newIds = await autoCreateLocations(brandId, brandName, toCreate);
      matchedIds.push(...newIds);
      await fetchLocations(brandId);
      toast.success(`${toCreate.length} branch${toCreate.length>1?"es":""} auto-added`);
    }
    if (matchedIds.length > 0) { setLocationMode("specific"); setSelectedLocs(matchedIds); }
    setPendingExtractedLocs([]);
  }

  async function autoMatchStore(storeName: string, storedLocs: ExtractedLoc[]) {
    if (!storeName.trim()) return;
    console.log("[PostDeal] autoMatchStore:", { storeName, extractedLocs: storedLocs, availableBrands: brands.map(b=>b.name) });
    const match = brands.find(b => {
      const nb = norm(b.name), ns = norm(storeName);
      return nb === ns || nb.includes(ns) || ns.includes(nb);
    });
    if (match) {
      console.log("[PostDeal] autoMatchStore: matched brand", match);
      setSelectedBrand(match);
      const dbLocs = await fetchLocations(match.id);
      if (storedLocs.length > 0) await matchAndApplyLocations(match.id, match.name, storedLocs, dbLocs);
    } else {
      console.log("[PostDeal] autoMatchStore: no match found — showing Add Store sheet");
      setNewBrandName(storeName);
      if (storedLocs.length > 0) setPendingExtractedLocs(storedLocs);
    }
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
    try {
      const slug = toSlug(name);
      const { data, error } = await timedRetry(() =>
        supabase.from("brands").insert({ name, slug }).select("id,name,slug").maybeSingle()
      );
      if (error) {
        if (error.code === "23505") toast.error("A store with that name already exists");
        else toast.error(`Could not create store: ${error.message}`);
        return;
      }
      if (!data) { toast.error("Store creation failed — check permissions"); return; }

      setSelectedBrand(data);
      setNewBrandName(""); setNewBrandWebsite(""); setNewBrandPhone("");
      setShowAddBrand(false);
      toast.success(`✦ ${name} added`);

      fetchBrands();
      if (pendingExtractedLocs.length > 0) {
        matchAndApplyLocations(data.id, data.name, pendingExtractedLocs, []).catch(console.error);
      } else {
        fetchLocations(data.id);
      }
    } catch(e: any) {
      toast.error(e.message || "Failed to add store");
    } finally {
      setAddingBrand(false);
    }
  }

  async function createLocation() {
    if (!selectedBrand) return;
    const city = newLocCity.trim();
    if (!city) { toast.error("Enter city"); return; }
    setAddingLoc(true);
    const branch_name = newLocBranch.trim() || `${selectedBrand.name} - ${city}`;
    const locPayload: any = { brand_id:selectedBrand.id, branch_name, city };
    if (newLocAddress.trim()) locPayload.address = newLocAddress.trim();
    if (newLocState.trim()) locPayload.state = newLocState.trim();
    if (newLocZip.trim()) locPayload.zip = newLocZip.trim();
    if (newLocPhone.trim()) locPayload.phone = newLocPhone.trim();
    if (newLocLat != null) locPayload.lat = newLocLat;
    if (newLocLng != null) locPayload.lng = newLocLng;
    if (newLocMapLink) locPayload.map_link = newLocMapLink;
    try {
      const { error } = await timedRetry(() =>
        supabase.from("store_locations").insert(locPayload)
      );
      if (error) { toast.error(`Could not add location: ${error.message}`); return; }
      fetchLocations(selectedBrand.id);
      setNewLocBranch(""); setNewLocAddress(""); setNewLocCity(""); setNewLocState(""); setNewLocZip(""); setNewLocPhone(""); setNewLocLat(null); setNewLocLng(null); setNewLocMapLink(""); setShowAddLoc(false);
      toast.success("Location added");
    } catch(e:any) {
      toast.error(e.message||"Failed to add location");
    } finally {
      setAddingLoc(false);
    }
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

  function computeConfidence(item:any): number {
    let score = 100;
    if(!item.name||item.name.length<2) score -= 40;
    if(!item.price||item.price<=0) score -= 30;
    if(!item.unit||item.unit==="ea") score -= 5;
    if(!item.regular_price) score -= 5;
    if(!item.category||item.category==="Other") score -= 10;
    if(item.price>100) score -= 20;
    if(item.name&&item.name.length>60) score -= 10;
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
          const body = { store:selectedBrand?.name||"", b64, mime:files[i].type };
          console.log(`[PostDeal] extract: sending file ${i+1}/${files.length}`, { mime: files[i].type, size: files[i].size });
          const res = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
          const data = await res.json();
          console.log(`[PostDeal] extract: API response file ${i+1}`, { status: res.status, store_name: data.store_name, items_count: data.items?.length, sale_start: data.sale_start, sale_end: data.sale_end, error: data.error, store_locations: data.store_locations });
          if(data.error) { toast.error(`File ${i+1}: ${data.error}`); continue; }
          if(i===0) {
            if(data.store_name) { setExtractedStoreName(data.store_name); await autoMatchStore(data.store_name, data.store_locations||[]); }
            if(data.sale_start) setSaleStart(data.sale_start);
            if(data.sale_end)   setSaleEnd(data.sale_end);
          }
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
        const body = { store:selectedBrand?.name||"", url };
        console.log("[PostDeal] extract: sending URL", { url });
        const res = await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
        const data = await res.json();
        console.log("[PostDeal] extract: API response URL", { status: res.status, store_name: data.store_name, items_count: data.items?.length, error: data.error });
        if(data.error) throw new Error(data.error);
        if(data.store_name) { setExtractedStoreName(data.store_name); await autoMatchStore(data.store_name, data.store_locations||[]); }
        if(data.sale_start) setSaleStart(data.sale_start);
        if(data.sale_end)   setSaleEnd(data.sale_end);
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

  const normalizeStr=(s:string)=>s.toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"");

  async function doPublish(itemsToPublish: DealItem[]) {
    if(!selectedBrand||itemsToPublish.length===0) throw new Error("Nothing to publish");

    const{data:{session}}=await supabaseAuth.auth.getSession();
    if(!session?.user?.id) throw new Error("You must be signed in to post deals");

    const locIds: (string|null)[] = locationMode==="specific"&&selectedLocs.length>0
      ? selectedLocs
      : [null];

    const itemRows = itemsToPublish.map(i=>({
      name:i.name.trim(),
      normalized_name:normalizeStr(i.normalized_name||i.name),
      price:i.price, regular_price:i.regular_price||null, unit:i.unit,
      category:VALID_CATS.includes(i.category)?i.category:"Other",
      notes:i.notes||null, source:uploadMode==="image"?"flyer":"manual",
    }));

    await Promise.all(locIds.map(async(locId)=>{
      // Find existing deal for this brand+date+location, or create one
      const{data:existing}=await timedRetry(()=>{
        const q=supabase.from("deals").select("id")
          .eq("brand_id",selectedBrand!.id)
          .eq("sale_start",saleStart)
          .eq("applies_to_all_locations",locationMode==="all");
        return locId?(q as any).eq("location_id",locId).limit(1):(q as any).is("location_id",null).limit(1);
      }) as {data:{id:string}[]|null};

      let dealId: string;
      if(existing&&existing.length>0){
        dealId=existing[0].id;
      } else {
        const dealPayload:any={
          brand_id:selectedBrand!.id, posted_by:session.user.id, status:"approved",
          applies_to_all_locations:locationMode==="all",
          sale_start:saleStart, sale_end:saleEnd||null,
        };
        if(locId) dealPayload.location_id=locId;
        const{data:deal,error:de}=await timedRetry(()=>
          supabase.from("deals").insert(dealPayload).select("id").single()
        );
        if(de||!deal?.id) throw new Error(de?.message||"Failed to create deal");
        dealId=deal.id;
      }

      // Upsert items — existing (deal_id + normalized_name) are silently skipped
      const{error:ie}=await timedRetry(()=>
        supabase.from("deal_items")
          .upsert(itemRows.map(r=>({...r,deal_id:dealId})),{onConflict:"deal_id,normalized_name",ignoreDuplicates:true})
      );
      if(ie) throw new Error(ie.message);
    }));

    const branchMsg = locIds.length>1?` across ${locIds.length} branches`:"";
    toast.success(`🚀 ${itemsToPublish.length} deal${itemsToPublish.length>1?"s":""} published${branchMsg}!`);
    router.push("/deals");
  }

  async function publish() {
    if(!selectedBrand){toast.error("Select a store");return;}
    if(items.length===0){toast.error("No items to publish");return;}
    const noName=items.filter(i=>!i.name.trim());
    if(noName.length>0){toast.error(`${noName.length} items missing name`);setEditingId(noName[0].id);setStep("review");return;}
    const noPrice=items.filter(i=>i.price<=0);
    if(noPrice.length>0){toast.error(`${noPrice.length} items have $0 price`);setEditingId(noPrice[0].id);setStep("review");return;}
    setPublishing(true);
    let connectingToast: string|undefined;
    const connectingTimer = setTimeout(()=>{ connectingToast=toast.loading("Connecting to server...",{duration:300000}); },4000);
    try{
      await doPublish(items);
    }catch(e:any){
      toast.error(e.message||"Failed to publish.");
    }finally{
      clearTimeout(connectingTimer);
      if(connectingToast) toast.dismiss(connectingToast);
      setPublishing(false);
    }
  }

  const zeroPriceCount = items.filter(i=>i.price<=0).length;
  const lowConfCount = items.filter(i=>i.confidence<60).length;
  const noNameCount = items.filter(i=>!i.name.trim()).length;
  const highPriceCount = items.filter(i=>i.price>50).length;
  const avgConfidence = items.length>0 ? Math.round(items.reduce((s,i)=>s+i.confidence,0)/items.length) : 0;
  const progress=step==="upload"?1:step==="review"?2:step==="store"?3:4;

  return(
    <>
      <div style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{padding:"20px 24px",maxWidth:1200,width:"100%"}}>
          <div className="container" style={{maxWidth:step==="review"?1100:640}}>

            {/* Header */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <button onClick={()=>router.push("/deals")} style={{background:"var(--surf)",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>← Back</button>
                <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>Post a Deal</h1>
                {step==="review"&&<div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:avgConfidence>=80?"#30D158":avgConfidence>=60?"#FF9F0A":"#FF3B30"}}>Avg Confidence: {avgConfidence}%</div>}
              </div>
              <div style={{display:"flex",gap:0,background:"var(--surf)",borderRadius:12,padding:3,boxShadow:"var(--shadow)"}}>
                {["Upload","Review","Store","Publish"].map((s,i)=>(
                  <div key={s} style={{flex:1,padding:"8px 4px",borderRadius:10,textAlign:"center" as const,fontSize:12,fontWeight:600,background:progress===i+1?"#FF9F0A":progress>i+1?"rgba(48,209,88,0.1)":"transparent",color:progress===i+1?"#fff":progress>i+1?"#30D158":"var(--text3)",transition:"all 0.2s"}}>
                    {progress>i+1?"✓ ":""}{s}
                  </div>
                ))}
              </div>
            </div>

            {/* ── STEP 1: UPLOAD ── */}
            {step==="upload"&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:20,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:16}}>Upload Flyers or Paste URL</div>
                <div style={{display:"flex",background:"var(--bg)",borderRadius:12,padding:3,gap:3,marginBottom:16}}>
                  {(["image","url"] as const).map(m=>(
                    <button key={m} onClick={()=>setUploadMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:uploadMode===m?"var(--surf)":"transparent",color:uploadMode===m?"var(--text)":"var(--text3)",boxShadow:uploadMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                      {m==="image"?"📷 Upload Flyers":"🔗 Paste URL"}
                    </button>
                  ))}
                </div>
                {uploadMode==="image"&&(
                  <>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={e=>handleFiles(e.target.files)} style={{display:"none"}}/>
                    <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}}
                      style={{border:`2px dashed ${files.length>0?"#FF9F0A":"var(--border)"}`,borderRadius:14,padding:"24px 20px",textAlign:"center",cursor:"pointer",marginBottom:12,background:"var(--bg3)"}}>
                      <div style={{fontSize:32,marginBottom:8}}>📷</div>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:4}}>{files.length>0?`${files.length} file${files.length>1?"s":""} selected — tap to add more`:"Drop flyers here or tap to upload"}</div>
                      <div style={{fontSize:12,color:"var(--text3)"}}>JPG · PNG · PDF · Multiple files supported</div>
                    </div>
                    {files.length>0&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8,marginBottom:16}}>
                        {files.map((f,i)=>(
                          <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)",aspectRatio:"1",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {previews[i]!=="pdf"?<img src={previews[i]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{textAlign:"center"}}><div style={{fontSize:22}}>📄</div><div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>{f.name.slice(0,12)}</div></div>}
                            <button onClick={e=>{e.stopPropagation();removeFile(i);}} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"rgba(255,59,48,0.9)",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {uploadMode==="url"&&(
                  <input style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:12,padding:"13px 16px",fontSize:16,color:"var(--text)",outline:"none",marginBottom:16}} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://store.com/weekly-deals"/>
                )}
                {extracting&&<div style={{background:"rgba(255,159,10,0.08)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#FF9F0A",fontWeight:500,textAlign:"center"}}>{extractProgress}</div>}
                <button onClick={extract} disabled={extracting||(uploadMode==="image"&&files.length===0)||(uploadMode==="url"&&!url.trim())}
                  style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:extracting?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                  {extracting?`🤖 ${extractProgress}`:`🤖 Extract from ${files.length>0?`${files.length} file${files.length>1?"s":""}`:"Flyer"}`}
                </button>
              </div>
            )}

            {/* ── STEP 2: REVIEW ── */}
            {step==="review"&&(
              <div style={{display:"grid",gridTemplateColumns:showFlyer&&previews.length>0?"1fr 420px":"1fr",gap:16,alignItems:"start"}}>

                {/* LEFT — Items list */}
                <div>
                  <div style={{marginBottom:12}}>
                    {noNameCount>0&&<Alert type="error" message={`${noNameCount} item${noNameCount>1?"s":""} missing name — must fix before publishing`}/>}
                    {zeroPriceCount>0&&<Alert type="error" message={`${zeroPriceCount} item${zeroPriceCount>1?"s":""} have $0 price — must fix before publishing`}/>}
                    {lowConfCount>0&&<Alert type="warning" message={`${lowConfCount} item${lowConfCount>1?"s":""} have low confidence — please verify`}/>}
                    {highPriceCount>0&&<Alert type="warning" message={`${highPriceCount} item${highPriceCount>1?"s":""} have price >$50 — please verify`}/>}
                    {zeroPriceCount===0&&noNameCount===0&&lowConfCount===0&&<Alert type="info" message="All items look good! Ready to publish."/>}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <span style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{items.length} items</span>
                      <span style={{fontSize:12,color:"var(--text3)",marginLeft:8}}>Avg confidence: {avgConfidence}%</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {previews.length>0&&<button onClick={()=>setShowFlyer(!showFlyer)} style={{background:"var(--surf)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>
                        {showFlyer?"Hide Flyer":"Show Flyer"}
                      </button>}
                      <button onClick={()=>setStep("upload")} style={{background:"var(--surf)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>← Re-upload</button>
                      <button onClick={addItem} style={{background:"rgba(48,209,88,0.1)",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#30D158",cursor:"pointer"}}>+ Add</button>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
                    {items.map(item=>(
                      <div key={item.id} style={{background:"var(--surf)",borderRadius:14,overflow:"hidden",boxShadow:"var(--shadow)",border:item.confidence<60?"1px solid rgba(255,59,48,0.2)":item.price<=0?"1px solid rgba(255,59,48,0.3)":"1px solid transparent"}}>
                        {editingId!==item.id?(
                          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                                <span style={{fontSize:14,fontWeight:600,color:item.name?"var(--text)":"#FF3B30"}}>{item.name||"⚠️ Missing name"}</span>
                                <ConfidenceBadge score={item.confidence}/>
                                {item.price<=0&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,59,48,0.1)",color:"#FF3B30",borderRadius:20,padding:"2px 7px"}}>⚠️ No price</span>}
                                {item.price>50&&<span style={{fontSize:9,fontWeight:700,background:"rgba(255,159,10,0.1)",color:"#FF9F0A",borderRadius:20,padding:"2px 7px"}}>💡 High price</span>}
                              </div>
                              <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>{item.category} · {item.unit}</div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:16,fontWeight:700,color:item.price>0?"#FF9F0A":"#FF3B30"}}>{item.price>0?`$${item.price.toFixed(2)}`:"$0.00"}</div>
                              {item.regular_price&&<div style={{fontSize:10,color:"var(--text3)",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                            </div>
                            <button onClick={()=>setEditingId(item.id)} style={{background:"var(--bg)",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:600,color:"var(--text)",cursor:"pointer",flexShrink:0}}>✏️</button>
                            <button onClick={()=>deleteItem(item.id)} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"6px 8px",fontSize:12,color:"#FF3B30",cursor:"pointer",flexShrink:0}}>✕</button>
                          </div>
                        ):(
                          <div style={{padding:16}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Edit Item</span>
                                <ConfidenceBadge score={item.confidence}/>
                              </div>
                              <button onClick={()=>setEditingId(null)} style={{background:"#FF9F0A",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Done ✓</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>ITEM NAME {!item.name&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                                <input style={{width:"100%",background:!item.name?"rgba(255,59,48,0.05)":"var(--bg)",border:!item.name?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={item.name} onChange={e=>updateItem(item.id,"name",e.target.value)} placeholder="e.g. Toor Dal 4lb *"/>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>PRICE ($) {item.price<=0&&<span style={{color:"#FF3B30"}}>*required</span>}</div>
                                  <input type="number" step="0.01" style={{width:"100%",background:item.price<=0?"rgba(255,59,48,0.05)":"var(--bg)",border:item.price<=0?"1px solid rgba(255,59,48,0.3)":"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={item.price||""} onChange={e=>updateItem(item.id,"price",parseFloat(e.target.value)||0)} placeholder="4.99"/>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>WAS ($)</div>
                                  <input type="number" step="0.01" style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={item.regular_price||""} onChange={e=>updateItem(item.id,"regular_price",parseFloat(e.target.value)||null)} placeholder="6.99"/>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>UNIT</div>
                                  <select style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none",cursor:"pointer"}} value={item.unit} onChange={e=>updateItem(item.id,"unit",e.target.value)}>
                                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>CATEGORY</div>
                                <select style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none",cursor:"pointer"}} value={item.category} onChange={e=>updateItem(item.id,"category",e.target.value)}>
                                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:4}}>NOTES (optional)</div>
                                <input style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={item.notes} onChange={e=>updateItem(item.id,"notes",e.target.value)} placeholder="Any extra info..."/>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setStep("store")} disabled={items.length===0||noNameCount>0||zeroPriceCount>0}
                    style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:(noNameCount>0||zeroPriceCount>0)?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                    {noNameCount>0?"Fix missing names first":zeroPriceCount>0?"Fix $0 prices first":"Continue → Select Store"}
                  </button>
                </div>

                {/* RIGHT — Flyer preview */}
                {showFlyer&&previews.length>0&&(
                  <div style={{position:"sticky",top:80,background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow-md)"}}>
                    <div style={{padding:"12px 16px",borderBottom:"0.5px solid var(--border2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>📄 Flyer Reference</span>
                      <div style={{display:"flex",gap:4}}>
                        {previews.map((_,i)=>(
                          <button key={i} onClick={()=>setActivePreview(i)} style={{width:24,height:24,borderRadius:6,border:"none",background:activePreview===i?"#FF9F0A":"var(--bg)",color:activePreview===i?"#fff":"var(--text2)",fontSize:11,fontWeight:700,cursor:"pointer"}}>{i+1}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{padding:12}}>
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginBottom:8}}>
                        <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))} style={{background:"var(--bg)",border:"none",borderRadius:8,padding:"5px 14px",fontSize:16,cursor:"pointer",fontWeight:700,color:"var(--text)"}}>−</button>
                        <span style={{fontSize:12,color:"var(--text2)",fontWeight:600}}>{Math.round(zoom*100)}%</span>
                        <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={{background:"var(--bg)",border:"none",borderRadius:8,padding:"5px 14px",fontSize:16,cursor:"pointer",fontWeight:700,color:"var(--text)"}}>+</button>
                        <button onClick={()=>setZoom(1)} style={{background:"var(--bg)",border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",color:"var(--text2)",fontWeight:600}}>Reset</button>
                      </div>
                      <div style={{overflow:"auto",maxHeight:560,borderRadius:10}}>
                        {previews[activePreview]==="pdf"
                          ?<div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:44,marginBottom:8}}>📄</div><div style={{fontSize:13,color:"var(--text3)"}}>{files[activePreview]?.name}</div></div>
                          :<img src={previews[activePreview]} alt="Flyer" style={{width:`${zoom*100}%`,borderRadius:10,objectFit:"contain",transition:"width 0.2s"}}/>
                        }
                      </div>
                    </div>
                    <div style={{padding:"8px 16px",background:"var(--bg3)",fontSize:11,color:"var(--text3)",textAlign:"center"}}>
                      Tap items to edit while referencing the flyer
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: STORE ── */}
            {step==="store"&&(
              <div style={{background:"var(--surf)",borderRadius:16,padding:20,boxShadow:"var(--shadow)"}}>
                <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:16}}>Store & Location</div>
                {extractedStoreName&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(48,209,88,0.06)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:10,marginBottom:14}}>
                    <span style={{fontSize:14}}>🤖</span>
                    <div style={{flex:1,fontSize:12,color:"#30D158",fontWeight:500}}>
                      Detected from flyer: <strong>{extractedStoreName}</strong>
                      {pendingExtractedLocs.length>0&&<span style={{marginLeft:6,color:"#FF9F0A"}}>· {pendingExtractedLocs.length} location{pendingExtractedLocs.length>1?"s":""} to add</span>}
                    </div>
                  </div>
                )}
                {/* Store dropdown */}
                <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:6}}>SELECT STORE</div>
                <div style={{display:"flex",gap:6,marginBottom:14}}>
                  <select
                    value={selectedBrand?.id||""}
                    onChange={e=>{const b=brands.find(b=>b.id===e.target.value)||null;setSelectedBrand(b);setSelectedLocs([]);setPendingExtractedLocs([]);if(b)fetchLocations(b.id);else setLocations([]);}}
                    style={{flex:1,background:"var(--bg)",border:"none",borderRadius:10,padding:"11px 12px",fontSize:16,color:selectedBrand?"var(--text)":"var(--text3)",outline:"none",cursor:"pointer"}}>
                    <option value="">— Select store —</option>
                    {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button onClick={()=>{setShowAddBrand(true);setNewBrandName("");}}
                    style={{padding:"11px 14px",background:"rgba(255,159,10,0.1)",border:"none",borderRadius:10,fontSize:13,fontWeight:600,color:"#FF9F0A",cursor:"pointer",whiteSpace:"nowrap" as const}}>
                    + New
                  </button>
                </div>
                {selectedBrand&&(
                  <>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:6}}>VALID AT</div>
                    <div style={{display:"flex",background:"var(--bg)",borderRadius:12,padding:3,gap:3,marginBottom:12}}>
                      {([["all","🌐 All Branches"],["specific","📍 Specific Branches"]] as const).map(([m,l])=>(
                        <button key={m} onClick={()=>setLocationMode(m)} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:locationMode===m?"var(--surf)":"transparent",color:locationMode===m?"var(--text)":"var(--text3)",boxShadow:locationMode===m?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{l}</button>
                      ))}
                    </div>

                    {/* From-flyer pending locations */}
                    {locationMode==="specific"&&pendingExtractedLocs.length>0&&!selectedBrand&&(
                      <div style={{marginBottom:10,padding:"10px 12px",background:"rgba(255,159,10,0.05)",border:"1px solid rgba(255,159,10,0.25)",borderRadius:10}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#FF9F0A",marginBottom:6}}>
                          🤖 {pendingExtractedLocs.length} branch{pendingExtractedLocs.length>1?"es":""} detected — will be auto-added when you create the store
                        </div>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                          {pendingExtractedLocs.map((loc,idx)=>(
                            <div key={idx} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}>
                              <span style={{color:"#FF9F0A"}}>📍</span>
                              <span>{loc.city}{loc.state?`, ${loc.state}`:""}{loc.address?` — ${loc.address}`:""}{loc.zip?` ${loc.zip}`:""}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Location dropdown (specific mode) */}
                    {locationMode==="specific"&&(
                      <div style={{marginBottom:12}}>
                        <select
                          value=""
                          onChange={e=>{const id=e.target.value;if(id&&!selectedLocs.includes(id))setSelectedLocs(prev=>[...prev,id]);}}
                          style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"11px 12px",fontSize:16,color:locations.filter(l=>!selectedLocs.includes(l.id)).length?"var(--text)":"var(--text3)",outline:"none",cursor:"pointer",marginBottom:selectedLocs.length?8:0}}>
                          <option value="">{locations.length===0?"No branches yet — add one below":"— Select a branch to add —"}</option>
                          {locations.filter(l=>!selectedLocs.includes(l.id)).map(l=>(
                            <option key={l.id} value={l.id}>{l.branch_name}{l.city?` · ${l.city}`:""}{ l.zip?` ${l.zip}`:""}</option>
                          ))}
                        </select>
                        {/* Selected location chips */}
                        {selectedLocs.length>0&&(
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                            {selectedLocs.map(id=>{
                              const loc=locations.find(l=>l.id===id);
                              if(!loc) return null;
                              return(
                                <div key={id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:"rgba(255,159,10,0.1)",border:"1px solid rgba(255,159,10,0.3)",borderRadius:20}}>
                                  <span style={{fontSize:12,fontWeight:600,color:"#FF9F0A"}}>{loc.branch_name}{loc.city?` · ${loc.city}`:""}</span>
                                  <button onClick={()=>setSelectedLocs(prev=>prev.filter(i=>i!==id))}
                                    style={{background:"none",border:"none",fontSize:11,color:"#FF9F0A",cursor:"pointer",padding:0,lineHeight:1,fontWeight:700}}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {locationMode==="specific"&&(
                      <button onClick={()=>setShowAddLoc(true)}
                        style={{width:"100%",padding:"10px 14px",background:"rgba(255,159,10,0.04)",border:"1.5px dashed rgba(255,159,10,0.3)",borderRadius:10,fontSize:12,fontWeight:600,color:"#FF9F0A",cursor:"pointer",textAlign:"left" as const,marginBottom:12}}>
                        + Add New Location
                      </button>
                    )}
                  </>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:6,display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
                      SALE STARTS
                      {saleStart&&extractedStoreName&&<span style={{fontSize:9,fontWeight:700,color:"#30D158",background:"rgba(48,209,88,0.1)",borderRadius:20,padding:"1px 6px"}}>🤖 auto</span>}
                    </div>
                    <input type="date" style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"11px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={saleStart} onChange={e=>setSaleStart(e.target.value)}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:0.6,color:"var(--text3)",marginBottom:6,display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
                      SALE ENDS
                      {saleEnd&&extractedStoreName&&<span style={{fontSize:9,fontWeight:700,color:"#30D158",background:"rgba(48,209,88,0.1)",borderRadius:20,padding:"1px 6px"}}>🤖 auto</span>}
                    </div>
                    <input type="date" style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"11px 12px",fontSize:16,color:"var(--text)",outline:"none"}} value={saleEnd} onChange={e=>setSaleEnd(e.target.value)}/>
                    {saleEnd && saleEnd < localDate() && (
                      <div style={{marginTop:6,fontSize:11,color:"#FF3B30",fontWeight:600}}>
                        ⚠️ This date is in the past — please update it or clear the field before publishing.
                      </div>
                    )}
                  </div>
                </div>
                {(()=>{
                  const pastSaleEnd = !!(saleEnd && saleEnd < localDate());
                  const disabled = !selectedBrand || (locationMode==="specific"&&selectedLocs.length===0) || pastSaleEnd;
                  return (
                    <button onClick={()=>setStep("confirm")} disabled={disabled}
                      style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                      {pastSaleEnd?"Fix sale end date first":"Continue → Review & Publish"}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* ── STEP 4: CONFIRM ── */}
            {step==="confirm"&&(
              <div>
                <div style={{background:"var(--surf)",borderRadius:16,padding:20,boxShadow:"var(--shadow)",marginBottom:12}}>
                  <div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:16}}>Confirm Deal</div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:0}}>
                    {[
                      {l:"Store",v:selectedBrand?.name},
                      {l:"Valid at",v:locationMode==="all"?"All Branches":`${selectedLocs.length} branch${selectedLocs.length>1?"es":""}`},
                      {l:"Sale Period",v:`${saleStart}${saleEnd?` → ${saleEnd}`:" (no end date)"}`},
                      {l:"Total Items",v:`${items.length} deals`},
                      {l:"Avg Confidence",v:`${avgConfidence}%`},
                      {l:"Source",v:uploadMode==="image"?`📄 Flyer (${files.length} file${files.length>1?"s":""})`:"🔗 URL"},
                    ].map((r,i,arr)=>(
                      <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:i<arr.length-1?"0.5px solid var(--border2)":"none"}}>
                        <span style={{fontSize:13,color:"var(--text2)"}}>{r.l}</span>
                        <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{background:"var(--surf)",borderRadius:16,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:16}}>
                  <div style={{padding:"12px 16px",borderBottom:"0.5px solid var(--border2)",fontSize:13,fontWeight:600,color:"var(--text)"}}>Items ({items.length})</div>
                  <div style={{maxHeight:300,overflowY:"auto"}}>
                    {items.map((item,i)=>(
                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<items.length-1?"0.5px solid var(--border2)":"none"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                          <div style={{fontSize:11,color:"var(--text3)"}}>{item.category} · {item.unit}</div>
                        </div>
                        <ConfidenceBadge score={item.confidence}/>
                        <div style={{textAlign:"right" as const,flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:"#FF9F0A"}}>${item.price.toFixed(2)}</div>
                          {item.regular_price&&<div style={{fontSize:10,color:"var(--text3)",textDecoration:"line-through"}}>${item.regular_price.toFixed(2)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Public visibility notice */}
                <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:"rgba(10,132,255,0.05)",border:"1px solid rgba(10,132,255,0.18)",borderRadius:12,marginBottom:12}}>
                  <span style={{fontSize:15,flexShrink:0}}>🌐</span>
                  <div style={{fontSize:12,color:"#3A7BD5",lineHeight:1.5}}>
                    <strong>Your deal will be publicly visible</strong> to all KNOWBOTH users once published. Only store names, item names and prices are shown — your account is not linked to the listing.
                  </div>
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setStep("store")} style={{flex:1,padding:14,background:"var(--surf)",border:"none",borderRadius:12,fontSize:14,fontWeight:600,color:"var(--text2)",cursor:"pointer",boxShadow:"var(--shadow)"}}>← Edit</button>
                  <button onClick={publish} disabled={publishing}
                    style={{flex:2,padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:publishing?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.3)"}}>
                    {publishing?"Publishing...":"🚀 Publish Live"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <BottomSheet open={showAddLoc} onClose={()=>setShowAddLoc(false)} label="Add New Location">
        <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 0 8px"}}>
          <input value={newLocBranch} onChange={e=>setNewLocBranch(e.target.value)} autoFocus
            placeholder="Branch name (optional)"
            style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <input value={newLocAddress} onChange={e=>setNewLocAddress(e.target.value)}
            placeholder="Street address"
            style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <div style={{display:"flex",gap:8}}>
            <input value={newLocCity} onChange={e=>setNewLocCity(e.target.value)} placeholder="City *"
              style={{flex:1,background:"var(--bg)",border:"1px solid rgba(255,159,10,0.4)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
            <input value={newLocState} onChange={e=>setNewLocState(e.target.value.toUpperCase().slice(0,2))} placeholder="ST" maxLength={2}
              style={{width:56,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 8px",fontSize:16,color:"var(--text)",outline:"none",textAlign:"center" as const}}/>
            <input value={newLocZip} onChange={e=>setNewLocZip(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="ZIP" maxLength={5}
              style={{width:84,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 10px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          </div>
          <input value={newLocPhone} onChange={e=>setNewLocPhone(e.target.value)}
            placeholder="Phone (optional)"
            style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <button onClick={lookupLocation} disabled={lookingUpLoc}
            style={{width:"100%",padding:"11px",background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:10,fontSize:13,fontWeight:600,color:"#0A84FF",cursor:"pointer"}}>
            {lookingUpLoc?"🔍 Looking up...":"📍 Auto-fill from address / zip"}
          </button>
          {newLocMapLink&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"rgba(48,209,88,0.06)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:10}}>
              <span>🗺️</span>
              <a href={newLocMapLink} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:"#30D158",fontWeight:600,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>View on Google Maps ↗</a>
              {newLocLat&&<span style={{fontSize:10,color:"var(--text3)",flexShrink:0}}>{newLocLat.toFixed(4)}, {newLocLng?.toFixed(4)}</span>}
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setShowAddLoc(false)}
              style={{flex:1,padding:"12px",background:"var(--bg)",border:"none",borderRadius:10,fontSize:14,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
              Cancel
            </button>
            <button onClick={createLocation} disabled={addingLoc||!newLocCity.trim()}
              style={{flex:2,padding:"12px",background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",opacity:!newLocCity.trim()?0.5:1,boxShadow:"0 2px 8px rgba(255,159,10,0.3)"}}>
              {addingLoc?"Saving...":"Save Location"}
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={showAddBrand} onClose={()=>setShowAddBrand(false)} label="Add New Store">
        <div style={{display:"flex",flexDirection:"column",gap:12,padding:"4px 0 8px"}}>
          <input value={newBrandName} onChange={e=>setNewBrandName(e.target.value)} autoFocus
            placeholder="Store name *"
            style={{background:"var(--bg)",border:"1px solid rgba(255,159,10,0.4)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <input value={newBrandWebsite} onChange={e=>setNewBrandWebsite(e.target.value)}
            placeholder="Website (optional)"
            style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <input value={newBrandPhone} onChange={e=>setNewBrandPhone(e.target.value)}
            placeholder="Phone (optional)"
            style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none"}}/>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setShowAddBrand(false)}
              style={{flex:1,padding:"12px",background:"var(--bg)",border:"none",borderRadius:10,fontSize:14,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
              Cancel
            </button>
            <button onClick={createBrand} disabled={addingBrand||!newBrandName.trim()}
              style={{flex:2,padding:"12px",background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:10,fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",opacity:!newBrandName.trim()?0.5:1,boxShadow:"0 2px 8px rgba(255,159,10,0.3)"}}>
              {addingBrand?"Adding...":"Add Store"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
