"use client";
import React from "react";

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export function Chip({ active, onClick, children, color="#FF9F0A", style }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600,
        border:"none", cursor:onClick?"pointer":"default", fontFamily:"inherit",
        background:active?color:"var(--surf)",
        color:active?"#fff":"var(--text2)",
        transition:"all 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
