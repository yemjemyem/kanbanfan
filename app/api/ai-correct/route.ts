import { NextResponse } from "next/server";

const simpleCorrect = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const normalized = trimmed
    .replace(/\s+/g, " ")
    .replace(/\bi\b/g, "I")
    .replace(/\bteh\b/gi, "the")
    .replace(/\bcant\b/gi, "can't")
    .replace(/\bdont\b/gi, "don't");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string };
  const corrected = simpleCorrect(body.text ?? "");
  return NextResponse.json({ corrected });
}
