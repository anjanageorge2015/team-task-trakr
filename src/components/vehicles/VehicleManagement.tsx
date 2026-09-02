import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { VehicleServiceExpenses, formatCurrency } from "@/components/vehicles/VehicleServiceExpenses";
import { AlertTriangle, Bike, Car, CheckCircle2, Clock, Pencil, Plus, Trash2, Wrench } from "lucide-react";

export interface Vehicle {
  id: string;
  registration_number: string;
  vehicle_type: "two_wheeler" | "four_wheeler";
  make_model: string | null;
  owner_name: string | null;
  insurance_expiry: string | null;
  puc_expiry: string | null;
  fitness_expiry: string | null;
  permit_expiry: string | null;
  road_tax_expiry: string | null;
  next_service_due: string | null;
  notes: string | null;
}

export const EXPIRY_FIELDS: { key: keyof Vehicle; label: string }[] = [
  { key: "insurance_expiry", label: "Insurance" },
  { key: "puc_expiry", label: "PUC" },
  { key: "fitness_expiry", label: "Fitness" },
  { key: "permit_expiry", label: "Permit" },
  { key: "road_tax_expiry", label: "Road Tax" },
  { key: "next_service_due", label: "Service Due" },
];

export const daysUntil = (date: string | null): number | null => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

export const formatDate = (date: string | null) =>
  date ? new Date(date + "T00:00:00").toLocaleDateString("en-GB") : "—";

export function ExpiryBadge({ date }: { date: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) return <Badge variant="destructive">{formatDate(date)}</Badge>;
  if (days <= 30)
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning">
        {formatDate(date)} · {days}d
      </Badge>
    );
  return <Badge variant="secondary">{formatDate(date)}</Badge>;
}

const emptyForm = {
  registration_number: "",
  vehicle_type: "two_wheeler" as Vehicle["vehicle_type"],
  make_model: "",
  owner_name: "",
  insurance_expiry: "",
  puc_expiry: "",
  fitness_expiry: "",
  permit_expiry: "",
  road_tax_expiry: "",
  next_service_due: "",
  notes: "",
};

export function VehicleManagement({ isAdmin, userId }: { isAdmin: boolean; userId: string }) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [serviceVehicle, setServiceVehicle] = useState<Vehicle | null>(null);
  const [serviceTotals, setServiceTotals] = useState<Record<string, number>>({});

  const fetchServiceTotals = async () => {
    const { data } = await supabase.from("vehicle_service_expenses").select("vehicle_id, amount");
    const totals: Record<string, number> = {};
    (data || []).forEach((r: { vehicle_id: string; amount: number }) => {
      totals[r.vehicle_id] = (totals[r.vehicle_id] || 0) + Number(r.amount || 0);
    });
    setServiceTotals(totals);
  };

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("registration_number", { ascending: true });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load vehicles" });
    } else {
      setVehicles((data || []) as Vehicle[]);
      fetchServiceTotals();
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchVehicles();
    else setLoading(false);
  }, [isAdmin]);

  const counts = useMemo(() => {
    let expired = 0;
    let soon = 0;
    vehicles.forEach((v) => {
      const values = EXPIRY_FIELDS.map((f) => daysUntil(v[f.key] as string | null));
      if (values.some((d) => d !== null && d < 0)) expired++;
      else if (values.some((d) => d !== null && d <= 30)) soon++;
    });
    return {
      total: vehicles.length,
      twoWheelers: vehicles.filter((v) => v.vehicle_type === "two_wheeler").length,
      expired,
      soon,
      ok: vehicles.length - expired - soon,
    };
  }, [vehicles]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      registration_number: v.registration_number,
      vehicle_type: v.vehicle_type,
      make_model: v.make_model || "",
      owner_name: v.owner_name || "",
      insurance_expiry: v.insurance_expiry || "",
      puc_expiry: v.puc_expiry || "",
      fitness_expiry: v.fitness_expiry || "",
      permit_expiry: v.permit_expiry || "",
      road_tax_expiry: v.road_tax_expiry || "",
      next_service_due: v.next_service_due || "",
      notes: v.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.registration_number.trim()) {
      toast({ variant: "destructive", title: "Registration number required" });
      return;
    }
    const payload = {
      registration_number: form.registration_number.trim().toUpperCase(),
      vehicle_type: form.vehicle_type,
      make_model: form.make_model || null,
      owner_name: form.owner_name || null,
      insurance_expiry: form.insurance_expiry || null,
      puc_expiry: form.puc_expiry || null,
      fitness_expiry: form.fitness_expiry || null,
      permit_expiry: form.permit_expiry || null,
      road_tax_expiry: form.road_tax_expiry || null,
      next_service_due: form.next_service_due || null,
      notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from("vehicles").update(payload).eq("id", editingId)
      : await supabase.from("vehicles").insert([{ ...payload, created_by: userId }]);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "A vehicle with this registration number already exists."
          : "Failed to save vehicle",
      });
      return;
    }
    toast({ title: editingId ? "Vehicle updated" : "Vehicle added" });
    setDialogOpen(false);
    fetchVehicles();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", deleteId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete vehicle" });
    } else {
      toast({ title: "Vehicle deleted" });
      fetchVehicles();
    }
    setDeleteId(null);
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Only admins can manage vehicles.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Vehicles" value={counts.total} icon={Car} description={`${counts.twoWheelers} two wheelers`} />
        <MetricCard title="Expired Documents" value={counts.expired} icon={AlertTriangle} description="Vehicles with expired papers" />
        <MetricCard title="Expiring in 30 Days" value={counts.soon} icon={Clock} description="Renewal due soon" />
        <MetricCard title="All Clear" value={counts.ok < 0 ? 0 : counts.ok} icon={CheckCircle2} description="No action needed" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Vehicle Register</CardTitle>
            <CardDescription>Track insurance, PUC, fitness, permit, road tax and servicing</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registration Number *</Label>
                  <Input
                    value={form.registration_number}
                    onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                    placeholder="KL07AB1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={form.vehicle_type}
                    onValueChange={(v) => setForm({ ...form, vehicle_type: v as Vehicle["vehicle_type"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="two_wheeler">Two Wheeler</SelectItem>
                      <SelectItem value="four_wheeler">Four Wheeler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Make / Model</Label>
                  <Input value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Owner / Assigned To</Label>
                  <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </div>
                {EXPIRY_FIELDS.map((f) => (
                  <div className="space-y-2" key={String(f.key)}>
                    <Label>{f.label} {f.key === "next_service_due" ? "Date" : "Expiry"}</Label>
                    <Input
                      type="date"
                      value={(form as any)[f.key] || ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editingId ? "Save Changes" : "Add Vehicle"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No vehicles added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Owner</TableHead>
                    {EXPIRY_FIELDS.map((f) => (
                      <TableHead key={String(f.key)}>{f.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {v.vehicle_type === "two_wheeler" ? <Bike className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                          <div>
                            <div>{v.registration_number}</div>
                            {v.make_model && <div className="text-xs text-muted-foreground">{v.make_model}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{v.owner_name || "—"}</TableCell>
                      {EXPIRY_FIELDS.map((f) => (
                        <TableCell key={String(f.key)}>
                          <ExpiryBadge date={v[f.key] as string | null} />
                        </TableCell>
                      ))}
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)} aria-label="Edit vehicle">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} aria-label="Delete vehicle">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the vehicle and its renewal dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
