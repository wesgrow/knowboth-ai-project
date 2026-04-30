"use client";
import React from "react";

export type BtnVariant = "primary"|"ghost"|"danger"|"success"|"link";
export type BtnSize    = "xs"|"sm"|"md"|"lg";

const V: Record<BtnVariant, React.CSSProperties> = {
  primary: { background:"linear-gradient(135deg,#FF9F0A,#D4800A)", color:"#fff", border:"none", boxShadow:"0 4px 12px rgba(255,159,10,0.28)" },
  ghost:   { background:"var(--bg)",  color:"var(--text2)", border:"1px solid var(--border)" },
  danger:  { background:"rgba(255,59,48,0.08)", color:"#FF3B30", border:"1px solid rgba(255,59,48,0.2)" },
  success: { background:"rgba(48,209,88,0.1)",  color:"#30D158", border:"none" },
  link:    { background:"none", color:"var(--gold)", border:"none", padding:0, boxShadow:"none" },
};
const S: Record<BtnSize, React.CSSProperties> = {
  xs: { padding:"4px 8px",   fontSize:11, borderRadius:7,  fontWeight:600 },
  sm: { padding:"7px 12px",  fontSize:12, borderRadius:8,  fontWeight:600 },
  md: { padding:"10px 16px", fontSize:14, borderRadius:10, fontWeight:600 },
  lg: { padding:"13px 22px", fontSize:15, borderRadius:12, fontWeight:700 },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: React.ReactNode;
  full?: boolean;
}

export function Button({
  variant="primary", size="md", loading, icon, full, children, style, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled||loading}
      style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        gap:6, fontFamily:"inherit", cursor:disabled||loading?"not-allowed":"pointer",
        opacity:disabled||loading?0.6:1, transition:"all 0.15s", userSelect:"none",
        width:full?"100%":undefined,
        ...V[variant], ...S[size], ...style,
      }}
    >
      {icon&&<span style={{display:"flex",lineHeight:1}}>{icon}</span>}
      {loading?"…":children}
    </button>
  );
}
