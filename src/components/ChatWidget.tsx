"use client";
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Cheapest toor dal near me?",
  "What did I spend this month?",
  "Items expiring soon?",
  "How much have I saved?",
];

const W_NORMAL = 360;
const W_MAX    = 480;
const H_NORMAL = 500;
const H_MAX    = 660;
const BTN      = 56;

export function ChatWidget() {
  const { user, pantry, cart } = useAppStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 Ask me about prices, deals or your spending.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [showMicNotice, setShowMicNotice] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [ttsSupported, setTtsSupported] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false });

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    setPos({
      x: window.innerWidth - W_NORMAL - 16,
      y: window.innerHeight - BTN - (isMobile ? 76 : 24),
    });
    setMicSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    setTtsSupported("speechSynthesis" in window);
    if (!localStorage.getItem("kb_chat_notice")) setShowAiNotice(true);
    fetchDeals();
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }, [messages]);

  async function fetchDeals() {
    const { data: dealRows } = await supabase.from("deals").select("id,brand_id").eq("status", "approved");
    if (!dealRows?.length) return;
    const dealIds = dealRows.map((d: any) => d.id);
    const brandIds = [...new Set(dealRows.map((d: any) => d.brand_id).filter(Boolean))] as string[];
    const { data: brands } = await supabase.from("brands").select("id,name").in("id", brandIds);
    const { data: items } = await supabase.from("deal_items").select("name,price,unit,category,deal_id").in("deal_id", dealIds).limit(50);
    const brandMap: Record<string, any> = {};
    (brands || []).forEach((b: any) => { brandMap[b.id] = b; });
    const dealMap: Record<string, any> = {};
    dealRows.forEach((d: any) => { dealMap[d.id] = d; });
    setDeals((items || []).map((i: any) => ({ ...i, brand: brandMap[dealMap[i.deal_id]?.brand_id] })));
  }

  // ── Drag ────────────────────────────────────────────
  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    drag.current = { active: true, sx: cx, sy: cy, ox: pos?.x ?? 0, oy: pos?.y ?? 0, moved: false };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!drag.current.active) return;
      const mx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const my = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const dx = mx - drag.current.sx;
      const dy = my - drag.current.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - BTN, drag.current.ox + dx)),
        y: Math.max(0, Math.min(window.innerHeight - BTN, drag.current.oy + dy)),
      });
    };
    const onUp = () => {
      drag.current.active = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as any, { passive: true });
    window.addEventListener("touchend", onUp);
  }

  function onBtnClick() {
    if (drag.current.moved) return;
    if (!open) { setMinimized(false); }
    setOpen(o => !o);
  }

  // ── Voice input ──────────────────────────────────────
  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => setInput(Array.from(e.results as any[]).map((x: any) => x[0].transcript).join(""));
    r.onend = () => { setListening(false); inputRef.current?.focus(); };
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }
  function stopListening() { recognitionRef.current?.stop(); setListening(false); }
  function toggleMic() {
    if (listening) { stopListening(); return; }
    if (!localStorage.getItem("kb_mic_notice")) { setShowMicNotice(true); return; }
    startListening();
  }
  function acceptMicAndStart() {
    localStorage.setItem("kb_mic_notice","1");
    setShowMicNotice(false);
    startListening();
  }

  // ── Voice output ─────────────────────────────────────
  function speak(text: string, idx: number) {
    if (!("speechSynthesis" in window)) return;
    if (speakingIdx === idx) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, "").replace(/\n+/g, " "));
    u.rate = 1.05;
    u.onstart = () => setSpeakingIdx(idx);
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(u);
  }

  // ── Send ─────────────────────────────────────────────
  async function send(text?: string) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput(""); stopListening();
    const next: Message[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setLoading(true);
    if (!open) setUnread(u => u + 1);
    try {
      const context = {
        user: { name: user?.name, city: user?.city, zip: user?.zip },
        deals: deals.slice(0, 30).map(d => ({ name: d.name, price: d.price, unit: d.unit, store: d.brand?.name })),
        pantry: pantry.slice(0, 20).map((p: any) => ({ name: p.name, qty: p.qty })),
        cart: cart.filter(i => !i.purchased).slice(0, 10).map((c: any) => ({ name: c.name, price: c.price })),
      };
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    }
    setLoading(false);
  }

  if (!pos) return null;

  const W = maximized ? W_MAX : W_NORMAL;
  const H = maximized ? H_MAX : H_NORMAL;
  const panelAbove = pos.y > H + 20;
  const panelLeft  = pos.x + W > window.innerWidth - 8;

  const btnStyle = (active?: boolean) => ({
    background: "none", border: "none", cursor: "pointer",
    width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, color: active ? "var(--gold)" : "var(--text3)",
    transition: "background 0.15s",
  } as const);

  return (
    <div style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, userSelect: "none" }}>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: "absolute",
          ...(panelAbove ? { bottom: BTN + 10 } : { top: BTN + 10 }),
          ...(panelLeft  ? { right: 0 } : { left: 0 }),
          width: W,
          height: minimized ? "auto" : H,
          background: "var(--surf)",
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
          border: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.2s ease, height 0.2s ease",
          animation: "widgetPop 0.18s ease-out",
        }}>

          {/* Header / drag handle */}
          <div
            onMouseDown={startDrag} onTouchStart={startDrag}
            style={{
              padding: "11px 12px",
              background: "linear-gradient(135deg,rgba(245,166,35,0.14),rgba(245,166,35,0.04))",
              borderBottom: minimized ? "none" : "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "grab", flexShrink: 0,
            }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>KNOWBOTH AI</div>
              {!minimized && <div style={{ fontSize: 10, color: "var(--text3)" }}>Prices · Deals · Savings</div>}
            </div>
            {/* Window controls */}
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              {/* Minimize / restore */}
              <button
                onClick={e => { e.stopPropagation(); setMinimized(m => !m); setMaximized(false); }}
                title={minimized ? "Restore" : "Minimize"}
                style={btnStyle()}>
                {minimized ? "▲" : "▬"}
              </button>
              {/* Maximize / restore — hidden when minimized */}
              {!minimized && (
                <button
                  onClick={e => { e.stopPropagation(); setMaximized(m => !m); }}
                  title={maximized ? "Restore size" : "Expand"}
                  style={btnStyle(maximized)}>
                  {maximized ? "⊡" : "⊞"}
                </button>
              )}
              {/* Close */}
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); setMinimized(false); setMaximized(false); }}
                title="Close"
                style={btnStyle()}>
                ✕
              </button>
            </div>
          </div>

          {/* AI data notice — first use only */}
          {!minimized && showAiNotice && (
            <div style={{ margin:"8px 10px 0", padding:"10px 12px", background:"rgba(10,132,255,0.07)", border:"1px solid rgba(10,132,255,0.2)", borderRadius:12, display:"flex", gap:8, alignItems:"flex-start", flexShrink:0 }}>
              <span style={{fontSize:14,flexShrink:0}}>🔒</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text)",marginBottom:2}}>Privacy notice</div>
                <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.5}}>Your messages and shopping context (city, pantry, cart) are sent to <strong>Claude AI by Anthropic</strong> to generate responses. No personal IDs are included.</div>
              </div>
              <button
                onClick={()=>{ localStorage.setItem("kb_chat_notice","1"); setShowAiNotice(false); }}
                style={{background:"rgba(10,132,255,0.12)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:700,color:"#0A84FF",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const}}>
                Got it
              </button>
            </div>
          )}


          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: minimized ? "none" : "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                {m.role === "assistant" && (
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>✦</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 3, maxWidth: "80%" }}>
                  <div style={{
                    padding: "8px 11px",
                    borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                    background: m.role === "user" ? "linear-gradient(135deg,var(--gold),var(--gold-dim))" : "var(--bg)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    color: m.role === "user" ? "#000" : "var(--text)",
                    fontSize: 12, lineHeight: 1.55,
                    fontWeight: m.role === "user" ? 600 : 400,
                    whiteSpace: "pre-wrap" as const,
                  }}>
                    {m.content}
                  </div>
                  {m.role === "assistant" && ttsSupported && (
                    <button onClick={() => speak(m.content, i)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: speakingIdx === i ? "var(--gold)" : "var(--text3)", padding: "0 2px" }}>
                      {speakingIdx === i ? "⏹ Stop" : "🔊"}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✦</div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "14px 14px 14px 3px", padding: "8px 12px", display: "flex", gap: 3 }}>
                  {[0, 1, 2].map(j => <div key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ${j * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {!minimized && messages.length <= 1 && (
            <div style={{ padding: "0 10px 8px", display: "flex", gap: 5, flexWrap: "wrap" as const }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "4px 9px", fontSize: 10, color: "var(--text2)", cursor: "pointer", fontWeight: 600 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          {!minimized && <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {micSupported && (
              <button onClick={toggleMic}
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  background: listening ? "rgba(255,59,48,0.15)" : "var(--bg)",
                  color: listening ? "#FF3B30" : "var(--text2)",
                  boxShadow: listening ? "0 0 0 3px rgba(255,59,48,0.2)" : "none",
                }}>
                {listening ? "⏹" : "🎤"}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={listening ? "Listening..." : "Ask anything..."}
              disabled={loading}
              style={{
                flex: 1, background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 18, padding: "7px 12px", fontSize: 12, color: "var(--text)", outline: "none",
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
                background: "linear-gradient(135deg,var(--gold),var(--gold-dim))",
                color: "#000", fontSize: 15, fontWeight: 700,
                opacity: !input.trim() || loading ? 0.35 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>↑</button>
          </div>}
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onClick={onBtnClick}
        style={{
          width: BTN, height: BTN, borderRadius: "50%", border: "none", cursor: "pointer",
          background: open
            ? "var(--surf)"
            : "linear-gradient(135deg,var(--gold),var(--gold-dim))",
          boxShadow: open
            ? "0 4px 16px rgba(0,0,0,0.18)"
            : "0 6px 24px rgba(245,166,35,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: open ? 18 : 22,
          color: open ? "var(--text2)" : "#000",
          transition: "background 0.2s, box-shadow 0.2s",
          position: "relative",
        }}>
        {open ? "✕" : "✦"}
        {!open && unread > 0 && (
          <div style={{
            position: "absolute", top: 2, right: 2,
            width: 18, height: 18, borderRadius: "50%",
            background: "#FF3B30", color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg)",
          }}>{unread > 9 ? "9+" : unread}</div>
        )}
      </button>

      {/* Mic consent — fixed overlay, outside the panel */}
      {showMicNotice && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--surf)",borderRadius:18,padding:"24px 20px",boxShadow:"0 12px 40px rgba(0,0,0,0.25)",maxWidth:320,width:"100%"}}>
            <div style={{fontSize:26,textAlign:"center" as const,marginBottom:10}}>🎤</div>
            <div style={{fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:6,textAlign:"center" as const}}>Microphone access</div>
            <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:18,textAlign:"center" as const}}>
              Voice input is processed <strong>entirely by your browser</strong> using the Web Speech API. No audio is sent to KNOWBOTH or any external server.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowMicNotice(false)}
                style={{flex:1,padding:"10px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,fontSize:12,fontWeight:600,color:"var(--text2)",cursor:"pointer"}}>
                Cancel
              </button>
              <button onClick={acceptMicAndStart}
                style={{flex:2,padding:"10px",background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:10,fontSize:12,fontWeight:700,color:"#000",cursor:"pointer"}}>
                Allow Mic
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes widgetPop { from{opacity:0;transform:scale(0.92) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}
