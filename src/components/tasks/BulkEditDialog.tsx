import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const NO_CHANGE = "__no_change__";
const STATUSES = [
  ["unassigned", "Unassigned"],
  ["assigned", "Assigned"],
  ["on_hold", "On Hold"],
  ["closed", "Closed"],
  ["settled", "Settled"],
  ["repeat", "Repeat"],
];

interface Props {
  open: boolean;
  taskIds: string[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export function BulkEditDialog({ open, taskIds, onOpenChange, onDone }: Props) {
  const { toast } = useToast();
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [assignee, setAssignee] = useState(NO_CHANGE);
  const [status, setStatus] = useState(NO_CHANGE);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssignee(NO_CHANGE); setStatus(NO_CHANGE); setAmount("");
    supabase.from("profiles").select("user_id, full_name").order("full_name").then(({ data }) => setPeople(data ?? []));
  }, [open]);

  const save = async () => {
    const update: Record<string, unknown> = {};
    if (assignee !== NO_CHANGE) update.assigned_to = assignee === "unassigned" ? null : assignee;
    if (status !== NO_CHANGE) update.status = status;
    if (amount.trim() !== "") {
      const n = parseFloat(amount);
      if (isNaN(n) || n < 0) return toast({ variant: "destructive", title: "Enter a valid amount" });
      update.amount = n;
    }
    if (status === "repeat") { update.amount = 0; update.commission_percentage = 0; }
    if (Object.keys(update).length === 0) return toast({ title: "Nothing to change", description: "Pick at least one field." });

    setSaving(true);
    const { error } = await supabase.from("tasks").update(update).in("id", taskIds);
    setSaving(false);
    if (error) {
      console.error(error);
      return toast({ variant: "destructive", title: "Update failed", description: error.message });
    }
    toast({ title: "Tasks updated", description: `${taskIds.length} task${taskIds.length !== 1 ? "s" : ""} updated.` });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit {taskIds.length} Task{taskIds.length !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Only the fields you change will be updated.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Assigned To</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>— No change —</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>— No change —</SelectItem>
                {STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Amount (₹)</Label>
            <Input
              type="number" min="0" step="0.01" value={amount}
              disabled={status === "repeat"}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={status === "repeat" ? "Repeat sets amount to 0" : "Leave blank for no change"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update Tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
