"use client";
import React from "react";

const base: React.CSSProperties = {
  width:"100%", background:"var(--bg)", border:"1px solid var(--border)",
  borderRadius:10, padding:"10px 12px", fontSize:14, color:"var(--text)",
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};

export interface SelectOption { id: string; label: string; }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>,"onChange"> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
  error?: string;
}

export function Select({ label, options, placeholder, onChange, error, style, ...rest }: SelectProps) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase"}}>{label}</label>}
      <select {...rest} onChange={e=>onChange?.(e.target.value)} style={{...base,...style}}>
        {placeholder&&<option value="">{placeholder}</option>}
        {options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {error&&<span style={{fontSize:11,color:"#FF3B30"}}>{error}</span>}
    </div>
  );
}
