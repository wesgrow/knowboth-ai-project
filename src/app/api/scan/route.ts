import { NextResponse } from "next/server";
import { scanBill } from "@/lib/claude";
export async function POST(req: Request) {
  try {
    const { b64, mime } = await req.json();
    if(!b64||!mime) return NextResponse.json({error:"Missing file"},{status:400});
    const result = await scanBill(b64, mime);
    return NextResponse.json(result);
  } catch(e:any) {
    return NextResponse.json({error:e.message},{status:500});
  }
}
