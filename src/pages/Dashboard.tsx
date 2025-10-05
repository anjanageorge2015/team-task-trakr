import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { Task, TaskStatus } from "@/types/task";
import { Users, ClipboardList, DollarSign, Clock } from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

interface DashboardProps {
  tasks: Task[];
}

export default function Dashboard({ tasks }: DashboardProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles(user?.id);
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const assignedTasks = tasks.filter(t => t.status === 'assigned').length;
    const settledTasks = tasks.filter(t => t.status === 'settled').length;
    
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const totalRevenue = tasks
      .filter(t => {
        if (t.status !== 'settled') return false;
        const taskDate = parseISO(t.updatedAt);
        return isWithinInterval(taskDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, task) => sum + task.amount, 0);

    return {
      totalTasks,
      assignedTasks,
      settledTasks,
      totalRevenue,
    };
  }, [tasks]);

  const statusDistribution = useMemo(() => {
    const statusCounts: Record<TaskStatus, number> = {
      unassigned: 0,
      assigned: 0,
      on_hold: 0,
      closed: 0,
      settled: 0,
      repeat: 0,
    };

    tasks.forEach(task => {
      statusCounts[task.status]++;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status as TaskStatus,
      count,
      label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    }));
  }, [tasks]);

  return (
    <div className="space-y-8">
      {/* Metrics Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin() ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        <MetricCard
          title="Total Tasks"
          value={metrics.totalTasks}
          icon={ClipboardList}
          description="All tasks in system"
        />
        <MetricCard
          title="Active Tasks"
          value={metrics.assignedTasks}
          icon={Users}
          description="Currently assigned"
        />
        <MetricCard
          title="Completed"
          value={metrics.settledTasks}
          icon={Clock}
          description="Settled tasks"
        />
        {isAdmin() && (
          <MetricCard
            title="Revenue"
            value={metrics.totalRevenue}
            icon={DollarSign}
            description="Current month revenue"
            isRevenue={true}
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatusChart data={statusDistribution} />
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center space-x-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {task.scsId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {task.customerName}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}