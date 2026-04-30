"use client";
import React from "react";

export type BadgeColor = "gold"|"green"|"red"|"blue"|"purple"|"gray";

const COLORS: Record<BadgeColor,React.CSSProperties> = {
  gold:   { background:"rgba(255,159,10,0.15)", color:"#FF9F0A" },
  green:  { background:"rgba(48,209,88,0.15)",  color:"#30D158" },
  red:    { background:"rgba(255,59,48,0.1)",   color:"#FF3B30" },
  blue:   { background:"rgba(10,132,255,0.1)",  color:"#0A84FF" },
  purple: { background:"rgba(175,82,222,0.1)",  color:"#AF52DE" },
  gray:   { background:"var(--bg)",             color:"var(--text3)" },
};

export interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({ color="gray", children, style }: BadgeProps) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",
      padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,
      ...COLORS[color],...style}}>
      {children}
    </span>
  );
}
