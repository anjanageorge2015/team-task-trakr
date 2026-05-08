import { Task, TaskStatus } from "@/types/task";
import { ExcelUploadMatcher } from "./ExcelUploadMatcher";
import { BulkUploadTasks } from "./BulkUploadTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BulkOperationsProps {
  tasks: Task[];
  onBulkUpdateStatus: (taskIds: string[], status: TaskStatus) => void;
  onTasksChanged?: () => void;
}

export function BulkOperations({ tasks, onBulkUpdateStatus, onTasksChanged }: BulkOperationsProps) {
  const [showExcelMatcher, setShowExcelMatcher] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use bulk tools to update or create multiple tasks at once.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowExcelMatcher(true)} variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel Vendor ID Matcher
            </Button>
            <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload Tasks
            </Button>
          </div>
        </CardContent>
      </Card>

      {showExcelMatcher && (
        <ExcelUploadMatcher
          tasks={tasks}
          onBulkUpdateStatus={onBulkUpdateStatus}
          onClose={() => setShowExcelMatcher(false)}
        />
      )}

      {showBulkUpload && (
        <BulkUploadTasks
          onClose={() => setShowBulkUpload(false)}
          onComplete={onTasksChanged}
        />
      )}
    </div>
  );
}
