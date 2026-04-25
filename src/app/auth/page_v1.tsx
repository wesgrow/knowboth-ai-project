"use client";
import { useState } from "react";
import { supabaseAuth } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if(!email||!password){toast.error("Fill all fields");return;}
    setLoading(true);
    try{
      if(mode==="signup"){
        const{error}=await supabaseAuth.auth.signUp({email,password});
        if(error)throw error;
        toast.success("Check email to confirm!");
      }else{
        const{error}=await supabaseAuth.auth.signInWithPassword({email,password});
        if(error)throw error;
        window.location.href="/home";
      }
    }catch(e:any){toast.error(e.message);}
    setLoading(false);
  }

  return(
    <div style={{minHeight:"100vh",background:"#F2F2F7",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      {/* Logo */}
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(255,159,10,0.4)"}}>✦</div>
        <div style={{fontSize:28,fontWeight:700,color:"var(--text)",letterSpacing:-0.8}}>KNOWBOTH<span style={{color:"var(--gold)"}}>.AI</span></div>
        <div style={{fontSize:14,color:"var(--text-muted)",marginTop:6,letterSpacing:-0.2}}>Know Your Savings. Know Your Spending.</div>
      </div>

      {/* Card */}
      <div style={{width:"100%",maxWidth:360,background:"var(--surf)",borderRadius:24,padding:"28px 24px",boxShadow:"var(--shadow-lg)"}}>
        {/* Toggle */}
        <div style={{display:"flex",background:"var(--surf2)",borderRadius:12,padding:3,marginBottom:24,gap:3}}>
          {(["login","signup"] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:mode===m?"var(--surf)":"transparent",color:mode===m?"var(--text)":"var(--text-muted)",boxShadow:mode===m?"var(--shadow-sm)":"none",transition:"all 0.2s",letterSpacing:-0.2}}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>

        <div style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.3,marginBottom:6}}>EMAIL</div>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com" style={{marginBottom:14}}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        <div style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",letterSpacing:0.3,marginBottom:6}}>PASSWORD</div>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="••••••••" style={{marginBottom:24}}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        <button className="btn-gold" onClick={handleAuth} disabled={loading}
          style={{width:"100%",padding:15,fontSize:16,opacity:loading?0.7:1,letterSpacing:-0.3}}>
          {loading?"Loading...":mode==="login"?"Sign In →":"Create Account →"}
        </button>

        {mode==="login"&&(
          <button onClick={async()=>{if(!email){toast.error("Enter email first");return;}await supabaseAuth.auth.resetPasswordForEmail(email);toast.success("Reset link sent!");}}
            style={{background:"none",border:"none",color:"var(--blue)",fontSize:14,cursor:"pointer",width:"100%",marginTop:14,textAlign:"center",fontWeight:500}}>
            Forgot password?
          </button>
        )}
      </div>

      <div style={{marginTop:24,fontSize:12,color:"var(--text-dim)",textAlign:"center"}}>
        By continuing, you agree to our Terms & Privacy Policy
      </div>
    </div>
  );
}
