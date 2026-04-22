"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

export function NotificationManager() {
  const { pantry } = useAppStore();
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    checkAlerts();
  }, [pantry]);

  function checkAlerts() {
    const low = pantry.filter(p=>p.qty<=1);
    if (low.length>0) {
      toast(`⚠️ ${low.length} item${low.length>1?"s":""} low in stock: ${low.slice(0,2).map(i=>i.name).join(", ")}`, { duration:5000, icon:"📦" });
    }
  }

  async function requestPermission() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p==="granted") {
      toast.success("🔔 Notifications enabled!");
      new Notification("KNOWBOTH.AI", { body:"You'll now get deal alerts and low stock reminders!", icon:"/icons/icon-192.png" });
    }
  }

  if (permission==="granted") return null;

  return (
    <div style={{ background:"rgba(245,166,35,0.06)", border:"1px solid rgba(245,166,35,0.25)", borderRadius:12, padding:"12px 14px", margin:"0 0 16px", display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ fontSize:20 }}>🔔</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>Enable Notifications</div>
        <div style={{ fontSize:11, color:"var(--text-muted)" }}>Get alerts for expiring deals & low stock</div>
      </div>
      <button onClick={requestPermission} className="btn-gold" style={{ padding:"6px 12px", fontSize:11 }}>Enable</button>
    </div>
  );
}
