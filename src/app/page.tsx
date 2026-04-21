"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

const AVATARS = ["🧑‍🍳","👩‍🛒","🧔","👩‍🌾","🧑‍💼","👨‍🍳","🙋‍♀️","🤵"];
const CURRENCIES = [
  {value:"USD",label:"USD — US Dollar ($)"},
  {value:"GBP",label:"GBP — British Pound (£)"},
  {value:"CAD",label:"CAD — Canadian Dollar (CA$)"},
  {value:"AED",label:"AED — UAE Dirham (د.إ)"},
  {value:"INR",label:"INR — Indian Rupee (₹)"},
  {value:"SGD",label:"SGD — Singapore Dollar (S$)"},
  {value:"AUD",label:"AUD — Australian Dollar (A$)"},
  {value:"EUR",label:"EUR — Euro (€)"},
];

export default function Home() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧑‍🍳");
  const [currency, setCurrency] = useState("USD");
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState<"dark"|"light"|"auto">("dark");

  useEffect(() => {
    if (user) router.push("/deals");
  }, [user, router]);

  function parseLocation(raw: string) {
    const parts = raw.trim().split(/[\s,]+/);
    const zip = parts.find(p => /^\d{5}/.test(p)) || "75074";
    const city = parts.filter(p => !/^\d/.test(p)).join(" ") || "DFW";
    return { zip, city };
  }

  function join() {
    if (!name.trim()) return;
    const { zip, city } = parseLocation(location);
    setUser({
      name: name.trim(),
      avatar,
      currency,
      zip,
      city,
      theme,
      points: 0,
    });
    router.push("/deals");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 380,
        background: "var(--surf)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: "32px 24px",
      }}>

      {/* Logo */}
<div style={{ textAlign: "center", marginBottom: 28 }}>
  <div
    style={{
      fontSize: 44,
      color: "var(--gold)",
      marginBottom: 8,
    }}
  >
    ✦
  </div>

  <div
    style={{
      fontSize: 26,
      fontWeight: 900,
      color: "var(--gold)",
      lineHeight: 1.1,
      letterSpacing: 3,
    }}
  >
    KNOWBOTH
    <span style={{ display: "block" }}>.AI</span>
  </div>

  <div
    style={{
      fontSize: 12,
      color: "var(--text-muted)",
      marginTop: 8,
    }}
  >
    Know Your Savings. Know Your Spending.
  </div>

  <div
    style={{
      fontSize: 11,
      color: "var(--gold)",
      marginTop: 4,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    }}
  >
    Know Both. Always.
  </div>
</div>


        {/* Name */}
        <div style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Your Name
        </div>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter your name..."
          style={{ marginBottom: 16 }}
          onKeyDown={e => e.key === "Enter" && join()}
        />

        {/* Avatar */}
        <div style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Avatar
        </div>
        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
        }}>
          {AVATARS.map(a => (
            <div
              key={a}
              onClick={() => setAvatar(a)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: avatar === a
                  ? "rgba(245,166,35,0.12)"
                  : "var(--surf2)",
                border: `2px solid ${avatar === a
                  ? "var(--gold)"
                  : "var(--border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {a}
            </div>
          ))}
        </div>

        {/* Theme */}
        <div style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Theme
        </div>
        <div style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}>
          {(["dark","light","auto"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                flex: 1,
                padding: "8px 4px",
                background: theme === t
                  ? "rgba(245,166,35,0.12)"
                  : "var(--surf2)",
                border: `1px solid ${theme === t
                  ? "var(--gold)"
                  : "var(--border)"}`,
                color: theme === t
                  ? "var(--gold)"
                  : "var(--text-muted)",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t === "dark"
                ? "🌙 Dark"
                : t === "light"
                ? "☀️ Light"
                : "⚙️ Auto"}
            </button>
          ))}
        </div>

        {/* Location — single smart input */}
        <div style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Your Location
        </div>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-dim)",
            fontSize: 14,
          }}>
            📍
          </span>
          <input
            className="input"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City, ZIP (e.g. Dallas 75074)"
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Currency */}
        <div style={{
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Currency
        </div>
        <select
          className="input"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{ marginBottom: 24, cursor: "pointer" }}
        >
          {CURRENCIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Join Button */}
        <button
          className="btn-gold"
          onClick={join}
          disabled={!name.trim()}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 15,
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          Know Both. Always. →
        </button>

      </div>
    </div>
  );
}