import { NextResponse } from "next/server";

const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg","image/jpg","image/png","image/webp","image/gif","application/pdf"];

const VALID_CATEGORIES = [
  "Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices",
  "Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household","Other"
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms/1000}s`)), ms)
    ),
  ]);
}

function extractJSON(text: string): any {
  if (!text || typeof text !== "string") throw new Error("Empty response from AI");
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) throw new Error("No valid JSON found in AI response");
  try {
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e: any) {
    throw new Error(`JSON parse failed: ${e.message}`);
  }
}

function sanitizeItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && typeof item === "object")
    .map((item, idx) => ({
      name: String(item.name || `Item ${idx + 1}`).trim().slice(0, 200),
      normalized_name: String(item.normalized_name || item.name || "").toLowerCase().trim().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,""),
      price: Math.max(0, parseFloat(item.price) || 0),
      regular_price: item.regular_price ? Math.max(0, parseFloat(item.regular_price)) : null,
      unit: String(item.unit || "ea").trim().slice(0, 20),
      category: VALID_CATEGORIES.includes(item.category) ? item.category : "Other",
      notes: String(item.notes || "").trim().slice(0, 500),
    }))
    .filter(item => item.name.length > 0 && item.price > 0);
}

async function callClaudeWithRetry(content: any[], attempt = 1): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  try {
    const response = await withTimeout(
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content }]
        }),
      }),
      TIMEOUT_MS
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      if ((response.status === 529 || response.status === 500) && attempt <= MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return callClaudeWithRetry(content, attempt + 1);
      }
      throw new Error(`Claude API error: ${errMsg}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error("Empty response from Claude API");
    return text;

  } catch (e: any) {
    if (attempt <= MAX_RETRIES && (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("timed out"))) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return callClaudeWithRetry(content, attempt + 1);
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    // 1. Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { store, b64, mime, url } = body;

    if (!store || typeof store !== "string" || store.trim().length === 0) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }

    // 2. Build content
    const content: any[] = [];

    if (b64 && mime) {
      // Validate image
      if (!ALLOWED_MIME_TYPES.includes(mime.toLowerCase())) {
        return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 400 });
      }
      const approxBytes = (b64.length * 3) / 4;
      if (approxBytes > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large. Maximum size is 10MB.` }, { status: 400 });
      }
      content.push({ type: "image", source: { type: "base64", media_type: mime, data: b64 } });
    } else if (url) {
      if (typeof url !== "string" || !url.startsWith("http")) {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
      }
      content.push({ type: "text", text: `Extract deals from this URL: ${url}` });
    } else {
      return NextResponse.json({ error: "Either image (b64+mime) or URL is required" }, { status: 400 });
    }

    content.push({ type: "text", text: `Extract ALL deal items from this grocery flyer for store: ${store.trim()}.

Category must be exactly one of: Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Bakery, Meat & Fish, Household, Other.

Return ONLY valid JSON, no markdown, no backticks:
{"items":[{"name":"Toor Dal 4lb","normalized_name":"toor dal 4lb","price":4.99,"regular_price":6.99,"unit":"bag","category":"Lentils & Dals","notes":""}]}

Rules:
- name = full product name with brand and size. Expand all abbreviations.
- normalized_name = lowercase version of name
- price = sale/deal price (required, must be > 0)
- regular_price = original price before sale (null if not shown)
- unit = lb, kg, oz, bag, pack, box, bottle, bunch, ea
- Extract every item with a visible price
- No trailing commas in JSON` });

    // 3. Call Claude
    const rawText = await callClaudeWithRetry(content);

    // 4. Parse JSON
    const parsed = extractJSON(rawText);

    // 5. Sanitize items
    const items = sanitizeItems(parsed.items || []);

    if (items.length === 0) {
      return NextResponse.json({
        error: "No valid deals found. Make sure prices are visible in the flyer."
      }, { status: 422 });
    }

    return NextResponse.json({ items });

  } catch (e: any) {
    console.error("Extract API error:", e);
    const message = e.message || "Unknown error";
    if (message.includes("timed out")) return NextResponse.json({ error: "Request timed out. Try a smaller image." }, { status: 504 });
    if (message.includes("API key")) return NextResponse.json({ error: "AI service not configured." }, { status: 503 });
    if (message.includes("JSON")) return NextResponse.json({ error: "Could not read flyer. Try a clearer image." }, { status: 422 });
    return NextResponse.json({ error: `Extraction failed: ${message}` }, { status: 500 });
  }
}
