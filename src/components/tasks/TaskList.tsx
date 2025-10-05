import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task, TaskStatus } from "@/types/task";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskForm } from "./TaskForm";
import { TaskWorkflow } from "./TaskWorkflow";
import { Edit, Plus, Search, Trash2, Copy, Clock, GitBranch } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { calculateDaysPending, formatDaysPending } from "@/utils/dateUtils";

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskList({ tasks, onUpdateTask, onCreateTask, onDeleteTask }: TaskListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all" | "active">("active");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles(user?.id);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = Object.values(task).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = 
      statusFilter === "all" || 
      task.status === statusFilter ||
      (statusFilter === "active" && (task.status === "unassigned" || task.status === "assigned"));
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

  const handleCopyTask = async (task: Task) => {
    const taskContent = `SCS ID: ${task.scsId}
Vendor Call ID: ${task.vendorCallId}
Vendor: ${task.vendor}
Customer: ${task.customerName}
Address: ${task.customerAddress}
Call Description: ${task.callDescription}
Call Date: ${new Date(task.callDate).toLocaleDateString()}
Status: ${task.status}
${task.assignedTo ? `Assigned To: ${task.assignedTo}` : 'Unassigned'}
${task.remarks ? `Remarks: ${task.remarks}` : ''}
${task.scsRemarks ? `SCS Remarks: ${task.scsRemarks}` : ''}
Created: ${new Date(task.createdAt).toLocaleString()}
Updated: ${new Date(task.updatedAt).toLocaleString()}`;

    try {
      await navigator.clipboard.writeText(taskContent);
      toast({
        title: "Task copied",
        description: "Task details have been copied to clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy task:', error);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy task details to clipboard.",
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
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all" | "active")}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Tasks</SelectItem>
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
              <Card key={task.id} className="bg-accent/5 hover:bg-accent/10 hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                     <div className="space-y-2 flex-1">
                       <div className="flex items-center space-x-4 flex-wrap">
                         <div className="font-medium">{task.scsId}</div>
                         <TaskStatusBadge status={task.status} />
                         {(task.status === 'unassigned' || task.status === 'assigned') && (
                           <div className="flex items-center space-x-1 bg-warning/10 text-warning-foreground px-2 py-1 rounded-md border border-warning/20">
                             <Clock className="h-3 w-3" />
                             <span className="text-xs font-medium">
                               {formatDaysPending(calculateDaysPending(task.createdAt))} pending
                             </span>
                           </div>
                         )}
                       </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Customer:</span> {task.customerName}
                      </div>
                      <div className="text-sm">{task.callDescription}</div>
                       <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                         <span>Vendor Call ID: {task.vendorCallId}</span>
                         <span>Vendor: {task.vendor}</span>
                         <span>Date: {new Date(task.callDate).toLocaleDateString()}</span>
                         {isAdmin() && <span>Amount: ₹{task.amount.toFixed(2)}</span>}
                         {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                       </div>
                    </div>
                     <div className="flex gap-2 w-full lg:w-auto">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => setViewingTask(task)}
                         className="flex-1 lg:flex-none"
                       >
                         <GitBranch className="h-4 w-4 mr-2" />
                         Workflow
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleCopyTask(task)}
                         className="flex-1 lg:flex-none"
                       >
                         <Copy className="h-4 w-4 mr-2" />
                         Copy
                       </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTask(task)}
                        className="flex-1 lg:flex-none"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Task</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete task {task.scsId}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDeleteTask(task.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
          isAdmin={isAdmin()}
        />
      )}

      {viewingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <TaskWorkflow
            task={viewingTask}
            onClose={() => setViewingTask(null)}
          />
        </div>
      )}
    </div>
  );
}