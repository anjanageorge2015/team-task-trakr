import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Task, TaskStatus } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckSquare, Square, Upload, X, RefreshCw, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface ExcelUploadMatcherProps {
  tasks: Task[];
  onBulkUpdateStatus: (taskIds: string[], status: TaskStatus) => void;
  onClose: () => void;
}

export function ExcelUploadMatcher({ tasks, onBulkUpdateStatus, onClose }: ExcelUploadMatcherProps) {
  const [matchedTasks, setMatchedTasks] = useState<Task[]>([]);
  const [unmatchedIds, setUnmatchedIds] = useState<string[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [uploaded, setUploaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        // Find the vendor id column (case-insensitive)
        const firstRow = rows[0];
        if (!firstRow) {
          toast({ variant: "destructive", title: "Empty file", description: "The uploaded file has no data rows." });
          return;
        }

        const colKey = Object.keys(firstRow).find(
          (k) => k.trim().toLowerCase().replace(/[_\s]/g, "") === "vendorid"
        );

        if (!colKey) {
          toast({
            variant: "destructive",
            title: "Column not found",
            description: "Could not find a 'Vendor ID' column in the uploaded file.",
          });
          return;
        }

        const vendorIds = rows
          .map((row) => String(row[colKey] ?? "").trim())
          .filter(Boolean);

        // Match against tasks' vendorCallId (trimmed)
        const matched: Task[] = [];
        const matchedVendorIds = new Set<string>();

        for (const task of tasks) {
          const trimmedCallId = task.vendorCallId.trim();
          if (vendorIds.some((vid) => vid === trimmedCallId)) {
            matched.push(task);
            matchedVendorIds.add(trimmedCallId);
          }
        }

        const unmatched = vendorIds.filter((vid) => !matchedVendorIds.has(vid));

        setMatchedTasks(matched);
        setUnmatchedIds(unmatched);
        setSelectedTasks(new Set(matched.map((t) => t.id)));
        setUploaded(true);

        toast({
          title: "File processed",
          description: `${matched.length} tasks matched, ${unmatched.length} vendor IDs not found.`,
        });
      } catch {
        toast({ variant: "destructive", title: "Parse error", description: "Failed to parse the Excel file." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleTaskSelection = (taskId: string) => {
    const next = new Set(selectedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setSelectedTasks(next);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === matchedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(matchedTasks.map((t) => t.id)));
    }
  };

  const handleBulkUpdate = (status: TaskStatus) => {
    if (selectedTasks.size === 0) {
      toast({ variant: "destructive", title: "No tasks selected", description: "Select at least one task." });
      return;
    }
    onBulkUpdateStatus(Array.from(selectedTasks), status);
    toast({
      title: "Tasks updated",
      description: `${selectedTasks.size} task(s) updated to ${status.replace("_", " ")}.`,
    });
    onClose();
  };

  const handleReset = () => {
    setMatchedTasks([]);
    setUnmatchedIds([]);
    setSelectedTasks(new Set());
    setUploaded(false);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Excel Vendor ID Matcher
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto flex flex-col gap-4">
          {/* Upload section */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              {fileName || "Upload Excel File"}
            </Button>
            {uploaded && (
              <Button onClick={handleReset} variant="ghost" size="sm">
                Reset
              </Button>
            )}
            {uploaded && selectedTasks.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Update {selectedTasks.size} Task(s) Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("unassigned")}>Unassigned</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("assigned")}>Assigned</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("on_hold")}>On Hold</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("closed")}>Closed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("repeat")}>Repeat</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkUpdate("settled")}>Settled</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Unmatched IDs warning */}
          {uploaded && unmatchedIds.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-destructive">
                  {unmatchedIds.length} vendor ID(s) not found:
                </span>{" "}
                <span className="text-muted-foreground">{unmatchedIds.join(", ")}</span>
              </div>
            </div>
          )}

          {/* Matched tasks table */}
          {uploaded && matchedTasks.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="p-0 h-auto">
                        {selectedTasks.size === matchedTasks.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>SCS ID</TableHead>
                    <TableHead>Vendor Call ID</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Call Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className={`cursor-pointer ${selectedTasks.has(task.id) ? "bg-primary/10" : ""}`}
                      onClick={() => toggleTaskSelection(task.id)}
                    >
                      <TableCell>
                        {selectedTasks.has(task.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{task.scsId}</TableCell>
                      <TableCell>{task.vendorCallId}</TableCell>
                      <TableCell>{task.vendor}</TableCell>
                      <TableCell>{task.customerName}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{task.callDescription}</TableCell>
                      <TableCell>{new Date(task.callDate).toLocaleDateString()}</TableCell>
                      <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                      <TableCell>{task.assignedTo || "—"}</TableCell>
                      <TableCell>₹{task.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {uploaded && matchedTasks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No tasks matched the vendor IDs in the uploaded file.
            </div>
          )}

          {!uploaded && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Upload an Excel file with a <strong>"Vendor ID"</strong> column to match against tasks.</p>
              <p className="text-xs mt-1">Supported formats: .xlsx, .xls, .csv</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
