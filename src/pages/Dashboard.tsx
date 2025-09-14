import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { TaskList } from "@/components/tasks/TaskList";
import { Task, TaskStatus } from "@/types/task";
import { Users, ClipboardList, DollarSign, Clock } from "lucide-react";

// Sample data - in a real app, this would come from an API
const sampleTasks: Task[] = [
  {
    id: "1",
    scsId: "SCS001",
    vendorCallId: "VC2024001",
    vendor: "Tech Solutions Inc",
    callDescription: "Network connectivity issue at customer premises",
    callDate: "2024-09-14",
    customerName: "John Doe",
    customerAddress: "123 Main St, Anytown, AT 12345",
    remarks: "Customer reported intermittent connection drops",
    scsRemarks: "Initial assessment completed",
    amount: 150.00,
    status: "assigned",
    assignedTo: "Alice Johnson",
    createdAt: "2024-09-14T08:00:00Z",
    updatedAt: "2024-09-14T08:00:00Z",
  },
  {
    id: "2",
    scsId: "SCS002",
    vendorCallId: "VC2024002",
    vendor: "ServiceMax Pro",
    callDescription: "Hardware replacement needed",
    callDate: "2024-09-13",
    customerName: "Jane Smith",
    customerAddress: "456 Oak Ave, Springfield, SP 67890",
    remarks: "Router needs replacement",
    scsRemarks: "Parts ordered",
    amount: 280.00,
    status: "on-hold",
    assignedTo: "Bob Wilson",
    createdAt: "2024-09-13T10:30:00Z",
    updatedAt: "2024-09-13T14:30:00Z",
  },
  {
    id: "3",
    scsId: "SCS003",
    vendorCallId: "VC2024003",
    vendor: "QuickFix Systems",
    callDescription: "Software installation and configuration",
    callDate: "2024-09-12",
    customerName: "Acme Corp",
    customerAddress: "789 Business Blvd, Commerce City, CC 54321",
    remarks: "New software deployment for entire office",
    scsRemarks: "Installation completed successfully",
    amount: 450.00,
    status: "settled",
    assignedTo: "Carol Davis",
    createdAt: "2024-09-12T09:00:00Z",
    updatedAt: "2024-09-14T16:00:00Z",
  },
  {
    id: "4",
    scsId: "SCS004",
    vendorCallId: "VC2024004",
    vendor: "EliteSupport Ltd",
    callDescription: "Emergency system restore",
    callDate: "2024-09-14",
    customerName: "Global Industries",
    customerAddress: "321 Enterprise Way, Metro City, MC 98765",
    remarks: "Server crash, data recovery needed",
    scsRemarks: "",
    amount: 0,
    status: "unassigned",
    createdAt: "2024-09-14T12:00:00Z",
    updatedAt: "2024-09-14T12:00:00Z",
  },
];

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(sampleTasks);

  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const assignedTasks = tasks.filter(t => t.status === 'assigned').length;
    const settledTasks = tasks.filter(t => t.status === 'settled').length;
    const totalRevenue = tasks
      .filter(t => t.status === 'settled')
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
      'on-hold': 0,
      closed: 0,
      settled: 0,
    };

    tasks.forEach(task => {
      statusCounts[task.status]++;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status as TaskStatus,
      count,
      label: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    }));
  }, [tasks]);

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: `SCS${String(tasks.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Task Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage your team's service calls and tasks
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <MetricCard
            title="Revenue"
            value={metrics.totalRevenue}
            icon={DollarSign}
            description="From settled tasks"
          />
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

        {/* Task List */}
        <TaskList
          tasks={tasks}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </div>
  );
}