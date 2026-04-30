import { ReactNode } from "react";

interface Props { children: ReactNode; }

export function HomeTemplate({ children }: Props) {
  return (
    <div style={{ background:"var(--bg)", minHeight:"100vh", paddingBottom:32 }}>
      <div style={{ maxWidth:720, width:"100%", margin:"0 auto", padding:"20px 18px" }}>
        {children}
      </div>
    </div>
  );
}
