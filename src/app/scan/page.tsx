"use client";
import { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { CAT_ICONS } from "@/lib/utils";
import { isStockItem } from "@/app/stock/page";
import toast from "react-hot-toast";

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addPoints, moveToPantry, user } = useAppStore();

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  }

  function toB64(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function scan() {
    if (!file) return;
    setLoading(true);
    try {
      const b64 = await toB64(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b64, mime: file.type }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      // Route items: stock categories → inventory, others → purchase history
      const stockCount = (data.items || []).filter((i: any) => isStockItem(i.category)).length;
      const historyCount = (data.items || []).filter((i: any) => !isStockItem(i.category)).length;

      // Add to pantry/stock store
      (data.items || []).forEach((item: any) => {
        moveToPantry({
          id: `${Date.now()}-${Math.random()}`,
          name: item.name,
          price: item.price,
          unit: item.unit || "ea",
          store: data.store_name || "",
          category: item.category || "Other",
          icon: CAT_ICONS[item.category] || "🛒",
          qty: item.quantity || 1,
          purchased: true,
        });
      });

      const pts = 5 + (data.items?.length || 0) * 2;
      addPoints(pts);
      toast.success(`✦ +${pts} pts · ${stockCount} → Inventory · ${historyCount} → History`);
    } catch (e: any) {
      toast.error("Scan failed: " + e.message);
    }
    setLoading(false);
  }

  const totalPaid = result?.items?.reduce(
    (s: number, i: any) => s + (i.price * (i.quantity || 1)), 0
  ) || 0;

  const stockItems = result?.items?.filter((i: any) => isStockItem(i.category)) || [];
  const historyItems = result?.items?.filter((i: any) => !isStockItem(i.category)) || [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>
            Scan Any Bill
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Any store · Any category · Any language · Globally
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*,application/pdf"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          style={{ display: "none" }} />

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${file ? "var(--gold)" : "var(--border2)"}`,
            borderRadius: 14, padding: "28px 18px", textAlign: "center",
            cursor: "pointer", background: "var(--surf)", marginBottom: 12,
            transition: "border-color 0.2s",
          }}
        >
          {preview
            ? <img src={preview} alt="" style={{ maxHeight: 160, borderRadius: 8, objectFit: "contain" }} />
            : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: "var(--text)" }}>
                  Upload Your Bill
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  JPG · PNG · PDF · Tap or drag
                </div>
              </>
            )
          }
        </div>

        {file && (
          <button onClick={scan} disabled={loading} className="btn-gold"
            style={{ width: "100%", padding: 13, fontSize: 14, marginBottom: 16, opacity: loading ? 0.7 : 1 }}>
            {loading ? "🤖 Scanning with KNOWBOTH AI..." : "🤖 Scan with KNOWBOTH AI"}
          </button>
        )}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Store info */}
            <div style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                  🏪 {result.store_name || "Unknown Store"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{result.purchase_date}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                📍 {result.store_city} {result.store_zip} · {result.currency || "USD"}
              </div>
            </div>

            {/* Points */}
            <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--gold)" }}>
                +{5 + (result.items?.length || 0) * 2} pts ✦
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {result.items?.length || 0} items scanned
              </div>
            </div>

            {/* Routing summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--teal)" }}>{stockItems.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>📦 → Inventory</div>
              </div>
              <div style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--gold)" }}>{historyItems.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>📋 → History</div>
              </div>
            </div>

            {/* Items list */}
            <div style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                Scanned Items ({result.items?.length || 0})
              </div>
              {result.items?.map((item: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 18 }}>{CAT_ICONS[item.category] || "🛒"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {item.category} · qty {item.quantity || 1}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>
                      ${item.price?.toFixed(2)}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "1px 6px",
                      background: isStockItem(item.category) ? "rgba(0,212,170,0.1)" : "rgba(245,166,35,0.1)",
                      color: isStockItem(item.category) ? "var(--teal)" : "var(--gold)",
                      border: `1px solid ${isStockItem(item.category) ? "rgba(0,212,170,0.3)" : "rgba(245,166,35,0.3)"}`,
                    }}>
                      {isStockItem(item.category) ? "📦 Stock" : "📋 History"}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", background: "var(--surf2)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "var(--gold)" }}>
                  {result.currency || "$"}{(result.total || totalPaid).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
              ✅ Bill saved · Stock updated · Points earned
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
