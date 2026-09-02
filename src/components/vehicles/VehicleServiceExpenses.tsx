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

export interface ServiceExpense {
  id: string;
  vehicle_id: string;
  service_date: string;
  amount: number;
  service_type: string;
  odometer_reading: number | null;
  garage_name: string | null;
  description: string | null;
  invoice_number: string | null;
}

export const SERVICE_TYPES = [
  { value: "general_service", label: "General Service" },
  { value: "repair", label: "Repair" },
  { value: "tyre", label: "Tyres" },
  { value: "battery", label: "Battery" },
  { value: "oil_change", label: "Oil Change" },
  { value: "insurance_renewal", label: "Insurance Renewal" },
  { value: "other", label: "Other" },
];

export const formatCurrency = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const emptyForm = {
  service_date: new Date().toISOString().slice(0, 10),
  amount: "",
  service_type: "general_service",
  odometer_reading: "",
  garage_name: "",
  description: "",
  invoice_number: "",
};

interface Props {
  vehicleId: string | null;
  vehicleLabel?: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function VehicleServiceExpenses({ vehicleId, vehicleLabel, userId, open, onOpenChange, onChanged }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ServiceExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchRows = async () => {
    if (!vehicleId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicle_service_expenses")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load service expenses" });
    } else {
      setRows((data || []) as ServiceExpense[]);
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
    const { error } = await supabase.from("vehicle_service_expenses").insert([
      {
        vehicle_id: vehicleId,
        service_date: form.service_date,
        amount,
        service_type: form.service_type,
        odometer_reading: form.odometer_reading ? parseFloat(form.odometer_reading) : null,
        garage_name: form.garage_name || null,
        description: form.description || null,
        invoice_number: form.invoice_number || null,
        created_by: userId,
      },
    ]);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save service expense" });
      return;
    }
    toast({ title: "Service expense added" });
    setForm(emptyForm);
    setShowForm(false);
    fetchRows();
    onChanged?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vehicle_service_expenses").delete().eq("id", id);
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
          <DialogTitle>Service Expenses{vehicleLabel ? ` · ${vehicleLabel}` : ""}</DialogTitle>
          <DialogDescription>
            Total spent: <span className="font-semibold text-foreground">{formatCurrency(total)}</span> across {rows.length}{" "}
            {rows.length === 1 ? "entry" : "entries"}
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Service Date *</Label>
                <Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Odometer (km)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.odometer_reading}
                  onChange={(e) => setForm({ ...form, odometer_reading: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Garage / Vendor</Label>
                <Input value={form.garage_name} onChange={(e) => setForm({ ...form, garage_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Expense</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowForm(true)} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add Service Expense
          </Button>
        )}

        {loading ? (
          <p className="py-6 text-center text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No service expenses recorded for this vehicle yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.service_date + "T00:00:00").toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <div>{SERVICE_TYPES.find((t) => t.value === r.service_type)?.label || r.service_type}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell>
                      <div>{r.garage_name || "—"}</div>
                      {r.invoice_number && <div className="text-xs text-muted-foreground">#{r.invoice_number}</div>}
                    </TableCell>
                    <TableCell>{r.odometer_reading ? `${r.odometer_reading} km` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(r.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} aria-label="Delete expense">
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
