import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AlertTriangle, Bike, Car, CheckCircle2, Clock, Wrench } from "lucide-react";
import { EXPIRY_FIELDS, Vehicle, daysUntil, formatDate } from "@/components/vehicles/VehicleManagement";

type Row = {
  vehicle: Vehicle;
  label: string;
  date: string;
  days: number;
};

export function VehicleDashboard() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("registration_number");
      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load vehicles" });
      } else {
        setVehicles((data || []) as Vehicle[]);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const rows = useMemo(() => {
    const all: Row[] = [];
    vehicles.forEach((v) => {
      EXPIRY_FIELDS.forEach((f) => {
        const date = v[f.key] as string | null;
        const days = daysUntil(date);
        if (date && days !== null) all.push({ vehicle: v, label: f.label, date, days });
      });
    });
    return all.sort((a, b) => a.days - b.days);
  }, [vehicles]);

  const expired = rows.filter((r) => r.days < 0);
  const dueSoon = rows.filter((r) => r.days >= 0 && r.days <= 30);
  const attention = [...expired, ...dueSoon];
  const serviceRows = rows.filter((r) => r.label === "Service Due" && r.days <= 30);
  const twoWheelers = vehicles.filter((v) => v.vehicle_type === "two_wheeler").length;
  const fourWheelers = vehicles.filter((v) => v.vehicle_type === "four_wheeler").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Loading vehicles…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Expired" value={expired.length} icon={AlertTriangle} />
        <MetricCard title="Due in 30 days" value={dueSoon.length} icon={Clock} />
        <MetricCard title="Service Due" value={serviceRows.length} icon={Wrench} description="Overdue or within 30 days" />
        <MetricCard title="Two Wheelers" value={twoWheelers} icon={Bike} />
        <MetricCard title="Four Wheelers" value={fourWheelers} icon={Car} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Due Alerts</CardTitle>
          <CardDescription>Vehicles needing servicing now or within the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceRows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              No vehicle is due for servicing in the next 30 days.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Service Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRows.map((r) => (
                  <TableRow key={`svc-${r.vehicle.id}`}>
                    <TableCell className="font-medium">
                      {r.vehicle.registration_number}
                      {r.vehicle.make_model ? (
                        <span className="block text-xs text-muted-foreground">{r.vehicle.make_model}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.vehicle.vehicle_type === "two_wheeler" ? "Two Wheeler" : "Four Wheeler"}</TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      {r.days < 0 ? (
                        <Badge variant="destructive">Overdue by {Math.abs(r.days)}d</Badge>
                      ) : (
                        <Badge className="bg-warning text-warning-foreground hover:bg-warning">In {r.days}d</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Compliance Alerts</CardTitle>
          <CardDescription>
            Documents that have expired or are expiring within the next 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              All vehicle documents are valid for the next 30 days.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attention.map((r) => (
                  <TableRow key={`${r.vehicle.id}-${r.label}`}>
                    <TableCell className="font-medium">
                      {r.vehicle.registration_number}
                      {r.vehicle.make_model ? (
                        <span className="block text-xs text-muted-foreground">{r.vehicle.make_model}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.vehicle.vehicle_type === "two_wheeler" ? "Two Wheeler" : "Four Wheeler"}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      {r.days < 0 ? (
                        <Badge variant="destructive">Expired {Math.abs(r.days)}d ago</Badge>
                      ) : (
                        <Badge className="bg-warning text-warning-foreground hover:bg-warning">
                          In {r.days}d
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Renewals</CardTitle>
          <CardDescription>Next dates for every vehicle document on record</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No vehicle documents recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`all-${r.vehicle.id}-${r.label}`}>
                    <TableCell className="font-medium">{r.vehicle.registration_number}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell className={r.days < 0 ? "text-destructive" : ""}>
                      {r.days < 0 ? `${Math.abs(r.days)} overdue` : r.days}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
