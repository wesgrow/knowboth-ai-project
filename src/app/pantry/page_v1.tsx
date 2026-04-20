"use client";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { getLevel } from "@/lib/utils";
import toast from "react-hot-toast";

export default function PantryPage() {
  const { pantry, updatePantryQty, removeFromPantry, restockItem, user } = useAppStore();
  const [restock, setRestock] = useState<any>(null);
  const [rqty, setRqty] = useState(1);
  const low = pantry.filter(p=>p.qty<=1).length;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <Navbar />
      <div style={{maxWidth:800,margin:"0 auto",padding:"16px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,marginBottom:4,color:"var(--text)"}}>Pantry</h1>
            <p style={{fontSize:12,color:"var(--text-muted)"}}>{pantry.length} items · {low} low stock</p>
          </div>
          <div style={{background:"rgba(245,166,35,0.1)",border:"1px solid rgba(245,166,35,0.2)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"var(--gold)",fontWeight:700}}>
            {getLevel(user?.points||0)}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
          {[{l:"Items",v:pantry.length,c:"var(--gold)"},{l:"Low Stock",v:low,c:"var(--red)"},{l:"Points",v:user?.points||0,c:"var(--teal)"}].map(s=>(
            <div key={s.l} style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:12,padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {pantry.length===0 && (
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{fontSize:44,marginBottom:12}}>🏠</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8,color:"var(--text)"}}>Pantry is empty</div>
            <p style={{fontSize:12,color:"var(--text-muted)"}}>Upload bills to auto-fill your pantry</p>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {pantry.map(item=>(
            <div key={item.id} style={{background:item.qty<=1?"rgba(255,71,87,0.04)":"var(--surf)",border:`1px solid ${item.qty<=1?"rgba(255,71,87,0.25)":"var(--border)"}`,borderRadius:13,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:"var(--surf2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{item.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{item.name}</span>
                    {item.qty<=1 && <span style={{background:"rgba(255,71,87,0.1)",color:"var(--red)",border:"1px solid rgba(255,71,87,0.3)",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:700}}>LOW</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{item.store} · ${item.price?.toFixed(2)}/{item.unit}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>updatePantryQty(item.id,item.qty-1)} style={{width:26,height:26,borderRadius:7,border:"1px solid var(--border)",background:"var(--surf2)",color:"var(--text)",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:16,fontWeight:900,color:"var(--teal)",minWidth:22,textAlign:"center"}}>{item.qty}</span>
                  <button onClick={()=>updatePantryQty(item.id,item.qty+1)} style={{width:26,height:26,borderRadius:7,border:"1px solid var(--border)",background:"var(--surf2)",color:"var(--text)",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
                <button onClick={()=>{setRestock(item);setRqty(1);}} style={{background:"rgba(245,166,35,0.08)",border:"1px solid rgba(245,166,35,0.2)",color:"var(--gold)",borderRadius:8,padding:"6px 10px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>🔄 Restock</button>
                <button onClick={()=>removeFromPantry(item.id)} style={{background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer",fontSize:14,padding:3}}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {restock && (
        <div onClick={e=>e.target===e.currentTarget&&setRestock(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}}>
          <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:480}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4,color:"var(--text)"}}>🔄 Restock</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>{restock.name}</div>
            <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,letterSpacing:1.5,marginBottom:8}}>QUANTITY</div>
            <div style={{display:"flex",alignItems:"center",gap:16,background:"var(--surf2)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 16px",marginBottom:20}}>
              <button onClick={()=>setRqty(q=>Math.max(1,q-1))} style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",background:"var(--surf)",color:"var(--text)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <span style={{flex:1,textAlign:"center",fontSize:28,fontWeight:900,color:"var(--teal)"}}>{rqty}</span>
              <button onClick={()=>setRqty(q=>q+1)} style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",background:"var(--surf)",color:"var(--text)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setRestock(null)} className="btn-ghost" style={{padding:"12px 20px"}}>Cancel</button>
              <button onClick={()=>{for(let i=0;i<rqty;i++)restockItem(restock);toast.success(`🛒 ${restock.name} → Cart`);setRestock(null);}} className="btn-gold" style={{flex:1,padding:12}}>Add to Cart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
