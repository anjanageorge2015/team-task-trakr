import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

const LIMIT = 4;
const NONE = "__none";

type Call = { id: string; scs_id: string; customer_name: string; customer_address: string | null; status: string; call_date: string };
type Person = { user_id: string; full_name: string | null };
type Plan = { taskId: string; engineerId: string | null; area: string; reason: string };

export default function DailyPlanner({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selCalls, setSelCalls] = useState<Set<string>>(new Set());
  const [selEng, setSelEng] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idSearch, setIdSearch] = useState("");

  const load = async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("tasks").select("id, scs_id, customer_name, customer_address, status, call_date")
        .in("status", ["unassigned", "on_hold"]).order("call_date", { ascending: false }).limit(300),
      supabase.from("profiles").select("user_id, full_name").order("full_name"),
    ]);
    setCalls((t as Call[]) ?? []);
    setPeople(((p as Person[]) ?? []).filter((x) => x.full_name));
    setSelCalls(new Set(((t as Call[]) ?? []).filter((c) => c.status === "unassigned").map((c) => c.id)));
  };
  useEffect(() => { load(); }, []);

  const name = (id: string | null) => people.find((p) => p.user_id === id)?.full_name ?? "Not assigned";
  const toggle = (s: Set<string>, id: string, set: (v: Set<string>) => void) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); set(n);
  };

  const propose = async () => {
    if (!selCalls.size || !selEng.size) return toast({ title: "Select tasks and available engineers first" });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("plan-day", {
      body: { taskIds: [...selCalls], engineerIds: [...selEng], limit: LIMIT },
    });
    setBusy(false);
    if (error || data?.error) return toast({ variant: "destructive", title: "Could not plan", description: data?.error || error?.message });
    setPlan(data.plan);
    if (!data.ai) toast({ title: "Planned without AI", description: "Used past areas and workload instead." });
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    plan?.forEach((p) => p.engineerId && m.set(p.engineerId, (m.get(p.engineerId) ?? 0) + 1));
    return m;
  }, [plan]);

  const confirm = async () => {
    if (!plan) return;
    const over = [...counts.entries()].filter(([, n]) => n > LIMIT);
    if (over.length) return toast({ variant: "destructive", title: `${name(over[0][0])} has more than ${LIMIT} calls` });
    const todo = plan.filter((p) => p.engineerId);
    if (!todo.length) return toast({ title: "Nothing to assign" });
    setSaving(true);
    const results = await Promise.all(todo.map((p) =>
      supabase.from("tasks").update({ assigned_to: p.engineerId, status: "assigned" }).eq("id", p.taskId)));
    setSaving(false);
    const failed = results.filter((r) => r.error).length;
    toast(failed
      ? { variant: "destructive", title: `${todo.length - failed} assigned, ${failed} failed` }
      : { title: `${todo.length} tasks assigned` });
    setPlan(null); setSelEng(new Set());
    await load(); onDone?.();
  };

  const callById = (id: string) => calls.find((c) => c.id === id);
  const callById = (id: string) => calls.find((c) => c.id === id);
  const filteredCalls = useMemo(() => {
    const terms = idSearch.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!terms.length) return calls;
    return calls.filter((c) => terms.some((t) => c.scs_id?.toUpperCase().includes(t) || c.id.toUpperCase().includes(t)));
  }, [calls, idSearch]);
  const groups = useMemo(() => {
    const g = new Map<string, Plan[]>();
    plan?.forEach((p) => { const k = p.engineerId ?? NONE; g.set(k, [...(g.get(k) ?? []), p]); });
    return [...g.entries()].sort((a, b) => (a[0] === NONE ? 1 : b[0] === NONE ? -1 : 0));
  }, [plan]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daily Planner</h1>
        <p className="text-sm text-muted-foreground">Pick today's calls and available engineers. AI groups calls by area, up to {LIMIT} per engineer. Review, then confirm.</p>
      </div>

      {!plan && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Calls ({selCalls.size} selected)</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelCalls(new Set(calls.map((c) => c.id)))}>All</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelCalls(new Set())}>None</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {calls.length === 0 && <p className="text-sm text-muted-foreground">No unassigned or on-hold calls.</p>}
              {calls.map((c) => (
                <label key={c.id} className="flex items-start gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent">
                  <Checkbox checked={selCalls.has(c.id)} onCheckedChange={() => toggle(selCalls, c.id, setSelCalls)} className="mt-1" />
                  <div className="text-sm min-w-0">
                    <div className="font-medium">{c.scs_id} · {c.customer_name} {c.status === "on_hold" && <Badge variant="outline" className="ml-1">On Hold</Badge>}</div>
                    <div className="text-muted-foreground truncate">{c.customer_address || "No address"}</div>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Available engineers ({selEng.size}) · can take {selEng.size * LIMIT} calls</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {people.map((p) => (
                <label key={p.user_id} className="flex items-center gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent">
                  <Checkbox checked={selEng.has(p.user_id)} onCheckedChange={() => toggle(selEng, p.user_id, setSelEng)} />
                  <span className="text-sm">{p.full_name}</span>
                </label>
              ))}
              <Button className="w-full mt-4" onClick={propose} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Propose plan
              </Button>
              {selCalls.size > selEng.size * LIMIT && selEng.size > 0 && (
                <p className="text-xs text-muted-foreground">More calls than capacity — some will be left for you to pick.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {plan && (
        <>
          <div className="space-y-4">
            {groups.map(([eng, items]) => (
              <Card key={eng}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{eng === NONE ? "Not assigned" : name(eng)}</CardTitle>
                  {eng !== NONE && (
                    <Badge variant={(counts.get(eng) ?? 0) > LIMIT ? "destructive" : "secondary"}>{counts.get(eng) ?? 0}/{LIMIT} calls</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((p) => {
                    const c = callById(p.taskId);
                    return (
                      <div key={p.taskId} className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center">
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="font-medium">{c?.scs_id} · {c?.customer_name} <Badge variant="outline" className="ml-1">{p.area}</Badge></div>
                          <div className="text-muted-foreground truncate">{c?.customer_address}</div>
                          {p.reason && <div className="text-xs text-muted-foreground">{p.reason}</div>}
                        </div>
                        <Select
                          value={p.engineerId ?? NONE}
                          onValueChange={(v) => setPlan((cur) => cur!.map((x) => x.taskId === p.taskId ? { ...x, engineerId: v === NONE ? null : v, reason: "Changed by you" } : x))}
                        >
                          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Not assigned</SelectItem>
                            {people.filter((x) => selEng.has(x.user_id)).map((x) => (
                              <SelectItem key={x.user_id} value={x.user_id}>{x.full_name} ({counts.get(x.user_id) ?? 0}/{LIMIT})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPlan(null)}>Back</Button>
            <Button onClick={confirm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm & assign
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
