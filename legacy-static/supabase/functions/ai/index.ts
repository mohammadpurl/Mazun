// Supabase Edge Function: AI for size advice, styling, arrival advice and virtual try-on.
// Secrets (set with `supabase secrets set`): ANTHROPIC_API_KEY, GEMINI_API_KEY
// Optional: CLAUDE_MODEL (default claude-sonnet-5-5), IMAGE_MODEL (default gemini-2.5-flash-image)

const CORS = {
  "Access-Control-Allow-Origin": "*", // tighten to your site's origin in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const LANG: Record<string, string> = { fa: "Persian (Farsi)", ar: "Arabic", en: "English" };
const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5";
const IMAGE_MODEL = Deno.env.get("IMAGE_MODEL") ?? "gemini-2.5-flash-image";

async function claude(system: string, content: unknown[], max = 500): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error("claude " + r.status + " " + (await r.text()));
  const d = await r.json();
  return d.content.map((c: { text?: string }) => c.text ?? "").join("").trim();
}

function splitDataUrl(u: string) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(u);
  if (!m) throw new Error("bad image");
  return { mime: m[1], data: m[2] };
}
const tooBig = (s: unknown, n: number) => typeof s === "string" && s.length > n;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json();
    const lang = LANG[b.lang] ?? "English";
    if (tooBig(b.photo, 2_500_000) || tooBig(b.person, 2_500_000)) return json({ error: "image too large" }, 413);

    if (b.action === "size") {
      const content: unknown[] = [];
      if (b.photo) { const p = splitDataUrl(b.photo); content.push({ type: "image", source: { type: "base64", media_type: p.mime, data: p.data } }); }
      content.push({
        type: "text",
        text: `Customer height ${Number(b.height)} cm, weight ${Number(b.weight)} kg${b.photo ? " (a photo is attached)" : ""}.
Garment size chart (cm): ${JSON.stringify(b.chart)}. Stock: ${JSON.stringify(b.sizes)}.
Pick the best size that is in stock (ok=true). Abayas are worn loose, so prefer comfort. Check the garment length against the customer's height.
Reply ONLY with JSON: {"size":"<size name>","reason":"<2 short sentences in ${lang}>"}`,
      });
      const t = await claude("You are a precise, friendly fitting assistant for an abaya shop.", content, 300);
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      return json({ size: String(j.size), reason: String(j.reason ?? "") });
    }

    if (b.action === "style") {
      const content: unknown[] = [];
      if (typeof b.image === "string" && b.image.startsWith("http")) content.push({ type: "image", source: { type: "url", url: b.image } });
      content.push({ type: "text", text: `Garment: ${String(b.garment).slice(0, 120)}. Occasion: ${String(b.occasion).slice(0, 40)}.
Give 4 short, concrete styling tips (scarf, shoes, bag, accessories, colours) in ${lang}. Modest, elegant, no markdown.` });
      return json({ text: await claude("You are a modest-fashion stylist.", content, 400) });
    }

    if (b.action === "arrive") {
      const text = await claude(
        "You are a delivery planner for an abaya shop. Be brief and reassuring.",
        [{ type: "text", text: `Event date ${b.event}, today ${b.today}. Earliest arrival if ordered today: ${b.earliest}. Latest safe order date: ${b.latest}. Total lead time ${b.total} days plus a ${b.buffer}-day buffer.
Write 2 short sentences in ${lang} advising the customer when to order. Do not change any of the dates.` }], 200);
      return json({ text });
    }

    if (b.action === "tryon") {
      const person = splitDataUrl(b.person);
      const g = await fetch(String(b.garment));
      if (!g.ok) throw new Error("garment fetch");
      const gb = new Uint8Array(await g.arrayBuffer());
      let bin = ""; for (let i = 0; i < gb.length; i += 0x8000) bin += String.fromCharCode(...gb.subarray(i, i + 0x8000));
      const gmime = g.headers.get("content-type") ?? "image/png";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": Deno.env.get("GEMINI_API_KEY") ?? "", "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [
          { text: "Virtual try-on. Image 1 is the customer, image 2 is an abaya. Dress the customer in the abaya from image 2, keeping her face, pose, body shape and the background unchanged and the garment's design, colour and embroidery exact. Photorealistic." },
          { inline_data: { mime_type: person.mime, data: person.data } },
          { inline_data: { mime_type: gmime, data: btoa(bin) } },
        ] }] }),
      });
      if (!r.ok) throw new Error("image " + r.status + " " + (await r.text()));
      const d = await r.json();
      const part = d.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData) as
        { inlineData: { mimeType: string; data: string } } | undefined;
      if (!part) throw new Error("no image returned");
      return json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
