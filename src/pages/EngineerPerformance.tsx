import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface Row {
  engineer: string;
  total: number;
  received: number;
  pending: number;
  rate: number;
  taskCount: number;
}

const RECEIVED_STATUSES = ["closed", "settled"];

export default function EngineerPerformance() {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`amount, status, assigned_profile:profiles!tasks_assigned_to_fkey(full_name)`)
        .gte("call_date", format(startDate, "yyyy-MM-dd"))
        .lte("call_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      const agg: Record<string, Row> = {};
      (data || []).forEach((t: any) => {
        const name = t.assigned_profile?.full_name || "Unassigned";
        const amt = Number(t.amount || 0);
        if (!agg[name]) {
          agg[name] = { engineer: name, total: 0, received: 0, pending: 0, rate: 0, taskCount: 0 };
        }
        agg[name].total += amt;
        agg[name].taskCount += 1;
        if (RECEIVED_STATUSES.includes(t.status)) {
          agg[name].received += amt;
        }
      });

      const list = Object.values(agg).map((r) => ({
        ...r,
        pending: r.total - r.received,
        rate: r.total > 0 ? (r.received / r.total) * 100 : 0,
      }));
      list.sort((a, b) => b.received - a.received);
      setRows(list);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to load performance data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const received = rows.reduce((s, r) => s + r.received, 0);
    return { total, received, pending: total - received, rate: total ? (received / total) * 100 : 0 };
  }, [rows]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Engineer Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchData} disabled={loading} className="w-full">
                {loading ? "Loading..." : "Apply"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total Billed</div><div className="text-2xl font-bold">{formatCurrency(totals.total)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Received</div><div className="text-2xl font-bold text-status-settled">{formatCurrency(totals.received)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending</div><div className="text-2xl font-bold text-status-on-hold">{formatCurrency(totals.pending)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Collection Rate</div><div className="text-2xl font-bold">{totals.rate.toFixed(1)}%</div></CardContent></Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Received vs Total by Engineer</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No data for the selected period</div>
          ) : (
            <ChartContainer config={{}} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="engineer" angle={-30} textAnchor="end" interval={0} height={70} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} width={90} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Bar dataKey="received" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]}>
                    {rows.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Engineer</th>
                    <th className="text-right p-2">Tasks</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Received</th>
                    <th className="text-right p-2">Pending</th>
                    <th className="text-right p-2">Collection %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.engineer} className="border-b">
                      <td className="p-2 font-medium">{r.engineer}</td>
                      <td className="text-right p-2">{r.taskCount}</td>
                      <td className="text-right p-2">{formatCurrency(r.total)}</td>
                      <td className="text-right p-2 text-status-settled">{formatCurrency(r.received)}</td>
                      <td className="text-right p-2 text-status-on-hold">{formatCurrency(r.pending)}</td>
                      <td className="text-right p-2">{r.rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
