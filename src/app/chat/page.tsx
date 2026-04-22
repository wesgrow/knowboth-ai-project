"use client";
import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

interface Message { role:"user"|"assistant"; content:string; }

const SUGGESTIONS = [
  "Where is cheapest toor dal near me?",
  "What did I spend on groceries this month?",
  "Which store should I visit today?",
  "What items are expiring soon?",
  "How much have I saved this week?",
  "Compare ghee prices near me",
];

export default function ChatPage() {
  const { user, pantry, cart } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    { role:"assistant", content:`Hi ${user?.name?.split(" ")[0]||"there"}! 👋 I'm your KNOWBOTH AI assistant. I can help you find the cheapest prices, compare stores, check your pantry, and track your savings. What would you like to know?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchDeals(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  async function fetchDeals() {
    const { data: dealRows } = await supabase.from("deals").select("id,brand_id").eq("status","approved");
    if (!dealRows?.length) return;
    const dealIds = dealRows.map((d:any)=>d.id);
    const brandIds = [...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id",brandIds);
    const { data: items } = await supabase.from("deal_items").select("name,price,unit,category,deal_id").in("deal_id",dealIds).limit(50);
    const brandMap:Record<string,any>={};
    (brands||[]).forEach((b:any)=>{brandMap[b.id]=b;});
    const dealMap:Record<string,any>={};
    dealRows.forEach((d:any)=>{dealMap[d.id]=d;});
    const merged=(items||[]).map((i:any)=>({...i,brand:brandMap[dealMap[i.deal_id]?.brand_id]}));
    setDeals(merged);
  }

  async function send(text?: string) {
    const q = text||input.trim();
    if (!q || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role:"user", content:q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const context = {
        user: { name:user?.name, city:user?.city, zip:user?.zip, currency:user?.currency, points:user?.points },
        deals: deals.slice(0,30).map(d=>({ name:d.name, price:d.price, unit:d.unit, store:d.brand?.name, category:d.category })),
        pantry: pantry.slice(0,20).map(p=>({ name:p.name, qty:p.qty, store:p.store })),
        cart: cart.filter(i=>!i.purchased).slice(0,10).map(c=>({ name:c.name, price:c.price, store:c.store })),
      };
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: newMessages, context }),
      });
      const data = await res.json();
      setMessages(prev=>[...prev, { role:"assistant", content:data.reply||"Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev=>[...prev, { role:"assistant", content:"Sorry, something went wrong. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column" }} className="page-body">
      <Navbar />
      <div style={{ flex:1, maxWidth:800, margin:"0 auto", width:"100%", display:"flex", flexDirection:"column", padding:"0 14px" }}>

        {/* Header */}
        <div style={{ padding:"16px 0 12px" }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text)" }}>AI Assistant</h1>
          <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Ask me anything about prices, deals, or your spending</p>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, paddingBottom:12 }}>
          {messages.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              {m.role==="assistant" && <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginRight:8, flexShrink:0, alignSelf:"flex-end" }}>✦</div>}
              <div style={{
                maxWidth:"75%", padding:"10px 14px", borderRadius: m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                background: m.role==="user" ? "linear-gradient(135deg,var(--gold),var(--gold-dim))" : "var(--surf)",
                border: m.role==="user" ? "none" : "1px solid var(--border)",
                color: m.role==="user" ? "#000" : "var(--text)",
                fontSize:13, lineHeight:1.6, fontWeight: m.role==="user"?600:400,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
              <div style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:"16px 16px 16px 4px", padding:"10px 14px", display:"flex", gap:4 }}>
                {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--text-dim)", animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontWeight:700, marginBottom:8, letterSpacing:1, textTransform:"uppercase" as const }}>Suggestions</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {SUGGESTIONS.map(s=>(
                <button key={s} onClick={()=>send(s)} style={{ background:"var(--surf)", border:"1px solid var(--border)", borderRadius:20, padding:"6px 12px", fontSize:11, color:"var(--text-muted)", cursor:"pointer", fontWeight:600 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ display:"flex", gap:8, paddingBottom:16, paddingTop:8, borderTop:"1px solid var(--border)" }}>
          <input
            className="input"
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Ask about prices, deals, savings..."
            style={{ flex:1 }}
            disabled={loading}
          />
          <button onClick={()=>send()} disabled={!input.trim()||loading} className="btn-gold" style={{ padding:"10px 16px", fontSize:16, opacity:!input.trim()||loading?0.5:1 }}>
            ↑
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
    </div>
  );
}
