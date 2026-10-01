// Voice-to-task: transcribe recorded audio, then extract task fields with Lovable AI.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const GATEWAY = "https://ai.gateway.lovable.dev";
const STT_MODEL = "google/gemini-3.5-transcribe";
const CHAT_MODEL = "openai/gpt-6-astra";
const MAX_BYTES = 12 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readSSE(res: Response, onEvent: (ev: any) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try { onEvent(JSON.parse(data)); } catch { /* ignore partial */ }
    }
  }
}

async function errorFrom(res: Response, stage: string) {
  const text = await res.text().catch(() => "");
  let message = text;
  try { const j = JSON.parse(text); message = j?.error?.message || j?.message || text; } catch { /* keep */ }
  if (res.status === 402) message = message || "AI credits exhausted. Please add credits to continue.";
  if (res.status === 429) message = "Too many requests right now. Please try again in a minute.";
  return json({ error: `${stage}: ${message || "request failed"}` }, res.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES + 1024 * 1024) return json({ error: "Recording is too long" }, 413);

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || !audio.size) return json({ error: "No audio received" }, 400);
    if (audio.size > MAX_BYTES) return json({ error: "Recording is too long" }, 413);
    const vendors: string[] = JSON.parse(String(form.get("vendors") || "[]"));
    const team: string[] = JSON.parse(String(form.get("team") || "[]"));
    const today = String(form.get("today") || new Date().toISOString().slice(0, 10));

    // 1) Transcribe
    const baseType = (audio.type || "audio/webm").split(";")[0].replace("video/", "audio/");
    const file = new File([await audio.arrayBuffer()], audio.name || "voice.webm", { type: baseType });
    const sttForm = new FormData();
    sttForm.append("model", STT_MODEL);
    sttForm.append("file", file, file.name);
    sttForm.append("response_format", "json");
    sttForm.append("stream", "true");
    const sttRes = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: sttForm,
      signal: req.signal,
    });
    if (!sttRes.ok) return await errorFrom(sttRes, "Transcription failed");
    let transcript = "";
    let deltas = "";
    await readSSE(sttRes, (ev) => {
      if (ev.type === "transcript.text.delta" && ev.delta) deltas += ev.delta;
      if (ev.type === "transcript.text.done" && typeof ev.text === "string") transcript = ev.text;
    });
    transcript = (transcript || deltas).trim();
    if (!transcript) return json({ error: "Could not hear anything. Please speak clearly and try again." }, 422);

    // 2) Extract fields
    const nullableStr = { type: ["string", "null"] };
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        vendorCallId: nullableStr,
        vendor: { type: ["string", "null"], description: "Must be one of the known vendors exactly, or null" },
        callDescription: nullableStr,
        callDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
        customerName: nullableStr,
        customerAddress: nullableStr,
        amount: { type: ["number", "null"] },
        assignedTo: { type: ["string", "null"], description: "Must be one of the team members exactly, or null" },
        salesPerson: { type: ["string", "null"], description: "Must be one of the team members exactly, or null" },
        remarks: nullableStr,
      },
      required: ["vendorCallId", "vendor", "callDescription", "callDate", "customerName", "customerAddress", "amount", "assignedTo", "salesPerson", "remarks"],
    };
    const instructions = `You fill a service-call task form for SmartCore CRM from a spoken note. The note may be in English, Malayalam, or a mix. Write all output field values in English (transliterate names/addresses to English letters).
Today is ${today}. Resolve relative dates like "today", "tomorrow", "yesterday".
Known vendors: ${JSON.stringify(vendors)}. Pick the closest match or null.
Team members: ${JSON.stringify(team)}. Pick the closest match for engineer (assignedTo) and sales person, or null.
callDescription = the problem/work described (include product, model, serial if mentioned). Use null for anything not mentioned. Never invent values.`;

    const aiRes = await fetch(`${GATEWAY}/v1/responses`, {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        instructions,
        input: `Spoken note transcript:\n"""${transcript}"""`,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "task_fields", strict: true, schema } },
      }),
    });
    if (!aiRes.ok) return await errorFrom(aiRes, "AI extraction failed");
    let out = "";
    let failure = "";
    await readSSE(aiRes, (ev) => {
      if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      if (ev.type === "response.failed" || ev.type === "error") failure = ev?.response?.error?.message || ev?.message || "AI failed";
      if (ev.type === "response.incomplete") failure = "AI response was incomplete";
    });
    if (failure && !out) return json({ error: failure, transcript }, 502);
    let fields: Record<string, unknown> = {};
    try { fields = JSON.parse(out); } catch { return json({ error: "AI returned an unreadable result", transcript }, 502); }
    return json({ transcript, fields });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("voice-task error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
