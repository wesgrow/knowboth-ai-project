import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { b64, mime } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY!, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type:"image", source:{ type:"base64", media_type:mime, data:b64 } },
            { type:"text", text:`Extract all items from this receipt. Return ONLY valid JSON:
{"store_name":"","store_city":"","store_zip":"","purchase_date":"YYYY-MM-DD","currency":"USD","total":0,"items":[{"name":"","price":0,"quantity":1,"unit":"ea","category":"Grocery/Gas/Restaurant/Pharmacy/Household/Other"}]}` }
          ]
        }]
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    return NextResponse.json(parsed);
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status:500 });
  }
}
