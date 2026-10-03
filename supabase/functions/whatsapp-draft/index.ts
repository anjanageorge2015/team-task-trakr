import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "../_shared/run-id.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!u.user) return json({ error: "Please sign in again" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const { task, recipient, language, note } = body ?? {};
  if (!task || !["customer", "engineer"].includes(recipient)) return json({ error: "Invalid request" }, 400);

  const details = {
    scsId: task.scsId, vendorCallId: task.vendorCallId, vendor: task.vendor,
    customer: task.customerName, address: task.customerAddress, problem: task.callDescription,
    callDate: task.callDate, status: task.status, engineer: task.assignedTo || null, remarks: task.remarks || null,
  };

  const prompt = `Write a short, polite WhatsApp message from SmartCore (a computer service company) to the ${
    recipient === "customer"
      ? "customer about their service call status. Do not include internal remarks, vendor call IDs or any amounts."
      : "assigned engineer giving them the job details they need (customer, address, problem, call IDs, remarks)."
  }
Language: ${language === "malayalam" ? "Malayalam (Malayalam script)" : "English"}.
Use WhatsApp formatting (*bold* for labels), under 120 words, no placeholders like [Name]. Output only the message text.
${note ? `Extra instruction from staff: ${note}` : ""}
Task details: ${JSON.stringify(details)}`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      prompt,
      abortSignal: req.signal,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });
    const text = (await result.text).trim();
    if (!text) return json({ error: "The AI could not write this message." }, 502);
    return json({ message: text });
  } catch (e: any) {
    const s = e?.statusCode ?? e?.status;
    if (s === 429) return json({ error: "Too many requests. Please wait a moment." }, 429);
    if (s === 402) return json({ error: "AI credits are used up. Please add credits." }, 402);
    if (s === 403) return json({ error: "AI access is blocked for this workspace." }, 403);
    console.error(e);
    return json({ error: "Could not draft the message. Please try again." }, 500);
  }
});
