"use client";
import { useState, useRef } from "react";
import { supabaseAuth } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval>|null>(null);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setCooldown(s => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function handleAuth() {
    if (inFlight.current || cooldown > 0) return;
    if (!email || !password) { toast.error("Fill all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    inFlight.current = true;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabaseAuth.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email to confirm!");
      } else {
        const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/home";
      }
    } catch(e: any) {
      const msg: string = e.message || "";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
        toast.error("Too many attempts — please wait 60 seconds and try again.");
        startCooldown(60);
      } else {
        toast.error(msg || "Authentication failed");
        startCooldown(5);
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    try {
      const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/home` }
      });
      if (error) throw error;
    } catch(e: any) {
      toast.error(e.message || "Google sign in failed");
      setGoogleLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email) { toast.error("Enter your email first"); return; }
    try {
      const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/home`,
      });
      if (error) throw error;
      toast.success("Password reset link sent!");
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:24}}>

      {/* Logo */}
      <div className="fade-up" style={{textAlign:"center",marginBottom:36,animationDelay:"0s"}}>
        <div style={{width:68,height:68,borderRadius:18,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(255,159,10,0.3)"}}>✦</div>
        <div style={{fontSize:28,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>KNOWBOTH<span style={{color:"#FF9F0A"}}>.AI</span></div>
        <div style={{fontSize:13,color:"var(--text2)",marginTop:5}}>Know Your Savings. Know Your Spending.</div>
      </div>

      {/* Card */}
      <div className="fade-up" style={{width:"100%",maxWidth:360,background:"var(--surf)",borderRadius:20,padding:"24px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)",animationDelay:"0.08s"}}>

        {/* Toggle */}
        <div style={{display:"flex",background:"var(--bg)",borderRadius:12,padding:3,marginBottom:22,gap:3}}>
          {(["login","signup"] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:mode===m?"var(--surf)":"transparent",color:mode===m?"var(--text)":"var(--text3)",boxShadow:mode===m?"0 1px 3px rgba(0,0,0,0.1)":"none",transition:"all 0.2s"}}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>

        {/* Google Button */}
        <button onClick={signInWithGoogle} disabled={googleLoading} style={{width:"100%",padding:13,background:"var(--surf)",border:"1.5px solid var(--border)",borderRadius:12,fontSize:14,fontWeight:600,color:"var(--text)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:16,opacity:googleLoading?0.7:1,boxShadow:"var(--shadow)"}}>
          {googleLoading
            ?<span style={{fontSize:14}}>Connecting...</span>
            :<><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="Google"/><span>Continue with Google</span></>
          }
        </button>

        {/* Divider */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{flex:1,height:1,background:"var(--border2)"}}/>
          <span style={{fontSize:12,color:"var(--text3)",fontWeight:500}}>or</span>
          <div style={{flex:1,height:1,background:"var(--border2)"}}/>
        </div>

        {/* Email */}
        <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:6}}>Email</div>
        <input
          style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none",marginBottom:14}}
          type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com"
          onKeyDown={e=>e.key==="Enter"&&handleAuth()}
        />

        {/* Password */}
        <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.6,textTransform:"uppercase" as const,marginBottom:6}}>Password</div>
        <input
          style={{width:"100%",background:"var(--bg)",border:"none",borderRadius:10,padding:"12px 14px",fontSize:16,color:"var(--text)",outline:"none",marginBottom:22}}
          type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={e=>e.key==="Enter"&&handleAuth()}
        />

        {/* Submit */}
        <button onClick={handleAuth} disabled={loading||cooldown>0} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",cursor:loading||cooldown>0?"not-allowed":"pointer",opacity:loading||cooldown>0?0.6:1,boxShadow:"0 4px 12px rgba(255,159,10,0.35)",letterSpacing:-0.2}}>
          {loading?"Loading...":cooldown>0?`Wait ${cooldown}s`:mode==="login"?"Sign In →":"Create Account →"}
        </button>

        {/* Forgot password */}
        {mode==="login"&&(
          <button onClick={forgotPassword} style={{background:"none",border:"none",color:"#0A84FF",fontSize:13,cursor:"pointer",width:"100%",marginTop:12,textAlign:"center",fontWeight:500}}>
            Forgot password?
          </button>
        )}
      </div>

      <div className="fade-up" style={{marginTop:20,fontSize:11,color:"var(--text3)",textAlign:"center",animationDelay:"0.16s"}}>
        By continuing, you agree to our Terms & Privacy Policy
      </div>

    </div>
  );
}
