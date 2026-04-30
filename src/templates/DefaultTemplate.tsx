import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  maxW?: number;
  pad?: string;
}

export function DefaultTemplate({ children, maxW=600, pad="20px 20px 80px" }: Props) {
  return (
    <div className="page-body">
      <div style={{ maxWidth:maxW, width:"100%", padding:pad, margin:"0 auto" }}>
        {children}
      </div>
    </div>
  );
}
