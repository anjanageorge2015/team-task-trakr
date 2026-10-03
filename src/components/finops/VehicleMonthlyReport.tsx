import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car } from "lucide-react";

interface Row {
  month: string;
  tasks: number;
  taskAmount: number;
  income: number;
  serviceExpense: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function VehicleMonthlyReport({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = format(startDate, "yyyy-MM-dd");
    const to = format(endDate, "yyyy-MM-dd");
    (async () => {
      setLoading(true);
      const [inc, exp, tasks] = await Promise.all([
        supabase.from("vehicle_income").select("income_date, amount").gte("income_date", from).lte("income_date", to),
        supabase.from("vehicle_service_expenses").select("service_date, amount").gte("service_date", from).lte("service_date", to),
        supabase.from("tasks").select("call_date, amount").gte("call_date", from).lte("call_date", to).limit(10000),
      ]);
      const map: Record<string, Row> = {};
      const get = (d: string) => {
        const m = d.slice(0, 7);
        return (map[m] ??= { month: m, tasks: 0, taskAmount: 0, income: 0, serviceExpense: 0 });
      };
      (inc.data ?? []).forEach((r) => (get(r.income_date).income += Number(r.amount) || 0));
      (exp.data ?? []).forEach((r) => (get(r.service_date).serviceExpense += Number(r.amount) || 0));
      (tasks.data ?? []).forEach((r) => {
        const row = get(r.call_date);
        row.tasks++;
        row.taskAmount += Number(r.amount) || 0;
      });
      setRows(Object.values(map).sort((a, b) => b.month.localeCompare(a.month)));
      setLoading(false);
    })();
  }, [startDate, endDate]);

  const total = rows.reduce(
    (t, r) => ({
      tasks: t.tasks + r.tasks,
      taskAmount: t.taskAmount + r.taskAmount,
      income: t.income + r.income,
      serviceExpense: t.serviceExpense + r.serviceExpense,
    }),
    { tasks: 0, taskAmount: 0, income: 0, serviceExpense: 0 },
  );
  const net = (r: { income: number; serviceExpense: number }) => r.income - r.serviceExpense;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" /> Vehicles & Tasks by Month
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="text-right">Task Amount</TableHead>
              <TableHead className="text-right">Taxi Income</TableHead>
              <TableHead className="text-right">Service Expense</TableHead>
              <TableHead className="text-right">Vehicle Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data for this period</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.month}>
                  <TableCell className="font-medium">{format(new Date(r.month + "-01T00:00:00"), "MMM yyyy")}</TableCell>
                  <TableCell className="text-right">{r.tasks}</TableCell>
                  <TableCell className="text-right">{fmt(r.taskAmount)}</TableCell>
                  <TableCell className="text-right text-primary">{fmt(r.income)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(r.serviceExpense)}</TableCell>
                  <TableCell className={`text-right font-semibold ${net(r) < 0 ? "text-destructive" : ""}`}>{fmt(net(r))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{total.tasks}</TableCell>
                <TableCell className="text-right">{fmt(total.taskAmount)}</TableCell>
                <TableCell className="text-right">{fmt(total.income)}</TableCell>
                <TableCell className="text-right">{fmt(total.serviceExpense)}</TableCell>
                <TableCell className="text-right">{fmt(net(total))}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
