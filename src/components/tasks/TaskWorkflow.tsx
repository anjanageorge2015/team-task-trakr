import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, User, Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/task";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Badge } from "@/components/ui/badge";

interface TaskWorkflowProps {
  task: Task;
  onClose: () => void;
}

interface TaskHistoryEntry {
  id: string;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export function TaskWorkflow({ task, onClose }: TaskWorkflowProps) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // First get the history entries
        const { data: historyData, error: historyError } = await supabase
          .from('task_history')
          .select('*')
          .eq('task_id', task.id)
          .order('changed_at', { ascending: false });

        if (historyError) throw historyError;

        // Then fetch profile info for each unique changed_by user
        const userIds = [...new Set(historyData?.map(h => h.changed_by) || [])];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const enrichedHistory = historyData?.map(entry => ({
          ...entry,
          profiles: profilesData?.find(p => p.user_id === entry.changed_by) || null
        })) || [];

        setHistory(enrichedHistory);
      } catch (error) {
        console.error('Error fetching task history:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load task workflow history.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [task.id, toast]);

  const getActionLabel = (entry: TaskHistoryEntry) => {
    switch (entry.action_type) {
      case 'created':
        return 'Task Created';
      case 'status_changed':
        return 'Status Changed';
      case 'assigned':
        return 'Assignment Changed';
      case 'updated':
        return 'Task Updated';
      default:
        return entry.action_type;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'status_changed':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'assigned':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'updated':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const formatStatusValue = (value: string) => {
    const statusMap: Record<string, string> = {
      'unassigned': 'Unassigned',
      'assigned': 'Assigned',
      'on_hold': 'On Hold',
      'closed': 'Closed',
      'settled': 'Settled',
      'repeat': 'Repeat',
    };
    return statusMap[value] || value;
  };

  return (
    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Task Workflow History</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">Task:</span>
              <span>{task.scsId}</span>
              <TaskStatusBadge status={task.status} />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading workflow history...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No workflow history available for this task.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className="relative pl-8 pb-6 last:pb-0 border-l-2 border-border"
              >
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Badge className={`${getActionColor(entry.action_type)} border`}>
                        {getActionLabel(entry)}
                      </Badge>
                      
                      {entry.field_name && (
                        <div className="flex items-center gap-2 text-sm">
                          {entry.old_value && (
                            <>
                              <span className="text-muted-foreground line-through">
                                {entry.field_name === 'status' 
                                  ? formatStatusValue(entry.old_value)
                                  : entry.old_value}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          )}
                          <span className="font-medium">
                            {entry.field_name === 'status'
                              ? formatStatusValue(entry.new_value || '')
                              : entry.new_value}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(entry.changed_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <User className="h-3 w-3" />
                        <span>
                          {entry.profiles?.full_name || entry.profiles?.email || 'Unknown User'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
