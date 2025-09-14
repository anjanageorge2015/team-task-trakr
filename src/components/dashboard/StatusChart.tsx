import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TaskStatus } from "@/types/task";

interface StatusChartProps {
  data: Array<{
    status: TaskStatus;
    count: number;
    label: string;
  }>;
}

const STATUS_COLORS = {
  unassigned: "hsl(var(--status-unassigned))",
  assigned: "hsl(var(--status-assigned))",
  "on-hold": "hsl(var(--status-on-hold))",
  closed: "hsl(var(--status-closed))",
  settled: "hsl(var(--status-settled))",
};

export function StatusChart({ data }: StatusChartProps) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Task Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}