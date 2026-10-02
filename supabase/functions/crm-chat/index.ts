import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "npm:ai";
import { z } from "npm:zod@3";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const STATUS_LABEL: Record<string, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  on_hold: "On Hold",
  closed: "Closed",
  settled: "Settled",
  repeat: "Repeat",
};

const inc = (s?: string | null, q?: string | null) =>
  !q || (s ?? "").toLowerCase().includes(q.toLowerCase());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !userData.user) return json({ error: "Please sign in again" }, 401);

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  const isAdmin = roles.includes("Admin");
  const isCoordinator = roles.includes("Coordinator");
  const showMoney = !isCoordinator;

  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const loadTasks = async (from: string | null, to: string | null) => {
    const rows: any[] = [];
    for (let page = 0; page < 10; page++) {
      let q = supabase
        .from("tasks")
        .select(
          `scs_id, vendor_call_id, call_description, call_date, customer_name, customer_address,
           amount, commission_percentage, status, created_at,
           vendor:vendors(name),
           assigned_profile:profiles!tasks_assigned_to_fkey(full_name),
           sales_profile:profiles!tasks_sales_person_fkey(full_name)`,
        )
        .order("call_date", { ascending: false })
        .range(page * 1000, page * 1000 + 999);
      if (from) q = q.gte("call_date", from);
      if (to) q = q.lte("call_date", to);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };

  const taskReport = tool({
    description:
      "Get task report data: counts, totals and optional grouping, plus matching task rows. Use for any question about tasks, calls, pending work, vendors, engineers, sales persons, amounts or commission.",
    inputSchema: z.object({
      fromDate: z.string().nullable().describe("Call date from, YYYY-MM-DD, or null"),
      toDate: z.string().nullable().describe("Call date to, YYYY-MM-DD, or null"),
      statuses: z
        .array(z.enum(["unassigned", "assigned", "on_hold", "closed", "settled", "repeat"]))
        .nullable()
        .describe("Filter by statuses, or null for all"),
      vendor: z.string().nullable().describe("Vendor name contains, e.g. DELL"),
      engineer: z.string().nullable().describe("Assigned engineer name contains"),
      salesPerson: z.string().nullable().describe("Sales person name contains"),
      customer: z.string().nullable().describe("Customer name or address contains"),
      groupBy: z
        .enum(["vendor", "status", "engineer", "sales_person", "month", "none"])
        .describe("How to group the summary"),
      rowLimit: z.number().describe("How many task rows to return (0-50)"),
    }),
    execute: async (i) => {
      const all = await loadTasks(i.fromDate, i.toDate);
      const today = Date.now();
      const filtered = all.filter(
        (t) =>
          (!i.statuses || i.statuses.length === 0 || i.statuses.includes(t.status)) &&
          inc(t.vendor?.name, i.vendor) &&
          inc(t.assigned_profile?.full_name, i.engineer) &&
          inc(t.sales_profile?.full_name, i.salesPerson) &&
          (inc(t.customer_name, i.customer) || inc(t.customer_address, i.customer)),
      );
      const money = (t: any) => Number(t.amount) || 0;
      const comm = (t: any) => (money(t) * (Number(t.commission_percentage) || 0)) / 100;
      const key = (t: any) => {
        switch (i.groupBy) {
          case "vendor": return t.vendor?.name || "No vendor";
          case "status": return STATUS_LABEL[t.status] ?? t.status;
          case "engineer": return t.assigned_profile?.full_name || "Unassigned";
          case "sales_person": return t.sales_profile?.full_name || "None";
          case "month": return String(t.call_date).slice(0, 7);
          default: return null;
        }
      };
      const groups: Record<string, any> = {};
      if (i.groupBy !== "none") {
        for (const t of filtered) {
          const k = key(t)!;
          groups[k] ??= { count: 0, ...(showMoney ? { amount: 0, commission: 0 } : {}) };
          groups[k].count++;
          if (showMoney) {
            groups[k].amount += money(t);
            groups[k].commission += comm(t);
          }
        }
      }
      const limit = Math.max(0, Math.min(50, Math.round(i.rowLimit || 0)));
      return {
        totalTasks: filtered.length,
        ...(showMoney
          ? {
              totalAmount: filtered.reduce((s, t) => s + money(t), 0),
              totalCommission: filtered.reduce((s, t) => s + comm(t), 0),
            }
          : { note: "Financial figures are hidden for your role." }),
        groups,
        rows: filtered.slice(0, limit).map((t) => ({
          scsId: t.scs_id,
          vendorCallId: t.vendor_call_id,
          vendor: t.vendor?.name ?? null,
          callDate: t.call_date,
          customer: t.customer_name,
          address: t.customer_address,
          description: t.call_description,
          status: STATUS_LABEL[t.status] ?? t.status,
          engineer: t.assigned_profile?.full_name ?? null,
          salesPerson: t.sales_profile?.full_name ?? null,
          pendingDays: Math.floor((today - new Date(t.created_at).getTime()) / 86400000),
          ...(showMoney ? { amount: money(t), commissionPercent: Number(t.commission_percentage) || 0 } : {}),
        })),
      };
    },
  });

  const vehicleReport = tool({
    description:
      "Get vehicle details: insurance, PUC, fitness, permit, road tax expiry, next service due, plus service spend and income totals. Admin only.",
    inputSchema: z.object({
      registration: z.string().nullable().describe("Registration number contains, or null for all"),
    }),
    execute: async ({ registration }) => {
      if (!isAdmin) return { error: "Vehicle data is available to admins only." };
      const [{ data: vehicles, error }, { data: exp }, { data: incm }] = await Promise.all([
        supabase.from("vehicles").select("*").order("registration_number"),
        supabase.from("vehicle_service_expenses").select("vehicle_id, amount, service_date"),
        supabase.from("vehicle_income").select("vehicle_id, amount, income_date"),
      ]);
      if (error) return { error: error.message };
      const sum = (rows: any[] | null, id: string) =>
        (rows ?? []).filter((r) => r.vehicle_id === id).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      return {
        today: new Date().toISOString().slice(0, 10),
        vehicles: (vehicles ?? [])
          .filter((v) => inc(v.registration_number, registration))
          .map((v) => ({
            registration: v.registration_number,
            type: v.vehicle_type === "four_wheeler" ? "Four wheeler" : "Two wheeler",
            model: v.make_model,
            owner: v.owner_name,
            insuranceExpiry: v.insurance_expiry,
            pucExpiry: v.puc_expiry,
            fitnessExpiry: v.fitness_expiry,
            permitExpiry: v.permit_expiry,
            roadTaxExpiry: v.road_tax_expiry,
            nextServiceDue: v.next_service_due,
            serviceSpend: sum(exp, v.id),
            income: sum(incm, v.id),
          })),
      };
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the SmartCore CRM assistant. Today is ${today}. Currency is Indian Rupees (₹).
Answer questions about tasks and reports${isAdmin ? " and vehicles" : ""} using the tools. Never invent numbers; always call a tool first.
Task statuses: Unassigned, Assigned, On Hold, Closed, Settled, Repeat. "Pending" or "open" means Unassigned, Assigned or On Hold.
"This month" means from the 1st of the current month to today. Expiring soon means within 30 days.
${showMoney ? "" : "The user is a Coordinator: never mention amounts, revenue, commission or any money values."}
${isAdmin ? "" : "Vehicle data is admin only; if asked, politely say so."}
Reply concisely in the user's language. Use markdown tables for lists and short bullet summaries.`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    messages: await convertToModelMessages(messages),
    tools: isAdmin ? { taskReport, vehicleReport } : { taskReport },
    stopWhen: stepCountIs(50),
    abortSignal: req.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: (e: any) => {
        const status = e?.statusCode ?? e?.status;
        if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
        if (status === 402) return "AI credits are used up. Please add credits in workspace billing.";
        if (status === 403) return "AI access is blocked for this workspace.";
        console.error("crm-chat error", e);
        return "Something went wrong answering that. Please try again.";
      },
    }),
    runIdFetch,
    corsHeaders,
  );
});
