import { Task, TaskStatus } from "@/types/task";
import { ExcelUploadMatcher } from "./ExcelUploadMatcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BulkOperationsProps {
  tasks: Task[];
  onBulkUpdateStatus: (taskIds: string[], status: TaskStatus) => void;
}

export function BulkOperations({ tasks, onBulkUpdateStatus }: BulkOperationsProps) {
  const [showExcelMatcher, setShowExcelMatcher] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use bulk tools to update multiple tasks at once.
          </p>
          <Button onClick={() => setShowExcelMatcher(true)} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel Vendor ID Matcher
          </Button>
        </CardContent>
      </Card>

      {showExcelMatcher && (
        <ExcelUploadMatcher
          tasks={tasks}
          onBulkUpdateStatus={onBulkUpdateStatus}
          onClose={() => setShowExcelMatcher(false)}
        />
      )}
    </div>
  );
}
