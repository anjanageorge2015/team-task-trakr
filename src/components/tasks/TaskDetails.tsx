import { Task } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Calendar, User, MapPin, FileText } from "lucide-react";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskAttachments } from "./TaskAttachments";

interface TaskDetailsProps {
  task: Task;
  onClose: () => void;
  isAdmin: boolean;
}

export function TaskDetails({ task, onClose, isAdmin }: TaskDetailsProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Task Details - {task.scsId}
            <TaskStatusBadge status={task.status} />
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">SCS ID</div>
            <div className="font-medium">{task.scsId}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Vendor Call ID</div>
            <div className="font-medium">{task.vendorCallId}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Vendor</div>
            <div>{task.vendor}</div>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Amount</div>
              <div className="font-medium">₹{task.amount.toFixed(2)}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </div>
            <div className="font-medium">{task.customerName}</div>
            {task.customerAddress && (
              <div className="text-sm text-muted-foreground flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                {task.customerAddress}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Call Description
            </div>
            <div className="text-sm">{task.callDescription}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Call Date
              </div>
              <div>{new Date(task.callDate).toLocaleDateString()}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Assigned To</div>
              <div>{task.assignedTo || 'Unassigned'}</div>
            </div>
          </div>

          {task.remarks && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Remarks</div>
              <div className="text-sm bg-muted p-3 rounded">{task.remarks}</div>
            </div>
          )}

          {task.scsRemarks && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">SCS Remarks</div>
              <div className="text-sm bg-muted p-3 rounded">{task.scsRemarks}</div>
            </div>
          )}

          <div className="pt-4 border-t">
            <TaskAttachments taskId={task.id} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-xs">{new Date(task.createdAt).toLocaleString()}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Last Updated</div>
              <div className="text-xs">{new Date(task.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}