"use client";
import { useEffect, ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxW?: number;
  label?: string;
}

export function BottomSheet({ open, onClose, children, maxW=480, label }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key==="Escape"&&onClose();
    document.addEventListener("keydown",h);
    return ()=>document.removeEventListener("keydown",h);
  },[open,onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog" aria-modal="true" aria-label={label}
      onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,
        display:"flex",alignItems:"flex-end",justifyContent:"center",
        backdropFilter:"blur(6px)"}}
    >
      <div style={{background:"var(--surf)",borderRadius:"20px 20px 0 0",
        padding:"20px 20px 40px",width:"100%",maxWidth:maxW,
        maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}
