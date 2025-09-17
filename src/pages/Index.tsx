import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/TaskList";
import { Task } from "@/types/task";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, Building2, BarChart3 } from "lucide-react";
import Dashboard from "./Dashboard";
import VendorManagement from "./VendorManagement";
import Reports from "./Reports";

export default function Index() {
  const [currentView, setCurrentView] = useState<"dashboard" | "tasks" | "vendors" | "reports">("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const { toast } = useToast();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          vendor:vendors(name),
          assigned_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedTasks: Task[] = data.map(task => ({
        id: task.id,
        scsId: task.scs_id,
        vendorCallId: task.vendor_call_id,
        vendor: task.vendor?.name || '',
        callDescription: task.call_description,
        callDate: task.call_date,
        customerName: task.customer_name,
        customerAddress: task.customer_address || '',
        remarks: task.remarks || '',
        scsRemarks: task.scs_remarks || '',
        amount: task.amount || 0,
        status: task.status as Task['status'],
        assignedTo: task.assigned_profile?.full_name || '',
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }));
      
      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch tasks",
      });
    }
  };

  const handleCreateTask = async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    try {
      // Get vendor ID
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', newTask.vendor)
        .single();

      // Resolve assigned user ID from full name (if provided)
      let assignedUserId: string | null = null;
      if (newTask.assignedTo && newTask.assignedTo !== 'unassigned') {
        const { data: assignedData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('full_name', newTask.assignedTo)
          .maybeSingle();
        assignedUserId = assignedData?.user_id ?? null;
      }

      const { error } = await supabase
        .from('tasks')
        .insert([{
          vendor_call_id: newTask.vendorCallId || null,
          vendor_id: vendorData?.id,
          call_description: newTask.callDescription,
          call_date: newTask.callDate,
          customer_name: newTask.customerName,
          customer_address: newTask.customerAddress,
          remarks: newTask.remarks || null,
          scs_remarks: newTask.scsRemarks || null,
          amount: newTask.amount,
          status: newTask.status,
          assigned_to: assignedUserId,
          created_by: user.id,
        }]);

      if (error) throw error;

      await fetchTasks();
      toast({
        title: "Task created",
        description: "New task has been added successfully.",
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create task",
      });
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      // Get vendor ID
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', updatedTask.vendor)
        .single();

      // Resolve assigned user ID from full name (if provided)
      let assignedUserId: string | null = null;
      if (updatedTask.assignedTo && updatedTask.assignedTo !== 'unassigned') {
        const { data: assignedData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('full_name', updatedTask.assignedTo)
          .maybeSingle();
        assignedUserId = assignedData?.user_id ?? null;
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          vendor_call_id: updatedTask.vendorCallId || null,
          vendor_id: vendorData?.id,
          call_description: updatedTask.callDescription,
          call_date: updatedTask.callDate,
          customer_name: updatedTask.customerName,
          customer_address: updatedTask.customerAddress,
          remarks: updatedTask.remarks || null,
          scs_remarks: updatedTask.scsRemarks || null,
          amount: updatedTask.amount,
          status: updatedTask.status,
          assigned_to: assignedUserId,
        })
        .eq('id', updatedTask.id);

      if (error) throw error;

      await fetchTasks();
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await fetchTasks();
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete task",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              SCS Task Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <Button
                variant={currentView === "dashboard" ? "default" : "outline"}
                onClick={() => setCurrentView("dashboard")}
              >
                Dashboard
              </Button>
              <Button
                variant={currentView === "tasks" ? "default" : "outline"}
                onClick={() => setCurrentView("tasks")}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Manage Tasks
              </Button>
              <Button
                variant={currentView === "vendors" ? "default" : "outline"}
                onClick={() => setCurrentView("vendors")}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Manage Vendors
              </Button>
              <Button
                variant={currentView === "reports" ? "default" : "outline"}
                onClick={() => setCurrentView("reports")}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Reports
              </Button>
            </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Welcome, {user.email}
                </span>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentView === "dashboard" ? (
          <Dashboard tasks={tasks} />
        ) : currentView === "tasks" ? (
          <TaskList 
            tasks={tasks}
            onUpdateTask={handleUpdateTask}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
          />
        ) : currentView === "vendors" ? (
          <VendorManagement />
        ) : (
          <Reports />
        )}
      </div>
    </div>
  );
}