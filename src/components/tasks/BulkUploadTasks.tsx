import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileSpreadsheet, AlertTriangle, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkUploadTasksProps {
  onClose: () => void;
  onComplete?: () => void;
}

interface ParsedRow {
  vendorCallId: string;
  callDescription: string;
  customerName: string;
  customerAddress: string;
}

interface FileUploadResult {
  fileName: string;
  detectedVendor: string;
  vendorId: string;
  callDate: string;
  rows: ParsedRow[];
  duplicateIds: string[];
}

// Column header mappings by vendor (case-insensitive, normalized)
const VENDOR_COLUMN_MAPS: Record<string, { vendorCallId: string[]; callDescription: string[]; customerName: string[]; customerAddress: string[] }> = {
  LENOVO: {
    vendorCallId: ["wo#", "work order id", "workorderid"],
    callDescription: ["msn#", "serial number"],
    customerName: ["customer name", "company name", "companyname"],
    customerAddress: ["customer address", "partner customer address"],
  },
  DELL: {
    vendorCallId: ["ser", "service request", "service request number"],
    callDescription: ["sevice tag", "service tag", "servicetag"],
    customerName: ["company name", "companyname"],
    customerAddress: ["address"],
  },
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function findKey(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  // 1. Exact match (case-insensitive)
  for (const c of candidates) {
    const target = norm(c);
    const found = keys.find((k) => norm(k) === target);
    if (found) return found;
  }
  // 2. Contains match — only for candidates long enough to be safe (>= 5 chars)
  for (const c of candidates) {
    const target = norm(c);
    if (target.length < 5) continue;
    const found = keys.find((k) => norm(k).includes(target));
    if (found) return found;
  }
  return undefined;
}

function detectVendor(fileName: string): string | null {
  const upperName = fileName.toUpperCase();
  for (const v of Object.keys(VENDOR_COLUMN_MAPS)) {
    if (upperName.includes(v)) {
      return v;
    }
  }
  return null;
}

function detectCallDate(fileName: string): string {
  const dateMatch = fileName.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (dateMatch) {
    const [, dd, mm, yyyy] = dateMatch;
    const parsedDate = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(parsedDate.getTime())) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return new Date().toISOString().split("T")[0];
}

function getDefaultAmount(vendor: string): number {
  if (vendor === "DELL") return 320;
  if (vendor === "LENOVO") return 375;
  return 0;
}

async function parseFile(file: File): Promise<FileUploadResult | null> {
  const matchedVendor = detectVendor(file.name);
  if (!matchedVendor) return null;

  const callDate = detectCallDate(file.name);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawRows.length) {
          resolve({
            fileName: file.name,
            detectedVendor: matchedVendor,
            vendorId: "",
            callDate,
            rows: [],
            duplicateIds: [],
          });
          return;
        }

        const map = VENDOR_COLUMN_MAPS[matchedVendor];
        const first = rawRows[0];
        const kVid = findKey(first, map.vendorCallId);
        const kDesc = findKey(first, map.callDescription);
        const kCust = findKey(first, map.customerName);
        const kAddr = findKey(first, map.customerAddress);

        const parsed: ParsedRow[] = rawRows
          .map((r) => ({
            vendorCallId: kVid ? String(r[kVid] ?? "").trim() : "",
            callDescription: kDesc ? String(r[kDesc] ?? "").trim() : "",
            customerName: kCust ? String(r[kCust] ?? "").trim() : "",
            customerAddress: kAddr ? String(r[kAddr] ?? "").trim() : "",
          }))
          .filter((r) => r.vendorCallId);

        resolve({
          fileName: file.name,
          detectedVendor: matchedVendor,
          vendorId: "",
          callDate,
          rows: parsed,
          duplicateIds: [],
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function BulkUploadTasks({ onClose, onComplete }: BulkUploadTasksProps) {
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalRows = uploadResults.reduce((sum, r) => sum + r.rows.length, 0);
  const totalVisibleRows = uploadResults.reduce(
    (sum, r) => sum + r.rows.filter((row) => !r.duplicateIds.includes(row.vendorCallId)).length,
    0
  );
  const totalDuplicates = uploadResults.reduce((sum, r) => sum + r.duplicateIds.length, 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const { data: vendors } = await supabase.from("vendors").select("id, name");
    const vendorNameToId: Record<string, string> = {};
    vendors?.forEach((v) => {
      vendorNameToId[v.name.toUpperCase()] = v.id;
    });

    const newResults: FileUploadResult[] = [];
    let hasErrors = false;

    for (const file of files) {
      const matchedVendor = detectVendor(file.name);
      if (!matchedVendor) {
        toast({
          variant: "destructive",
          title: "Unknown vendor",
          description: `${file.name} must include a known vendor (e.g., ${Object.keys(VENDOR_COLUMN_MAPS).join(", ")}).`,
        });
        hasErrors = true;
        continue;
      }

      const vendorId = vendorNameToId[matchedVendor];
      if (!vendorId) {
        toast({
          variant: "destructive",
          title: "Vendor not found",
          description: `Vendor "${matchedVendor}" doesn't exist for ${file.name}. Please add it in Vendor Management first.`,
        });
        hasErrors = true;
        continue;
      }

      try {
        const result = await parseFile(file);
        if (!result) continue;
        result.vendorId = vendorId;
        newResults.push(result);
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Parse error", description: `Failed to parse ${file.name}.` });
        hasErrors = true;
      }
    }

    if (!newResults.length) {
      if (hasErrors) {
        toast({ variant: "destructive", title: "No files parsed", description: "Please fix the errors and try again." });
      }
      return;
    }

    // Check duplicates against existing tasks and within the uploaded batch
    const allParsedIds = newResults.flatMap((r) => r.rows.map((row) => row.vendorCallId));
    const { data: existing } = await supabase
      .from("tasks")
      .select("vendor_call_id")
      .in("vendor_call_id", allParsedIds);
    const existingSet = new Set((existing || []).map((t) => t.vendor_call_id));

    // Track duplicates within the uploaded batch across files (first occurrence wins)
    const seenInBatch = new Set<string>();
    const resultsWithDups = newResults.map((result) => {
      const duplicateIds: string[] = [];
      result.rows.forEach((row) => {
        if (existingSet.has(row.vendorCallId) || seenInBatch.has(row.vendorCallId)) {
          if (!duplicateIds.includes(row.vendorCallId)) {
            duplicateIds.push(row.vendorCallId);
          }
        } else {
          seenInBatch.add(row.vendorCallId);
        }
      });
      return { ...result, duplicateIds };
    });

    setUploadResults((prev) => [...prev, ...resultsWithDups]);

    const totalDupCount = resultsWithDups.reduce((sum, r) => sum + r.duplicateIds.length, 0);
    if (totalDupCount > 0) {
      setShowDupDialog(true);
    }

    toast({
      title: "Files parsed",
      description: `${resultsWithDups.length} file(s) parsed, ${totalRows + resultsWithDups.reduce((s, r) => s + r.rows.length, 0)} total row(s)${totalDupCount ? `, ${totalDupCount} duplicate(s) detected` : ""}.`,
    });

    // Reset file input so the same files can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id;
    if (!userId) return;

    const toInsert = uploadResults.flatMap((result) => {
      const dupSet = new Set(result.duplicateIds);
      return result.rows
        .filter((r) => !dupSet.has(r.vendorCallId))
        .map((r) => ({
          vendor_call_id: r.vendorCallId,
          vendor_id: result.vendorId,
          call_description: r.callDescription || "—",
          call_date: result.callDate,
          customer_name: r.customerName || "—",
          customer_address: r.customerAddress || null,
          status: "unassigned" as const,
          assigned_to: null,
          created_by: userId,
          commission_percentage: 0,
          amount: getDefaultAmount(result.detectedVendor),
        }));
    });

    if (!toInsert.length) {
      toast({ variant: "destructive", title: "Nothing to save", description: "All rows are duplicates." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("tasks").insert(toInsert);
    setSaving(false);

    if (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }

    toast({ title: "Tasks created", description: `${toInsert.length} task(s) added successfully.` });
    onComplete?.();
    onClose();
  };

  const handleConfirmDuplicates = () => {
    setShowDupDialog(false);
  };

  const removeFile = (index: number) => {
    setUploadResults((prev) => prev.filter((_, i) => i !== index));
  };

  const allDuplicateIds = Array.from(new Set(uploadResults.flatMap((r) => r.duplicateIds)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Upload Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Vendor Excel File(s)
            </Button>
            {totalRows > 0 && (
              <Button onClick={handleSave} disabled={saving} className="ml-auto">
                <Save className="h-4 w-4 mr-2" />
                Save {totalVisibleRows} Task(s)
              </Button>
            )}
          </div>

          {uploadResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Uploaded Files</h4>
              <div className="flex flex-wrap gap-2">
                {uploadResults.map((result, index) => (
                  <Badge key={index} variant="secondary" className="gap-2 pl-3 pr-2 py-1.5">
                    <span className="truncate max-w-[200px]">{result.fileName}</span>
                    <span className="text-muted-foreground">({result.detectedVendor})</span>
                    <span className="text-muted-foreground">
                      {result.rows.length - result.duplicateIds.length}/{result.rows.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      aria-label={`Remove ${result.fileName}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {totalDuplicates > 0 && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-destructive">
                  {totalDuplicates} duplicate(s) will be skipped across {uploadResults.length} file(s):
                </span>{" "}
                <span className="text-muted-foreground">{allDuplicateIds.slice(0, 10).join(", ")}{allDuplicateIds.length > 10 ? "..." : ""}</span>
              </div>
            </div>
          )}

          {totalVisibleRows > 0 && (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Vendor Call ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Customer Address</TableHead>
                    <TableHead>Call Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResults.flatMap((result) =>
                    result.rows
                      .filter((r) => !result.duplicateIds.includes(r.vendorCallId))
                      .map((r, i) => (
                        <TableRow key={`${result.fileName}-${i}`}>
                          <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{result.fileName}</TableCell>
                          <TableCell className="font-medium">{r.vendorCallId}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{r.callDescription || "—"}</TableCell>
                          <TableCell>{r.customerName || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{r.customerAddress || "—"}</TableCell>
                          <TableCell>{new Date(result.callDate).toLocaleDateString()}</TableCell>
                          <TableCell>Unassigned</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {uploadResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Upload one or more vendor Excel files. File names should contain the vendor name (e.g., <strong>LENOVO</strong>, <strong>DELL</strong>).</p>
              <p className="text-xs mt-1">Required column: <strong>Work Order ID</strong></p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDupDialog} onOpenChange={setShowDupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Vendor Call IDs Found</AlertDialogTitle>
            <AlertDialogDescription>
              {totalDuplicates} record(s) already exist in the system or appear multiple times across uploaded files:{" "}
              <strong className="text-foreground">{allDuplicateIds.slice(0, 10).join(", ")}{allDuplicateIds.length > 10 ? "..." : ""}</strong>.
              <br /><br />
              Click <strong>OK</strong> to skip duplicates and save only the new records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicates}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
