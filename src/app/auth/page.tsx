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
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:68,height:68,borderRadius:18,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(255,159,10,0.3)"}}>✦</div>
        <div style={{fontSize:26,fontWeight:800,color:"#1C1C1E",letterSpacing:-0.8}}>KNOWBOTH<span style={{color:"#FF9F0A"}}>.AI</span></div>
        <div style={{fontSize:13,color:"#6D6D72",marginTop:5,letterSpacing:-0.1}}>Know Your Savings. Know Your Spending.</div>
      </div>

      {/* Card */}
      <div style={{width:"100%",maxWidth:360,background:"#fff",borderRadius:20,padding:"24px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>

        {/* Toggle */}
        <div style={{display:"flex",background:"#F2F2F7",borderRadius:12,padding:3,marginBottom:22,gap:3}}>
          {(["login","signup"] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:10,border:"none",background:mode===m?"#fff":"transparent",color:mode===m?"#1C1C1E":"#AEAEB2",boxShadow:mode===m?"0 1px 3px rgba(0,0,0,0.1)":"none",transition:"all 0.2s"}}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>

        {/* Email */}
        <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,marginBottom:6}}>EMAIL</div>
        <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"12px 14px",fontSize:15,color:"#1C1C1E",outline:"none",marginBottom:14}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        {/* Password */}
        <div style={{fontSize:11,fontWeight:600,color:"#AEAEB2",letterSpacing:0.5,marginBottom:6}}>PASSWORD</div>
        <input style={{width:"100%",background:"#F2F2F7",border:"none",borderRadius:10,padding:"12px 14px",fontSize:15,color:"#1C1C1E",outline:"none",marginBottom:22}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleAuth()} />

        {/* Submit */}
        <button onClick={handleAuth} disabled={loading} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",border:"none",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",opacity:loading?0.7:1,boxShadow:"0 4px 12px rgba(255,159,10,0.35)",letterSpacing:-0.2}}>
          {loading?"Loading...":mode==="login"?"Sign In →":"Create Account →"}
        </button>

        {/* Forgot */}
        {mode==="login"&&(
          <button onClick={async()=>{if(!email){toast.error("Enter email first");return;}await supabaseAuth.auth.resetPasswordForEmail(email);toast.success("Reset link sent!");}}
            style={{background:"none",border:"none",color:"#0A84FF",fontSize:13,cursor:"pointer",width:"100%",marginTop:12,textAlign:"center",fontWeight:500}}>
            Forgot password?
          </button>
        )}
      </div>

      <div style={{marginTop:20,fontSize:11,color:"#AEAEB2",textAlign:"center"}}>
        By continuing, you agree to our Terms & Privacy Policy
      </div>
    </div>
  );
}
