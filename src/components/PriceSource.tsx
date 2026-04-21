interface PriceSourceProps {
  storeName?: string;
  branchName?: string;
  lastUpdated?: string;
  source?: "receipt" | "flyer" | "manual" | null;
  size?: "sm" | "md";
}

export function PriceSource({ storeName, branchName, lastUpdated, source, size="sm" }: PriceSourceProps) {
  const fs = size === "sm" ? 10 : 12;

  const srcIcon = source === "receipt" ? "🧾" : source === "flyer" ? "📄" : source === "manual" ? "✏️" : "📍";
  const srcLabel = source === "receipt" ? "Receipt" : source === "flyer" ? "Flyer" : source === "manual" ? "Manual" : null;

  function timeAgo(ts: string) {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    return `${d}d ago`;
  }

  if (!storeName && !lastUpdated) return null;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap", marginTop:3 }}>
      <span style={{ fontSize:fs, color:"var(--text-dim)", display:"flex", alignItems:"center", gap:3 }}>
        {srcIcon}
        {storeName && <span style={{ color:"var(--text-muted)", fontWeight:600 }}>{storeName}</span>}
        {branchName && <span style={{ color:"var(--text-dim)" }}>· {branchName}</span>}
        {srcLabel && (
          <span style={{
            borderRadius:20, padding:"1px 6px", fontSize:fs-1, fontWeight:700,
            background: source==="receipt" ? "rgba(0,212,170,0.1)" : source==="flyer" ? "rgba(245,166,35,0.1)" : "rgba(144,144,168,0.1)",
            color: source==="receipt" ? "var(--teal)" : source==="flyer" ? "var(--gold)" : "var(--text-muted)",
            border: `1px solid ${source==="receipt" ? "rgba(0,212,170,0.25)" : source==="flyer" ? "rgba(245,166,35,0.25)" : "rgba(144,144,168,0.2)"}`,
          }}>{srcLabel}</span>
        )}
        {lastUpdated && <span style={{ color:"var(--text-dim)" }}>· {timeAgo(lastUpdated)}</span>}
      </span>
    </div>
  );
}
