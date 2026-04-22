"use client";
import { useState } from "react";
import toast from "react-hot-toast";

interface ShareDealProps {
  item: { name:string; price:number; unit:string; store:string; };
}

export function ShareDeal({ item }: ShareDealProps) {
  const [show, setShow] = useState(false);

  const text = `🏷️ ${item.name} for $${item.price?.toFixed(2)}/${item.unit} at ${item.store}!\nFound on KNOWBOTH.AI — Know Your Savings. Know Your Spending.`;
  const url = typeof window!=="undefined" ? window.location.origin : "";

  async function share(method: "native"|"whatsapp"|"copy") {
    if (method==="native" && navigator.share) {
      await navigator.share({ title:"Deal Alert!", text, url });
    } else if (method==="whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text+" "+url)}`,"_blank");
    } else {
      await navigator.clipboard.writeText(text+" "+url);
      toast.success("Copied to clipboard!");
    }
    setShow(false);
  }

  return (
    <>
      <button onClick={()=>setShow(true)} style={{ background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:14, padding:3 }} title="Share deal">
        📤
      </button>
      {show && (
        <div onClick={e=>e.target===e.currentTarget&&setShow(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center", backdropFilter:"blur(6px)" }}>
          <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px", width:"100%", maxWidth:480 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:4 }}>📤 Share Deal</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>{item.name} · ${item.price?.toFixed(2)}/{item.unit} @ {item.store}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {navigator.share && (
                <button onClick={()=>share("native")} style={{ padding:"12px", background:"rgba(245,166,35,0.1)", border:"1px solid rgba(245,166,35,0.3)", borderRadius:10, color:"var(--gold)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  📱 Share via Device
                </button>
              )}
              <button onClick={()=>share("whatsapp")} style={{ padding:"12px", background:"rgba(37,211,102,0.1)", border:"1px solid rgba(37,211,102,0.3)", borderRadius:10, color:"#25D366", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                💬 Share on WhatsApp
              </button>
              <button onClick={()=>share("copy")} style={{ padding:"12px", background:"var(--surf2)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text-muted)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                📋 Copy Link
              </button>
              <button onClick={()=>setShow(false)} style={{ padding:"10px", background:"none", border:"none", color:"var(--text-dim)", fontSize:12, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
