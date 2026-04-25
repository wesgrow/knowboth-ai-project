import { NextResponse } from "next/server";

const VALID_CATS = ["Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Bakery","Meat & Fish","Household","Other"];

export async function POST(req: Request) {
  try {
    const { store, b64, mime, url } = await req.json();

    const content: any[] = [];
    if (b64 && mime) {
      content.push({ type:"image", source:{ type:"base64", media_type:mime, data:b64 } });
    }
    content.push({ type:"text", text:`Extract ALL deal items from this grocery flyer for store: ${store}.

Rules:
- category MUST be exactly one of: Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Bakery, Meat & Fish, Household, Other
- price must be a number like 4.99
- Return ONLY valid JSON, no markdown, no trailing commas, no comments

Format:
{"items":[{"name":"Toor Dal 4lb","normalized_name":"toor dal 4lb","price":4.99,"regular_price":6.99,"unit":"bag","category":"Lentils & Dals","notes":""}]}
${url ? `URL: ${url}` : ""}` });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role:"user", content }]
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude API error");

    let text = data.content?.[0]?.text || "";

    // Clean up common JSON issues
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    text = text.replace(/,(\s*[}\]])/g, "$1"); // remove trailing commas
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // remove control chars

    // Extract JSON object
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in response");
    text = text.substring(start, end + 1);

    const parsed = JSON.parse(text);
    const items = (parsed.items || []).map((i: any) => ({
      ...i,
      category: VALID_CATS.includes(i.category) ? i.category : "Other",
      price: parseFloat(i.price) || 0,
      regular_price: i.regular_price ? parseFloat(i.regular_price) : null,
    }));

    return NextResponse.json({ items });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
