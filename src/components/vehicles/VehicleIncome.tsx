import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/components/vehicles/VehicleServiceExpenses";

export interface VehicleIncomeEntry {
  id: string;
  vehicle_id: string;
  income_date: string;
  amount: number;
  source: string;
  description: string | null;
}

export const INCOME_SOURCES = [
  { value: "trip", label: "Trip" },
  { value: "rental", label: "Rental" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  income_date: new Date().toISOString().slice(0, 10),
  amount: "",
  source: "trip",
  description: "",
};

interface Props {
  vehicleId: string | null;
  vehicleLabel?: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function VehicleIncome({ vehicleId, vehicleLabel, userId, open, onOpenChange, onChanged }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<VehicleIncomeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchRows = async () => {
    if (!vehicleId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicle_income")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("income_date", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load income entries" });
    } else {
      setRows((data || []) as VehicleIncomeEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && vehicleId) {
      setShowForm(false);
      setForm(emptyForm);
      fetchRows();
    }
  }, [open, vehicleId]);

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const handleSave = async () => {
    if (!vehicleId) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: "destructive", title: "Enter a valid amount" });
      return;
    }
    const { error } = await supabase.from("vehicle_income").insert([
      {
        vehicle_id: vehicleId,
        income_date: form.income_date,
        amount,
        source: form.source,
        description: form.description || null,
        created_by: userId,
      },
    ]);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save income entry" });
      return;
    }
    toast({ title: "Income added" });
    setForm(emptyForm);
    setShowForm(false);
    fetchRows();
    onChanged?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vehicle_income").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete entry" });
      return;
    }
    fetchRows();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vehicle Income{vehicleLabel ? ` · ${vehicleLabel}` : ""}</DialogTitle>
          <DialogDescription>
            Total received: <span className="font-semibold text-foreground">{formatCurrency(total)}</span> across {rows.length}{" "}
            {rows.length === 1 ? "entry" : "entries"}
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Income Date *</Label>
                <Input type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Airport trip, monthly rental payment"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Income</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowForm(true)} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add Income
          </Button>
        )}

        {loading ? (
          <p className="py-6 text-center text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No income recorded for this vehicle yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.income_date + "T00:00:00").toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>{INCOME_SOURCES.find((s) => s.value === r.source)?.label || r.source}</TableCell>
                    <TableCell>{r.description || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(r.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} aria-label="Delete income entry">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
