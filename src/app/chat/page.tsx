"use client";
import { useState, useRef, useEffect } from "react";
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
    { role:"assistant", content:`Hi ${user?.name?.split(" ")[0]||"there"}! 👋 I'm your KNOWBOTH AI assistant. I can help you find cheapest prices, compare stores, check your pantry, and track your savings. You can type or use the 🎤 mic to ask me anything.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<any[]>([]);

  // Voice input
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Voice output
  const [speakingIdx, setSpeakingIdx] = useState<number|null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchDeals(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => {
    setMicSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    setTtsSupported("speechSynthesis" in window);
  }, []);

  async function fetchDeals() {
    const { data: dealRows } = await supabase.from("deals").select("id,brand_id").eq("status","approved");
    if (!dealRows?.length) return;
    const dealIds = dealRows.map((d:any)=>d.id);
    const brandIds = [...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id",brandIds);
    const { data: items } = await supabase.from("deal_items").select("name,price,unit,category,deal_id").in("deal_id",dealIds).limit(50);
    const brandMap:Record<string,any>={};
    (brands||[]).forEach((b:any)=>{ brandMap[b.id]=b; });
    const dealMap:Record<string,any>={};
    dealRows.forEach((d:any)=>{ dealMap[d.id]=d; });
    setDeals((items||[]).map((i:any)=>({...i,brand:brandMap[dealMap[i.deal_id]?.brand_id]})));
  }

  // ── Voice Input ──────────────────────────────────────
  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e:any) => {
      const transcript = Array.from(e.results as any[]).map((r:any)=>r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => { setListening(false); inputRef.current?.focus(); };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function toggleMic() {
    if (listening) stopListening();
    else startListening();
  }

  // ── Voice Output ─────────────────────────────────────
  function speak(text: string, idx: number) {
    if (!("speechSynthesis" in window)) return;
    if (speakingIdx === idx) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#]/g,"").replace(/\n+/g," ");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakingIdx(idx);
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(utterance);
  }

  // ── Send message ─────────────────────────────────────
  async function send(text?: string) {
    const q = (text||input).trim();
    if (!q || loading) return;
    setInput("");
    stopListening();
    const newMessages: Message[] = [...messages, { role:"user", content:q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const context = {
        user: { name:user?.name, city:user?.city, zip:user?.zip, currency:user?.currency, points:user?.points },
        deals: deals.slice(0,30).map(d=>({ name:d.name, price:d.price, unit:d.unit, store:d.brand?.name, category:d.category })),
        pantry: pantry.slice(0,20).map(p=>({ name:(p as any).name, qty:(p as any).qty, store:(p as any).store })),
        cart: cart.filter(i=>!i.purchased).slice(0,10).map(c=>({ name:(c as any).name, price:(c as any).price, store:(c as any).store })),
      };
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: newMessages, context }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't process that.";
      const replyIdx = newMessages.length;
      setMessages(prev=>{
        const updated = [...prev, { role:"assistant" as const, content:reply }];
        if (autoSpeak && ttsSupported) {
          setTimeout(()=>speak(reply, replyIdx), 100);
        }
        return updated;
      });
    } catch {
      setMessages(prev=>[...prev, { role:"assistant", content:"Sorry, something went wrong. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="page-body" style={{background:"var(--bg)",minHeight:"100vh"}}>
        <div style={{flex:1,maxWidth:800,margin:"0 auto",width:"100%",display:"flex",flexDirection:"column",padding:"0 14px"}}>

          {/* Header */}
          <div style={{padding:"16px 0 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>AI Assistant</h1>
              <p style={{fontSize:12,color:"var(--text3)",marginTop:3}}>Ask me anything about prices, deals or your spending</p>
            </div>
            {ttsSupported&&(
              <button onClick={()=>setAutoSpeak(p=>!p)}
                title={autoSpeak?"Auto-speak on":"Auto-speak off"}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:20,border:`1px solid ${autoSpeak?"var(--gold)":"var(--border)"}`,background:autoSpeak?"rgba(255,159,10,0.1)":"var(--surf)",cursor:"pointer",fontSize:11,fontWeight:600,color:autoSpeak?"var(--gold)":"var(--text3)"}}>
                {autoSpeak?"🔊":"🔇"} Auto-speak
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,paddingBottom:12}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
                {m.role==="assistant"&&(
                  <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✦</div>
                )}
                <div style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",gap:4,maxWidth:"75%"}}>
                  <div style={{
                    padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                    background:m.role==="user"?"linear-gradient(135deg,var(--gold),var(--gold-dim))":"var(--surf)",
                    border:m.role==="user"?"none":"1px solid var(--border)",
                    color:m.role==="user"?"#000":"var(--text)",
                    fontSize:13,lineHeight:1.6,fontWeight:m.role==="user"?600:400,
                    whiteSpace:"pre-wrap" as const,
                  }}>
                    {m.content}
                  </div>
                  {m.role==="assistant"&&ttsSupported&&(
                    <button onClick={()=>speak(m.content,i)}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:speakingIdx===i?"var(--gold)":"var(--text3)",padding:"0 2px",lineHeight:1}}
                      title={speakingIdx===i?"Stop":"Read aloud"}>
                      {speakingIdx===i?"⏹ Stop":"🔊"}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading&&(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
                <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:"16px 16px 16px 4px",padding:"10px 14px",display:"flex",gap:4}}>
                  {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--gold)",animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions */}
          {messages.length<=1&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"var(--text3)",fontWeight:700,marginBottom:8,letterSpacing:1,textTransform:"uppercase" as const}}>Try asking</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {SUGGESTIONS.map(s=>(
                  <button key={s} onClick={()=>send(s)}
                    style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:20,padding:"6px 12px",fontSize:11,color:"var(--text2)",cursor:"pointer",fontWeight:600}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div style={{display:"flex",gap:8,paddingBottom:16,paddingTop:8,borderTop:"1px solid var(--border)",alignItems:"center"}}>
            {/* Mic button */}
            {micSupported&&(
              <button onClick={toggleMic}
                title={listening?"Stop recording":"Speak"}
                style={{
                  width:42,height:42,borderRadius:"50%",border:"none",cursor:"pointer",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                  background:listening?"rgba(255,59,48,0.15)":"var(--surf)",
                  color:listening?"#FF3B30":"var(--text2)",
                  boxShadow:listening?"0 0 0 3px rgba(255,59,48,0.25)":"var(--shadow)",
                  animation:listening?"micPulse 1.2s ease-in-out infinite":"none",
                  transition:"all 0.2s",
                }}>
                {listening?"⏹":"🎤"}
              </button>
            )}

            <input
              ref={inputRef}
              className="input"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder={listening?"Listening...":"Ask about prices, deals, savings..."}
              style={{flex:1,background:listening?"rgba(255,59,48,0.04)":"var(--bg)",border:listening?"1px solid rgba(255,59,48,0.3)":undefined}}
              disabled={loading}
            />

            <button onClick={()=>send()} disabled={!input.trim()||loading}
              className="btn-gold"
              style={{padding:"10px 16px",fontSize:16,opacity:!input.trim()||loading?0.5:1,flexShrink:0}}>
              ↑
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}
          @keyframes micPulse{0%,100%{box-shadow:0 0 0 3px rgba(255,59,48,0.25)}50%{box-shadow:0 0 0 6px rgba(255,59,48,0.1)}}
        `}</style>
      </div>
    </>
  );
}
