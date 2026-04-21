"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if (!email || !password) { toast.error("Fill all fields"); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check email to confirm signup!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/deals");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, background:"var(--surf)", border:"1px solid var(--border)", borderRadius:20, padding:"32px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44, color:"var(--gold)", marginBottom:8 }}>✦</div>
          <div style={{ fontSize:24, fontWeight:900, color:"var(--gold)" }}>KNOWBOTH.AI</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>Know Your Savings. Know Your Spending.</div>
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {(["login","signup"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex:1, padding:"9px", fontSize:13, fontWeight:700, cursor:"pointer",
              borderRadius:10, border:"none", textTransform:"capitalize",
              background: mode===m ? "rgba(245,166,35,0.12)" : "var(--surf2)",
              color: mode===m ? "var(--gold)" : "var(--text-muted)",
              outline: mode===m ? "1px solid rgba(245,166,35,0.35)" : "1px solid var(--border)",
            }}>{m === "login" ? "Sign In" : "Sign Up"}</button>
          ))}
        </div>

        <div style={{ marginBottom:6, fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" }}>Email</div>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com" style={{ marginBottom:14 }}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        <div style={{ marginBottom:6, fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:1.5, textTransform:"uppercase" }}>Password</div>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="••••••••" style={{ marginBottom:24 }}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        <button className="btn-gold" onClick={handleAuth} disabled={loading}
          style={{ width:"100%", padding:14, fontSize:15, opacity:loading?0.7:1 }}>
          {loading ? "Loading..." : mode==="login" ? "Sign In →" : "Create Account →"}
        </button>

        {mode==="login" && (
          <button onClick={async()=>{ if(!email){toast.error("Enter email first");return;} await supabase.auth.resetPasswordForEmail(email); toast.success("Reset link sent!"); }}
            style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:12, cursor:"pointer", width:"100%", marginTop:12, textAlign:"center" }}>
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
