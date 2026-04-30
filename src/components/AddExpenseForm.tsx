"use client";
import { useState, useEffect } from "react";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

const CATS = ["Grocery","Vegetables","Fruits","Dairy","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Spices","Lentils & Dals","Rice & Grains","Household","Gas","Restaurant","Pharmacy","Clothing","Entertainment","Medical","Electronics","Other"];
const PAY = ["Cash","Credit Card","Debit Card","UPI","Other"];

type Row = { name:string; price:string; qty:string; cat:string; notes:string; };
type Store = { id:string; name:string; };
const emptyRow = (): Row => ({ name:"", price:"", qty:"1", cat:"Grocery", notes:"" });
const inp: React.CSSProperties = { width:"100%",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",fontSize:16,color:"var(--text)",outline:"none",boxSizing:"border-box",fontFamily:"inherit" };

interface Props { onClose:()=>void; onSaved:()=>void; }

export function AddExpenseForm({ onClose, onSaved }: Props) {
  const { user } = useAppStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [addingStore, setAddingStore] = useState(false);
  const [newStore, setNewStore] = useState("");
  const [dt, setDt] = useState(new Date().toISOString().split("T")[0]);
  const [pay, setPay] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);

  async function loadStores() {
    setLoadingStores(true);
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) { setLoadingStores(false); return; }
      const { data, error } = await supabase.from("brands").select("id,name").order("name");
      if (error) { console.error("brands fetch:", error); toast.error(error.message); }
      setStores(data || []);
    } catch (e: any) {
      console.error("stores fetch exception:", e);
      toast.error(e.message || "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }

  useEffect(() => { loadStores(); }, []);

  function toSlug(n: string) { return n.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

  async function saveStore() {
    if (!newStore.trim()) return;
    const name = newStore.trim();
    const { data, error } = await supabase.from("brands").insert({ name, slug: toSlug(name) }).select("id,name").single();
    if (error) { toast.error(error.code === "23505" ? "Store already exists" : error.message); return; }
    setStores(p => [...p, data].sort((a,b) => a.name.localeCompare(b.name)));
    setStoreId(data.id);
    setAddingStore(false);
    setNewStore("");
  }

  function upd(i:number, k:keyof Row, v:string) {
    setRows(p => p.map((r,idx) => idx===i ? {...r,[k]:v} : r));
  }

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if (!storeId) return toast.error("Select a store");
    if (!dt) return toast.error("Select a date");
    const valid = rows.filter(r => r.name.trim());
    if (!valid.length) return toast.error("Add at least one item");
    setSaving(true);
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) { toast.error("Sign in required"); return; }
      const storeName = stores.find(s=>s.id===storeId)?.name || "";
      const total = valid.reduce((s,r) => s + (r.price?parseFloat(r.price):0)*(Math.max(1,parseInt(r.qty)||1)), 0);
      const { data: exp, error: e1 } = await supabase.from("expenses").insert({
        user_id: session.user.id,
        brand_id: storeId,
        store_name: storeName,
        store_city: "",
        purchase_date: dt,
        currency: user?.currency || "USD",
        total,
        items_count: valid.length,
        source: "manual",
        payment_method: pay || null,
      }).select("id").single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("expense_items").insert(
        valid.map(r => ({
          expense_id: exp.id,
          name: r.name.trim(),
          price: r.price ? parseFloat(r.price) : 0,
          quantity: Math.max(1, parseInt(r.qty) || 1),
          unit: "ea",
          category: r.cat,
          notes: r.notes.trim() || null,
        }))
      );
      if (e2) throw e2;
      toast.success(`${valid.length} item${valid.length>1?"s":""} logged`);
      onSaved();
      onClose();
    } catch (err:any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
      <form onSubmit={submit} style={{background:"var(--surf)",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:800,color:"var(--text)",letterSpacing:-0.5}}>Log Expense</div>
          <button type="button" onClick={onClose} style={{background:"none",border:"none",fontSize:18,color:"var(--text3)",cursor:"pointer",padding:4}}>✕</button>
        </div>

        {/* Store */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:6}}>Store *</div>
          {addingStore ? (
            <div style={{display:"flex",gap:8}}>
              <input value={newStore} onChange={e=>setNewStore(e.target.value)} placeholder="Store name" autoFocus
                onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),saveStore())} style={{...inp,flex:1}} />
              <button type="button" onClick={saveStore} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>Save</button>
              <button type="button" onClick={()=>{setAddingStore(false);setNewStore("");}} style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",fontSize:14,color:"var(--text2)",cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          ) : (
            <select value={storeId} onChange={e=>{if(e.target.value==="__new__"){setAddingStore(true);}else{setStoreId(e.target.value);}}} style={inp} disabled={loadingStores}>
              <option value="">{loadingStores ? "Loading stores…" : stores.length === 0 ? "— No stores yet —" : "— Select store —"}</option>
              {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new__">＋ Add new store…</option>
            </select>
          )}
        </div>

        {/* Date + Payment */}
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:6}}>Date *</div>
            <input type="date" value={dt} onChange={e=>setDt(e.target.value)} required style={inp} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:6}}>Payment</div>
            <select value={pay} onChange={e=>setPay(e.target.value)} style={inp}>
              <option value="">— Optional —</option>
              {PAY.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Item rows */}
        <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase",marginBottom:6}}>Items *</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rows.map((r,i) => (
            <div key={i} style={{background:"var(--bg)",borderRadius:12,padding:"12px",border:"1px solid var(--border)"}}>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={r.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Item name *"
                  style={{...inp,flex:1,padding:"9px 12px"}} />
                {rows.length>1&&(
                  <button type="button" onClick={()=>setRows(p=>p.filter((_,idx)=>idx!==i))}
                    style={{background:"none",border:"none",fontSize:18,color:"var(--text3)",cursor:"pointer",padding:"4px 6px",flexShrink:0}}>✕</button>
                )}
              </div>
              <div style={{display:"flex",gap:6}}>
                <select value={r.cat} onChange={e=>upd(i,"cat",e.target.value)} style={{...inp,flex:2,padding:"8px 10px",fontSize:14}}>
                  {CATS.map(c=><option key={c}>{c}</option>)}
                </select>
                <input type="number" value={r.price} onChange={e=>upd(i,"price",e.target.value)}
                  placeholder="Price" min="0" step="0.01" style={{...inp,width:76,padding:"8px 10px",fontSize:14}} />
                <input type="number" value={r.qty} onChange={e=>upd(i,"qty",e.target.value)}
                  min="1" placeholder="Qty" style={{...inp,width:58,padding:"8px 10px",fontSize:14}} />
              </div>
              <input value={r.notes} onChange={e=>upd(i,"notes",e.target.value)} placeholder="Notes (optional)"
                style={{...inp,marginTop:6,padding:"8px 12px",fontSize:14}} />
            </div>
          ))}
        </div>

        <button type="button" onClick={()=>setRows(p=>[...p,emptyRow()])}
          style={{width:"100%",marginTop:8,padding:"10px",background:"none",border:"1px dashed var(--border)",borderRadius:12,fontSize:13,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
          + Add another item
        </button>

        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button type="button" onClick={onClose} className="btn-ghost" style={{padding:"13px 20px",fontSize:14,borderRadius:12}}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-gold" style={{flex:1,padding:13,fontSize:15,opacity:saving?0.6:1}}>
            {saving?"Saving…":"Log Expense"}
          </button>
        </div>

      </form>
    </div>
  );
}
