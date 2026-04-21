// src/components/PriceSource.tsx
// Reusable component — shows price source on every price display

interface PriceSourceProps {
  storeName?: string;
  branchName?: string;
  lastUpdated?: string;
  source?: "receipt" | "flyer" | "manual" | null;
  size?: "sm" | "md";
}

export function PriceSource({
  storeName,
  branchName,
  lastUpdated,
  source,
  size = "sm",
}: PriceSourceProps) {
  const fontSize = size === "sm" ? 10 : 12;

  function getSourceIcon() {
    if (source === "receipt") return "🧾";
    if (source === "flyer") return "📄";
    if (source === "manual") return "✏️";
    return "📍";
  }

  function getTimeAgo(ts: string) {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  if (!storeName && !lastUpdated) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
      marginTop: 3,
    }}>
      {storeName && (
        <span style={{
          fontSize,
          color: "var(--text-dim)",
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}>
          {getSourceIcon()}
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
            {storeName}
          </span>
          {branchName && (
            <span style={{ color: "var(--text-dim)" }}>· {branchName}</span>
          )}
        </span>
      )}
      {lastUpdated && (
        <span style={{
          fontSize,
          color: "var(--text-dim)",
        }}>
          · {getTimeAgo(lastUpdated)}
        </span>
      )}
    </div>
  );
}
