"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

const AVATARS=["🧑‍🍳","👩‍🛒","🧔","👩‍🌾","🧑‍💼","👨‍🍳","🙋‍♀️","🤵","👩‍💻","🧑‍🔬","👩‍🎨","🧑‍🚀"];
const CURRENCIES=[{value:"USD",label:"US Dollar",symbol:"$"},{value:"GBP",label:"British Pound",symbol:"£"},{value:"CAD",label:"Canadian Dollar",symbol:"CA$"},{value:"AED",label:"UAE Dirham",symbol:"د.إ"},{value:"INR",label:"Indian Rupee",symbol:"₹"},{value:"SGD",label:"Singapore Dollar",symbol:"S$"},{value:"AUD",label:"Australian Dollar",symbol:"A$"},{value:"EUR",label:"Euro",symbol:"€"}];
const STEPS=["Welcome","Name","Avatar","Location","Currency","Theme"];

export default function OnboardingPage() {
  const router=useRouter();
  const {user,setUser}=useAppStore();
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [avatar,setAvatar]=useState("🧑‍🍳");
  const [currency,setCurrency]=useState("USD");
  const [location,setLocation]=useState("");
  const [theme,setTheme]=useState<"dark"|"light"|"auto">("light");
  const [gpsLoading,setGpsLoading]=useState(false);

  useEffect(()=>{if(user)router.push("/home");},[user,router]);

  function next(){if(step<STEPS.length-1)setStep(s=>s+1);}
  function back(){if(step>0)setStep(s=>s-1);}

  function useGPS(){
    if(!navigator.geolocation){alert("GPS not supported");return;}
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const{latitude,longitude}=pos.coords;
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data=await res.json();
        const zip=data.address?.postcode||"";
        const city=data.address?.city||data.address?.town||"";
        setLocation(`${city} ${zip}`.trim());
      }catch{}
      setGpsLoading(false);
    },()=>{setGpsLoading(false);});
  }

  function finish(){
    if(!name.trim())return;
    const parts=location.trim().split(/[\s,]+/);
    const zip=parts.find(p=>/^\d{5}/.test(p))||"75074";
    const city=parts.filter(p=>!/^\d/.test(p)).join(" ")||"DFW";
    setUser({name:name.trim(),avatar,currency,zip,city,theme,points:0});
    router.push("/home");
  }

  const progress=(step/(STEPS.length-1))*100;

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",padding:24,maxWidth:400,margin:"0 auto"}}>

      {/* Progress */}
      <div style={{paddingTop:20,marginBottom:32}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <button onClick={back} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:16,cursor:step>0?"pointer":"default",opacity:step>0?1:0}}>← Back</button>
          <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:500}}>{step+1} of {STEPS.length}</div>
          {step<STEPS.length-1&&<button onClick={()=>router.push("/home")} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:13,cursor:"pointer"}}>Skip</button>}
          {step===STEPS.length-1&&<div style={{width:40}} />}
        </div>
        <div style={{height:4,background:"var(--surf2)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,var(--gold),var(--gold-dim))",borderRadius:2,transition:"width 0.4s ease"}} />
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column"}}>

        {/* Step 0: Welcome */}
        {step===0&&(
          <div style={{textAlign:"center",paddingTop:20}}>
            <div style={{width:80,height:80,borderRadius:22,background:"linear-gradient(135deg,#FF9F0A,#D4800A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,margin:"0 auto 24px",boxShadow:"0 8px 24px rgba(255,159,10,0.4)"}}>✦</div>
            <div style={{fontSize:30,fontWeight:700,color:"var(--text)",letterSpacing:-0.8,marginBottom:10}}>Welcome to<br/><span style={{color:"var(--gold)"}}>KNOWBOTH.AI</span></div>
            <div style={{fontSize:15,color:"var(--text-muted)",lineHeight:1.6,letterSpacing:-0.2,marginBottom:32}}>Know Your Savings.<br/>Know Your Spending.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32}}>
              {["🏷️  Compare grocery prices near you","🧾  Scan any bill instantly","📊  Track all your expenses","🤖  AI-powered savings tips"].map(f=>(
                <div key={f} style={{background:"var(--surf)",borderRadius:12,padding:"13px 16px",fontSize:14,fontWeight:500,color:"var(--text)",textAlign:"left",boxShadow:"var(--shadow-sm)"}}>
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Name */}
        {step===1&&(
          <div style={{paddingTop:10}}>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)",letterSpacing:-0.6,marginBottom:6}}>What's your name?</div>
            <div style={{fontSize:14,color:"var(--text-muted)",marginBottom:28}}>We'll personalize your experience.</div>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name..." autoFocus
              style={{fontSize:18,padding:"16px",marginBottom:8}}
              onKeyDown={e=>e.key==="Enter"&&name.trim()&&next()} />
          </div>
        )}

        {/* Step 2: Avatar */}
        {step===2&&(
          <div style={{paddingTop:10}}>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)",letterSpacing:-0.6,marginBottom:6}}>Pick your avatar</div>
            <div style={{fontSize:14,color:"var(--text-muted)",marginBottom:24}}>This will show in your profile.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {AVATARS.map(a=>(
                <div key={a} onClick={()=>setAvatar(a)} style={{aspectRatio:"1",borderRadius:16,background:avatar===a?"rgba(255,159,10,0.12)":"var(--surf)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:"pointer",boxShadow:avatar===a?"0 0 0 2px var(--gold), var(--shadow-sm)":"var(--shadow-sm)",transition:"all 0.15s"}}>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step===3&&(
          <div style={{paddingTop:10}}>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)",letterSpacing:-0.6,marginBottom:6}}>Your location</div>
            <div style={{fontSize:14,color:"var(--text-muted)",marginBottom:24}}>Find deals near you.</div>
            <button onClick={useGPS} style={{width:"100%",padding:"15px",background:"rgba(48,209,88,0.1)",border:"none",borderRadius:14,fontSize:15,fontWeight:600,color:"var(--teal)",cursor:"pointer",marginBottom:12,boxShadow:"var(--shadow-sm)"}}>
              {gpsLoading?"Detecting...":"📡 Use My Location (GPS)"}
            </button>
            <div style={{textAlign:"center",fontSize:13,color:"var(--text-dim)",marginBottom:12}}>or enter manually</div>
            <input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="City, ZIP (e.g. Dallas 75074)" style={{fontSize:16}} />
          </div>
        )}

        {/* Step 4: Currency */}
        {step===4&&(
          <div style={{paddingTop:10}}>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)",letterSpacing:-0.6,marginBottom:6}}>Your currency</div>
            <div style={{fontSize:14,color:"var(--text-muted)",marginBottom:24}}>Used for all price displays.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {CURRENCIES.map(c=>(
                <div key={c.value} onClick={()=>setCurrency(c.value)} style={{background:"var(--surf)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",boxShadow:currency===c.value?"0 0 0 2px var(--gold), var(--shadow-sm)":"var(--shadow-sm)",transition:"all 0.15s"}}>
                  <div style={{width:40,height:40,borderRadius:10,background:currency===c.value?"rgba(255,159,10,0.12)":"var(--surf2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:currency===c.value?"var(--gold)":"var(--text-muted)"}}>{c.symbol}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{c.label}</div>
                    <div style={{fontSize:12,color:"var(--text-muted)"}}>{c.value}</div>
                  </div>
                  {currency===c.value&&<div style={{width:22,height:22,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>✓</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Theme */}
        {step===5&&(
          <div style={{paddingTop:10}}>
            <div style={{fontSize:26,fontWeight:700,color:"var(--text)",letterSpacing:-0.6,marginBottom:6}}>Choose your theme</div>
            <div style={{fontSize:14,color:"var(--text-muted)",marginBottom:24}}>You can change this anytime.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[{v:"light",label:"Light",desc:"Clean and bright",icon:"☀️"},{v:"dark",label:"Dark",desc:"Easy on the eyes",icon:"🌙"},{v:"auto",label:"Auto",desc:"Matches your device",icon:"⚙️"}].map(t=>(
                <div key={t.v} onClick={()=>setTheme(t.v as any)} style={{background:"var(--surf)",borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",boxShadow:theme===t.v?"0 0 0 2px var(--gold), var(--shadow-sm)":"var(--shadow-sm)",transition:"all 0.15s"}}>
                  <div style={{fontSize:28}}>{t.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{t.label}</div>
                    <div style={{fontSize:13,color:"var(--text-muted)"}}>{t.desc}</div>
                  </div>
                  {theme===t.v&&<div style={{width:22,height:22,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>✓</div>}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* CTA Button */}
      <div style={{paddingTop:20}}>
        {step<STEPS.length-1?(
          <button className="btn-gold" onClick={()=>step===1&&!name.trim()?null:next()} style={{width:"100%",padding:16,fontSize:16,opacity:step===1&&!name.trim()?0.5:1,letterSpacing:-0.3}}>
            Continue →
          </button>
        ):(
          <button className="btn-gold" onClick={finish} style={{width:"100%",padding:16,fontSize:16,letterSpacing:-0.3}}>
            Start Saving ✦
          </button>
        )}
      </div>
    </div>
  );
}
