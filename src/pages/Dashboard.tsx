import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { Task, TaskStatus } from "@/types/task";
import { Users, ClipboardList, DollarSign, Clock, CalendarIcon } from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, subDays, startOfYear, format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DashboardProps {
  tasks: Task[];
}

export default function Dashboard({ tasks }: DashboardProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles(user?.id);

  const [startDate, setStartDate] = useState<Date | null>(subMonths(new Date(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const filteredTasks = useMemo(() => {
    if (!startDate) return tasks;
    return tasks.filter(t => {
      const taskDate = parseISO(t.createdAt);
      return isWithinInterval(taskDate, { start: startDate, end: endDate });
    });
  }, [tasks, startDate, endDate]);

  const metrics = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const assignedTasks = filteredTasks.filter(t => t.status === 'assigned').length;
    const settledTasks = filteredTasks.filter(t => t.status === 'settled').length;
    
    const totalRevenue = filteredTasks
      .filter(t => t.status === 'settled')
      .reduce((sum, task) => sum + task.amount, 0);

    return {
      totalTasks,
      assignedTasks,
      settledTasks,
      totalRevenue,
    };
  }, [filteredTasks]);

  const statusDistribution = useMemo(() => {
    const statusCounts: Record<TaskStatus, number> = {
      unassigned: 0,
      assigned: 0,
      on_hold: 0,
      closed: 0,
      settled: 0,
      repeat: 0,
    };

    filteredTasks.forEach(task => {
      statusCounts[task.status]++;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status as TaskStatus,
      count,
      label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    }));
  }, [filteredTasks]);

  return (
    <div className="space-y-8">
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">From:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd MMM yyyy") : "All time"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate ?? undefined} onSelect={(d) => d && setStartDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">To:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd MMM yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1 border-l pl-4 ml-2">
          {[
            { label: "7 days", fn: () => { setStartDate(subDays(new Date(), 7)); setEndDate(new Date()); } },
            { label: "1 month", fn: () => { setStartDate(subMonths(new Date(), 1)); setEndDate(new Date()); } },
            { label: "3 months", fn: () => { setStartDate(subMonths(new Date(), 3)); setEndDate(new Date()); } },
            { label: "This year", fn: () => { setStartDate(startOfYear(new Date())); setEndDate(new Date()); } },
          ].map((preset) => (
            <Button key={preset.label} variant="ghost" size="sm" onClick={preset.fn} className="text-xs">
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
      {/* Metrics Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin() ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 md:gap-6`}>
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