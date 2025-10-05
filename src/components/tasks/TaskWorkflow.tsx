import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Clock, User, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/types/task";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskWorkflowProps {
  task: Task;
  onClose: () => void;
}

interface TaskHistory {
  id: string;
  task_id: string;
  changed_by: string;
  changed_at: string;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  user_email?: string;
}

export function TaskWorkflow({ task, onClose }: TaskWorkflowProps) {
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskHistory();
  }, [task.id]);

  const fetchTaskHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('task_history')
        .select(`
          *,
          profiles!task_history_changed_by_fkey(email)
        `)
        .eq('task_id', task.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      const historyWithEmails = data?.map(item => ({
        ...item,
        user_email: item.profiles?.email || 'Unknown user'
      })) || [];

      setHistory(historyWithEmails);
    } catch (error) {
      console.error('Error fetching task history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'status_changed':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'assigned':
        return <User className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionLabel = (actionType: string, fieldName: string | null) => {
    switch (actionType) {
      case 'created':
        return 'Task Created';
      case 'status_changed':
        return 'Status Changed';
      case 'assigned':
        return 'Assignment Changed';
      case 'updated':
        return fieldName ? `${fieldName} Updated` : 'Updated';
      default:
        return 'Modified';
    }
  };

  const formatValue = (value: string | null, fieldName: string | null) => {
    if (!value) return 'N/A';
    if (fieldName === 'status') {
      return <TaskStatusBadge status={value as any} />;
    }
    return value;
  };

  return (
    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">Task Workflow History</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          <div><strong>SCS ID:</strong> {task.scsId}</div>
          <div><strong>Customer:</strong> {task.customerName}</div>
        </div>
      </CardHeader>

      <CardContent className="p-6 overflow-y-auto flex-1">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No history available for this task yet.
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-6">
              {history.map((item, index) => (
                <div key={item.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-background border-2 border-primary">
                    {getActionIcon(item.action_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <Card className="bg-accent/5 border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h4 className="font-semibold text-base">
                              {getActionLabel(item.action_type, item.field_name)}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              by {item.user_email}
                            </p>
                          </div>
                          <time className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(item.changed_at).toLocaleString()}
                          </time>
                        </div>

                        {item.old_value && item.new_value && (
                          <div className="flex flex-wrap gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">From:</span>
                              <div className="font-medium">
                                {formatValue(item.old_value, item.field_name)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">To:</span>
                              <div className="font-medium">
                                {formatValue(item.new_value, item.field_name)}
                              </div>
                            </div>
                          </div>
                        )}

                        {!item.old_value && item.new_value && (
                          <div className="mt-3 text-sm">
                            <span className="text-muted-foreground">Initial value: </span>
                            <span className="font-medium">
                              {formatValue(item.new_value, item.field_name)}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}