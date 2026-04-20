"use client";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { CAT_ICONS } from "@/lib/utils";

const DEMO_BILLS = [
  {store:"Patel Brothers",cat:"Grocery",date:"Apr 19",amount:46.43,saved:4.70,status:"saved",pts:37},
  {store:"Shell Gas",cat:"Gas",date:"Apr 17",amount:52.00,saved:0,status:"even",pts:12},
  {store:"Biryani House",cat:"Restaurant",date:"Apr 15",amount:34.00,saved:-4.50,status:"overpaid",pts:8},
  {store:"CVS Pharmacy",cat:"Pharmacy",date:"Apr 12",amount:28.50,saved:-3.20,status:"overpaid",pts:18},
  {store:"India Bazaar",cat:"Grocery",date:"Apr 10",amount:38.20,saved:6.40,status:"saved",pts:29},
];

export default function ExpensesPage() {
  const { user } = useAppStore();
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [bills] = useState(DEMO_BILLS);
  const currency = user?.currency||"USD";
  const fmt = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency}).format(n);

  const filtered = bills.filter(b=>(filterCat==="All"||b.cat===filterCat)&&(filterStatus==="All"||b.status===filterStatus));
  const total = filtered.reduce((s,b)=>s+b.amount,0);
  const saved = filtered.filter(b=>b.status==="saved").reduce((s,b)=>s+b.saved,0);

  const cats = [...new Set(bills.map(b=>b.cat))];
  const catTotals: Record<string,number> = {};
  bills.forEach(b=>{ catTotals[b.cat]=(catTotals[b.cat]||0)+b.amount; });
  const maxCat = Math.max(...Object.values(catTotals));

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <Navbar />
      <div style={{maxWidth:800,margin:"0 auto",padding:"16px 14px"}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:4,color:"var(--text)"}}>Expenses</h1>
          <p style={{fontSize:12,color:"var(--text-muted)"}}>Track every bill by category</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
          <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
            <div style={{fontSize:22,fontWeight:900,color:"var(--gold)"}}>{fmt(total)}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Total Spent</div>
            <div style={{fontSize:10,color:"var(--teal)",marginTop:2}}>This month</div>
          </div>
          <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
            <div style={{fontSize:22,fontWeight:900,color:"var(--teal)"}}>{fmt(Math.max(0,saved))}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>Net Saved</div>
            <div style={{fontSize:10,color:"var(--gold)",marginTop:2}}>{bills.length} bills uploaded</div>
          </div>
        </div>

        <div style={{fontSize:13,fontWeight:700,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>By Category</div>
        <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",marginBottom:20}}>
          {Object.entries(catTotals).map(([cat,amt])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:18,width:28,textAlign:"center"}}>{CAT_ICONS[cat]||"🛒"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{cat}</div>
                <div style={{height:6,background:"var(--surf2)",borderRadius:3,overflow:"hidden",marginTop:4}}>
                  <div style={{height:"100%",borderRadius:3,background:"linear-gradient(90deg,var(--gold),var(--gold-dim))",width:`${(amt/maxCat)*100}%`}} />
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text)",minWidth:60,textAlign:"right"}}>{fmt(amt)}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",width:"100%",marginBottom:4}}>Bill History</div>
          <div style={{display:"flex",gap:6,overflowX:"auto",width:"100%",paddingBottom:4}}>
            {["All",...cats].map(c=>(
              <button key={c} onClick={()=>setFilterCat(c)} style={{borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",background:filterCat===c?"rgba(245,166,35,0.12)":"var(--surf2)",border:`1px solid ${filterCat===c?"rgba(245,166,35,0.3)":"var(--border)"}`,color:filterCat===c?"var(--gold)":"var(--text-muted)"}}>{c}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            {["All","saved","even","overpaid"].map(s=>(
              <button key={s} onClick={()=>setFilterStatus(s)} style={{borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",background:filterStatus===s?"rgba(245,166,35,0.12)":"var(--surf2)",border:`1px solid ${filterStatus===s?"rgba(245,166,35,0.3)":"var(--border)"}`,color:filterStatus===s?"var(--gold)":"var(--text-muted)",textTransform:"capitalize"}}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{background:"var(--surf)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          {filtered.length===0 && <div style={{padding:"30px",textAlign:"center",color:"var(--text-muted)",fontSize:13}}>No bills match filter</div>}
          {filtered.map((b,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:22,width:36,textAlign:"center"}}>{CAT_ICONS[b.cat]||"🛒"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{b.store}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{b.date} · {b.cat}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:900,color:"var(--gold)"}}>{fmt(b.amount)}</div>
                <div style={{fontSize:10,fontWeight:700,color:b.status==="saved"?"var(--teal)":b.status==="even"?"var(--gold)":"var(--red)"}}>{b.status==="saved"?`+${fmt(b.saved)} saved`:b.status==="even"?"Average":"Overpaid"}</div>
                <div style={{fontSize:9,color:"var(--text-dim)"}}>+{b.pts} pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
