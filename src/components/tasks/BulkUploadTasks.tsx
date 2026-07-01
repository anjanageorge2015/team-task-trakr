import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, X, FileSpreadsheet, AlertTriangle, Save } from "lucide-react";
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

// Column header mappings by vendor (case-insensitive, normalized)
const VENDOR_COLUMN_MAPS: Record<string, { vendorCallId: string[]; callDescription: string[]; customerName: string[]; customerAddress: string[] }> = {
  LENOVO: {
    vendorCallId: ["work order id", "workorderid"],
    callDescription: ["serial number (case) (case)", "serial number (case)", "serial number"],
    customerName: ["company name", "companyname"],
    customerAddress: ["partner customer address", "customer address"],
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

export function BulkUploadTasks({ onClose, onComplete }: BulkUploadTasksProps) {
  const [fileName, setFileName] = useState("");
  const [detectedVendor, setDetectedVendor] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");
  const [callDate, setCallDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    // Detect vendor from file name
    const upperName = file.name.toUpperCase();
    let matchedVendor = "";
    for (const v of Object.keys(VENDOR_COLUMN_MAPS)) {
      if (upperName.includes(v)) {
        matchedVendor = v;
        break;
      }
    }

    if (!matchedVendor) {
      toast({
        variant: "destructive",
        title: "Unknown vendor",
        description: `File name must include a known vendor (e.g., ${Object.keys(VENDOR_COLUMN_MAPS).join(", ")}).`,
      });
      return;
    }
    setDetectedVendor(matchedVendor);

    // Parse date from filename (VENDOR-DD.MM.YYYY), fallback to today
    const dateMatch = file.name.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
    if (dateMatch) {
      const [, dd, mm, yyyy] = dateMatch;
      setCallDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setCallDate(new Date().toISOString().split("T")[0]);
    }

    // Match vendor in DB (case-insensitive)
    const { data: vendors } = await supabase.from("vendors").select("id, name");
    const vendor = vendors?.find((v) => v.name.toUpperCase() === matchedVendor);
    if (!vendor) {
      toast({
        variant: "destructive",
        title: "Vendor not found",
        description: `Vendor "${matchedVendor}" doesn't exist. Please add it in Vendor Management first.`,
      });
      return;
    }
    setVendorId(vendor.id);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawRows.length) {
          toast({ variant: "destructive", title: "Empty file", description: "No data rows found." });
          return;
        }

        const map = VENDOR_COLUMN_MAPS[matchedVendor];
        const first = rawRows[0];
        const kVid = findKey(first, map.vendorCallId);
        const kDesc = findKey(first, map.callDescription);
        const kCust = findKey(first, map.customerName);
        const kAddr = findKey(first, map.customerAddress);

        if (!kVid) {
          toast({ variant: "destructive", title: "Column not found", description: `Could not find "Work Order ID" column.` });
          return;
        }

        const parsed: ParsedRow[] = rawRows
          .map((r) => ({
            vendorCallId: String(r[kVid] ?? "").trim(),
            callDescription: kDesc ? String(r[kDesc] ?? "").trim() : "",
            customerName: kCust ? String(r[kCust] ?? "").trim() : "",
            customerAddress: kAddr ? String(r[kAddr] ?? "").trim() : "",
          }))
          .filter((r) => r.vendorCallId);

        if (!parsed.length) {
          toast({ variant: "destructive", title: "No valid rows", description: "No rows with Work Order ID found." });
          return;
        }

        // Check duplicates against existing tasks
        const ids = parsed.map((r) => r.vendorCallId);
        const { data: existing } = await supabase
          .from("tasks")
          .select("vendor_call_id")
          .in("vendor_call_id", ids);
        const existingSet = new Set((existing || []).map((t) => t.vendor_call_id));
        const dups = parsed.filter((r) => existingSet.has(r.vendorCallId)).map((r) => r.vendorCallId);

        setRows(parsed);
        setDuplicateIds(dups);

        if (dups.length > 0) {
          setShowDupDialog(true);
        }

        toast({
          title: "File parsed",
          description: `${parsed.length} row(s) parsed${dups.length ? `, ${dups.length} duplicate(s) detected` : ""}.`,
        });
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Parse error", description: "Failed to parse the Excel file." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id;
    if (!userId || !vendorId) return;

    const dupSet = new Set(duplicateIds);
    const toInsert = rows
      .filter((r) => !dupSet.has(r.vendorCallId))
      .map((r) => ({
        vendor_call_id: r.vendorCallId,
        vendor_id: vendorId,
        call_description: r.callDescription || "—",
        call_date: callDate,
        customer_name: r.customerName || "—",
        customer_address: r.customerAddress || null,
        status: "unassigned" as const,
        assigned_to: null,
        created_by: userId,
        commission_percentage: 0,
        amount: detectedVendor === "DELL" ? 320 : detectedVendor === "LENOVO" ? 375 : 0,
      }));

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

  const visibleRows = rows.filter((r) => !duplicateIds.includes(r.vendorCallId));

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
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              {fileName || "Upload Vendor Excel File"}
            </Button>
            {detectedVendor && (
              <span className="text-sm text-muted-foreground">
                Detected vendor: <strong className="text-foreground">{detectedVendor}</strong>
              </span>
            )}
            {rows.length > 0 && (
              <Button onClick={handleSave} disabled={saving} className="ml-auto">
                <Save className="h-4 w-4 mr-2" />
                Save {visibleRows.length} Task(s)
              </Button>
            )}
          </div>

          {duplicateIds.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-destructive">
                  {duplicateIds.length} duplicate(s) will be skipped:
                </span>{" "}
                <span className="text-muted-foreground">{duplicateIds.join(", ")}</span>
              </div>
            </div>
          )}

          {visibleRows.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Call ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Customer Address</TableHead>
                    <TableHead>Call Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.vendorCallId}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.callDescription || "—"}</TableCell>
                      <TableCell>{r.customerName || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.customerAddress || "—"}</TableCell>
                      <TableCell>{new Date().toLocaleDateString()}</TableCell>
                      <TableCell>Unassigned</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!fileName && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Upload a vendor Excel file. The file name should contain the vendor name (e.g., <strong>LENOVO</strong>, <strong>DELL</strong>).</p>
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
              {duplicateIds.length} record(s) already exist in the system:{" "}
              <strong className="text-foreground">{duplicateIds.slice(0, 10).join(", ")}{duplicateIds.length > 10 ? "..." : ""}</strong>.
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
