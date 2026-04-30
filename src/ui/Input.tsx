"use client";
import React from "react";

const base: React.CSSProperties = {
  width:"100%", background:"var(--bg)", border:"1px solid var(--border)",
  borderRadius:10, padding:"10px 12px", fontSize:14, color:"var(--text)",
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase"}}>{label}</label>}
      <input {...rest} style={{...base, borderColor:error?"#FF3B30":undefined, ...style}}/>
      {error&&<span style={{fontSize:11,color:"#FF3B30"}}>{error}</span>}
    </div>
  );
}
