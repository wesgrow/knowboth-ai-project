"use client";
import { useEffect, ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxW?: number;
  label?: string;
}

export function Modal({ open, onClose, children, maxW=480, label }: ModalProps) {
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
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:16,backdropFilter:"blur(8px)"}}
    >
      <div style={{background:"var(--surf)",borderRadius:20,padding:"24px 20px",
        width:"100%",maxWidth:maxW,maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}
