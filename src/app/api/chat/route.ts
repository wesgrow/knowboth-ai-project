import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();
    const system = `You are KNOWBOTH AI — a smart shopping assistant for grocery price intelligence.
You help users find cheapest prices, compare stores, track expenses, and maximize savings.
Be concise, friendly, and always cite store names and prices from the provided data.
User context: ${JSON.stringify(context)}
Only use data provided. Never hallucinate prices or store names.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version":"2023-06-01",
      },
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:500,
        system,
        messages: messages.map((m:any)=>({ role:m.role, content:m.content })),
      }),
    });
    const data = await res.json();
    return NextResponse.json({ reply: data.content?.[0]?.text||"" });
  } catch(e:any) {
    return NextResponse.json({ error:e.message }, { status:500 });
  }
}
