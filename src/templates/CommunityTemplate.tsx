import { ReactNode } from "react";

interface Props { children: ReactNode; }

export function CommunityTemplate({ children }: Props) {
  return (
    <div className="page-body" style={{ background:"var(--bg)" }}>
      <div style={{ maxWidth:680, width:"100%", padding:"20px 16px 80px", margin:"0 auto" }}>
        {children}
      </div>
    </div>
  );
}
