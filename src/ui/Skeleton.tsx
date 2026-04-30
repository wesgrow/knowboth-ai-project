"use client";
import React from "react";

export interface SkeletonProps {
  h?: number|string;
  w?: number|string;
  radius?: number|string;
  style?: React.CSSProperties;
}

export function Skeleton({ h=20, w="100%", radius=8, style }: SkeletonProps) {
  return <div className="skel" style={{height:h,width:w,borderRadius:radius,...style}}/>;
}

export function SkeletonCard({ rows=3 }: { rows?: number }) {
  return (
    <div style={{background:"var(--surf)",borderRadius:16,padding:16,boxShadow:"var(--shadow)"}}>
      {Array.from({length:rows}).map((_,i)=>(
        <Skeleton key={i} h={i===0?18:13} w={i===0?"60%":"85%"}
          style={{marginBottom:i<rows-1?10:0}}/>
      ))}
    </div>
  );
}
