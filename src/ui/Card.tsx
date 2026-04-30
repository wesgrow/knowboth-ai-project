"use client";
import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pad?: number|string;
  radius?: number|string;
  shadow?: boolean;
  border?: boolean;
}

export function Card({ pad=16, radius=16, shadow=true, border=false, style, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background:"var(--surf)",
        borderRadius:radius,
        padding:pad,
        boxShadow:shadow?"var(--shadow)":"none",
        border:border?"1px solid var(--border)":"none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
