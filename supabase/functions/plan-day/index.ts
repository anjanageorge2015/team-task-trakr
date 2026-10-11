import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const STOP = new Set(["road", "near", "kerala", "india", "street", "nagar", "opposite", "building", "floor", "district", "post"]);
const words = (s: string) =>
  new Set((s || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)));

type Plan = { taskId: string; engineerId: string | null; area: string; reason: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "Please sign in again" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "Admin" });
  if (!isAdmin) return json({ error: "Only admins can plan the day" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const taskIds: string[] = Array.isArray(body?.taskIds) ? body.taskIds.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
  const engineerIds: string[] = Array.isArray(body?.engineerIds) ? body.engineerIds.filter((x: unknown) => typeof x === "string").slice(0, 100) : [];
  const limit = Math.min(Math.max(Number(body?.limit) || 4, 1), 20);
  if (!taskIds.length || !engineerIds.length) return json({ error: "Pick at least one task and one engineer" }, 400);

  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [{ data: tasks, error: tErr }, { data: people }, { data: history }] = await Promise.all([
    supabase.from("tasks").select("id, scs_id, customer_name, customer_address, call_description, vendor:vendors(name)").in("id", taskIds),
    supabase.from("profiles").select("user_id, full_name").in("user_id", engineerIds),
    supabase.from("tasks").select("assigned_to, customer_address").in("assigned_to", engineerIds).gte("call_date", since).limit(5000),
  ]);
  if (tErr) return json({ error: tErr.message }, 500);

  // Area familiarity: words from addresses each engineer has worked at
  const known = new Map<string, Map<string, number>>();
  for (const h of history ?? []) {
    const m = known.get(h.assigned_to!) ?? new Map();
    for (const w of words(h.customer_address ?? "")) m.set(w, (m.get(w) ?? 0) + 1);
    known.set(h.assigned_to!, m);
  }
  const engineers = (people ?? []).map((p) => ({
    id: p.user_id,
    name: p.full_name || "Unnamed",
    knownAreas: [...(known.get(p.user_id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w]) => w),
  }));
  const calls = (tasks ?? []).map((t: any) => ({
    id: t.id, scsId: t.scs_id, customer: t.customer_name, address: t.customer_address ?? "",
    vendor: t.vendor?.name ?? "", problem: (t.call_description ?? "").slice(0, 120),
  }));

  // Deterministic fallback: area-match score, capacity-capped
  const fallback = (): Plan[] => {
    const load = new Map(engineers.map((e) => [e.id, 0]));
    return calls.map((c) => {
      const cw = words(c.address);
      let best: { id: string; score: number; hit: string } | null = null;
      for (const e of engineers) {
        if ((load.get(e.id) ?? 0) >= limit) continue;
        const m = known.get(e.id) ?? new Map();
        let score = 0, hit = "";
        for (const w of cw) if (m.has(w)) { score += m.get(w)!; hit ||= w; }
        score -= (load.get(e.id) ?? 0) * 0.5;
        if (!best || score > best.score) best = { id: e.id, score, hit };
      }
      if (best) load.set(best.id, (load.get(best.id) ?? 0) + 1);
      return {
        taskId: c.id, engineerId: best?.id ?? null, area: best?.hit || [...cw][0] || "Unknown",
        reason: !best ? "All engineers are full" : best.hit ? `Has worked in ${best.hit} before` : "Balancing workload",
      };
    });
  };

  // Validate any plan: known ids, capacity cap
  const enforce = (plan: Plan[]): Plan[] => {
    const load = new Map<string, number>();
    const byTask = new Map(plan.map((p) => [p.taskId, p]));
    return calls.map((c) => {
      const p = byTask.get(c.id);
      let eng = p?.engineerId && engineers.some((e) => e.id === p.engineerId) ? p.engineerId : null;
      if (eng && (load.get(eng) ?? 0) >= limit) eng = null;
      if (eng) load.set(eng, (load.get(eng) ?? 0) + 1);
      return { taskId: c.id, engineerId: eng, area: p?.area || "Unknown", reason: eng ? p?.reason || "" : "Needs manual pick" };
    });
  };

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ plan: fallback(), ai: false });

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          `You plan a day's field service visits in Kerala, India. Group calls by area/locality from the address (town, locality, nearby places). ` +
          `Assign each call to one engineer so each engineer covers one or a few nearby areas, minimising travel. ` +
          `Prefer engineers whose knownAreas match. Each engineer may get at most ${limit} calls. If capacity runs out, use null engineerId. ` +
          `Use only the given ids. "area" is a short locality name. "reason" under 12 words.`,
        input: JSON.stringify({ calls, engineers }),
        text: {
          format: {
            type: "json_schema", name: "day_plan", strict: true,
            schema: {
              type: "object", additionalProperties: false, required: ["assignments"],
              properties: {
                assignments: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["taskId", "engineerId", "area", "reason"],
                    properties: {
                      taskId: { type: "string" },
                      engineerId: { type: ["string", "null"] },
                      area: { type: "string" },
                      reason: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!r.ok || !r.body) {
      console.error("AI error", r.status, await r.text().catch(() => ""));
      return json({ plan: fallback(), ai: false });
    }
    let text = "", buf = "";
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        } catch { /* ignore */ }
      }
    }
    const parsed = JSON.parse(text || "{}");
    if (!Array.isArray(parsed.assignments)) return json({ plan: fallback(), ai: false });
    return json({ plan: enforce(parsed.assignments), ai: true });
  } catch (e) {
    console.error(e);
    return json({ plan: fallback(), ai: false });
  }
});
