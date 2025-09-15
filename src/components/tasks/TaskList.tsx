import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task, TaskStatus } from "@/types/task";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskForm } from "./TaskForm";
import { Edit, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function TaskList({ tasks, onUpdateTask, onCreateTask }: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = Object.values(task).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    onCreateTask(taskData);
    setShowForm(false);
    toast({
      title: "Task created",
      description: "New task has been created successfully.",
    });
  };

  const handleUpdateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        ...taskData,
        updatedAt: new Date().toISOString(),
      });
      setEditingTask(null);
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle>Task Management</CardTitle>
            <Button onClick={() => setShowForm(true)} className="w-fit">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="font-medium">{task.scsId}</div>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Customer:</span> {task.customerName}
                      </div>
                      <div className="text-sm">{task.callDescription}</div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Vendor: {task.vendor}</span>
                        <span>Date: {new Date(task.callDate).toLocaleDateString()}</span>
                        <span>Amount: ${task.amount.toFixed(2)}</span>
                        {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTask(task)}
                      className="w-full lg:w-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tasks found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(showForm || editingTask) && (
        <TaskForm
          task={editingTask || undefined}
          onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
          onCancel={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}