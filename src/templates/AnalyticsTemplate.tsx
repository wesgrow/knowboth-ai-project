import { ReactNode } from "react";

interface Props { children: ReactNode; }

export function AnalyticsTemplate({ children }: Props) {
  return (
    <div className="page-body">
      <div style={{ maxWidth:600, width:"100%", padding:"20px 20px 80px", margin:"0 auto" }}>
        {children}
      </div>
    </div>
  );
}
