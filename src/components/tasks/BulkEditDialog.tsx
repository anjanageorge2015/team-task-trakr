import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const UNASSIGNED = "__unassigned__";
const STATUSES = [
  ["unassigned", "Unassigned"],
  ["assigned", "Assigned"],
  ["on_hold", "On Hold"],
  ["closed", "Closed"],
  ["settled", "Settled"],
  ["repeat", "Repeat"],
];

interface Row {
  id: string;
  label: string;
  customer: string;
  assigned_to: string;
  status: string;
  amount: string;
  orig: { assigned_to: string; status: string; amount: string };
}

interface Props {
  open: boolean;
  taskIds: string[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export function BulkEditDialog({ open, taskIds, onOpenChange, onDone }: Props) {
  const { toast } = useToast();
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load only once each time the dialog opens, so background refreshes don't wipe unsaved edits.
  const idsKey = open ? taskIds.join(",") : "";
  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, full_name").order("full_name").then(({ data }) => setPeople(data ?? []));
    if (taskIds.length === 0) { setRows([]); return; }
    setLoading(true);
    supabase
      .from("tasks")
      .select("id, vendor_call_id, customer_name, assigned_to, status, amount")
      .in("id", taskIds)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) return toast({ variant: "destructive", title: "Could not load tasks", description: error.message });
        setRows((data ?? []).map((t: any) => {
          const orig = {
            assigned_to: t.assigned_to ?? UNASSIGNED,
            status: t.status ?? "unassigned",
            amount: t.amount != null ? String(t.amount) : "",
          };
          return { id: t.id, label: t.vendor_call_id || "—", customer: t.customer_name || "", ...orig, orig };
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey]);

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const n = { ...r, ...p };
      if (p.status === "repeat") n.amount = "0";
      return n;
    }));

  const save = async () => {
    const changed = rows.filter((r) =>
      r.assigned_to !== r.orig.assigned_to || r.status !== r.orig.status || r.amount !== r.orig.amount);
    if (changed.length === 0) return toast({ title: "Nothing to change" });
    for (const r of changed) {
      if (r.amount.trim() !== "" && (isNaN(parseFloat(r.amount)) || parseFloat(r.amount) < 0))
        return toast({ variant: "destructive", title: `Invalid amount for ${r.label}` });
    }
    setSaving(true);
    const results = await Promise.all(changed.map((r) => {
      const update: Record<string, unknown> = {};
      if (r.assigned_to !== r.orig.assigned_to) update.assigned_to = r.assigned_to === UNASSIGNED ? null : r.assigned_to;
      if (r.status !== r.orig.status) update.status = r.status;
      if (r.amount !== r.orig.amount) update.amount = r.amount.trim() === "" ? null : parseFloat(r.amount);
      if (r.status === "repeat") { update.amount = 0; update.commission_percentage = 0; }
      return supabase.from("tasks").update(update).eq("id", r.id);
    }));
    setSaving(false);
    const failed = results.filter((x) => x.error);
    if (failed.length) {
      console.error(failed.map((f) => f.error));
      toast({ variant: "destructive", title: "Some updates failed", description: `${failed.length} of ${changed.length} failed: ${failed[0].error?.message}` });
    } else {
      toast({ title: "Tasks updated", description: `${changed.length} task${changed.length !== 1 ? "s" : ""} updated.` });
      onOpenChange(false);
    }
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {taskIds.length} Task{taskIds.length !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Change each task separately. Only changed tasks are saved.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[1.4fr_1.2fr_1fr_0.8fr] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Task</span><span>Assigned To</span><span>Status</span><span>Amount (₹)</span>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr] gap-2 items-center border rounded-md p-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{r.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.customer}</div>
                </div>
                <Select value={r.assigned_to} onValueChange={(v) => patch(r.id, { assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Assigned To" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={r.status} onValueChange={(v) => patch(r.id, { status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number" min="0" step="0.01" value={r.amount}
                  disabled={r.status === "repeat"}
                  onChange={(e) => patch(r.id, { amount: e.target.value })}
                  placeholder="Amount"
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
