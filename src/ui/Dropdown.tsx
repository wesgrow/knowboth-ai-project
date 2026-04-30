"use client";
import React, { useState, useRef, useEffect } from "react";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: "left"|"right";
}

export function Dropdown({ trigger, items, onSelect, align="right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}>
      <div onClick={()=>setOpen(p=>!p)} style={{cursor:"pointer"}}>{trigger}</div>
      {open&&(
        <div style={{
          position:"absolute", top:"calc(100% + 6px)",
          [align==="right"?"right":"left"]:0,
          background:"var(--surf)", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,0.18)",
          border:"1px solid var(--border)", zIndex:150, minWidth:160, overflow:"hidden",
        }}>
          {items.map(item=>(
            <button key={item.id}
              onClick={()=>{onSelect(item.id);setOpen(false);}}
              style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", padding:"11px 14px", background:"none", border:"none",
                fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                color:item.danger?"#FF3B30":"var(--text)",
                textAlign:"left",
              }}
            >
              {item.icon&&<span>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
