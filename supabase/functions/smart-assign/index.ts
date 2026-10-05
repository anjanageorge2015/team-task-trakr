import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const words = (s: string) =>
  new Set((s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "Please sign in again" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const { vendor = "", customerName = "", customerAddress = "", callDescription = "" } = body ?? {};

  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [{ data: people }, { data: tasks, error }] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name"),
    supabase
      .from("tasks")
      .select("assigned_to, status, customer_name, customer_address, vendor:vendors(name)")
      .gte("call_date", since)
      .not("assigned_to", "is", null)
      .limit(5000),
  ]);
  if (error) return json({ error: error.message }, 500);

  const addr = words(`${customerAddress} ${customerName}`);
  const stats = (people ?? []).filter((p) => p.full_name).map((p) => {
    const mine = (tasks ?? []).filter((t: any) => t.assigned_to === p.user_id);
    const open = mine.filter((t: any) => ["assigned", "on_hold"].includes(t.status)).length;
    const done = mine.filter((t: any) => ["closed", "settled"].includes(t.status)).length;
    const sameVendor = vendor ? mine.filter((t: any) => (t.vendor?.name ?? "").toLowerCase() === vendor.toLowerCase()).length : 0;
    const sameCustomer = customerName ? mine.filter((t: any) => (t.customer_name ?? "").toLowerCase() === customerName.toLowerCase()).length : 0;
    const nearby = mine.filter((t: any) => {
      const w = words(t.customer_address ?? "");
      for (const x of addr) if (w.has(x)) return true;
      return false;
    }).length;
    const score = sameVendor * 2 + nearby * 3 + sameCustomer * 4 + done * 0.5 - open * 3;
    return { name: p.full_name as string, open, done, sameVendor, sameCustomer, nearby, score };
  }).filter((s) => s.open + s.done + s.sameVendor > 0);

  stats.sort((a, b) => b.score - a.score);
  const top = stats.slice(0, 8);
  const fallback = top.slice(0, 3).map((s) => ({
    name: s.name,
    reason: `${s.open} open now, ${s.nearby} jobs nearby, ${s.sameVendor} for this vendor`,
  }));
  if (top.length === 0) return json({ suggestions: [] });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ suggestions: fallback });
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You assign field service jobs. Pick the best 3 engineers from the list (exact names only). Prefer low open workload, experience near the same address/customer, and with the same vendor. Reply JSON: {"suggestions":[{"name":"...","reason":"short, under 15 words"}]}',
          },
          {
            role: "user",
            content: JSON.stringify({
              job: { vendor, customerName, customerAddress, callDescription },
              engineersLast180Days: top,
            }),
          },
        ],
      }),
    });
    if (!r.ok) return json({ suggestions: fallback });
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content ?? "{}");
    const valid = (parsed.suggestions ?? []).filter((s: any) => top.some((t) => t.name === s.name)).slice(0, 3);
    return json({ suggestions: valid.length ? valid : fallback });
  } catch {
    return json({ suggestions: fallback });
  }
});
