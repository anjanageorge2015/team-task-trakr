import { useEffect, useState } from "react";
import { format, endOfDay, startOfDay } from "date-fns";
import { ExternalLink, Pencil, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PaymentStatus = Database["public"]["Enums"]["expense_payment_status"];

interface PaymentRow {
  id: string;
  expense_id: string;
  payee_user_id: string | null;
  recipient_upi_id: string;
  status: PaymentStatus;
  bank_reference: string | null;
  initiated_at: string;
  paid_at: string | null;
  amount: number;
  description: string;
  payee_name: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
}

interface ExpenseRow {
  id: string;
  amount: number;
  description: string;
  created_by: string;
}

interface ExpensePaymentReportProps {
  startDate: Date;
  endDate: Date;
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  initiated: "Initiated",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function ExpensePaymentReport({ startDate, endDate }: ExpensePaymentReportProps) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [statusDraft, setStatusDraft] = useState<PaymentStatus>("initiated");
  const [referenceDraft, setReferenceDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void fetchPayments();
  }, [startDate, endDate]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const rows: Omit<PaymentRow, "amount" | "description" | "payee_name">[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("expense_payment_records")
          .select("id, expense_id, payee_user_id, recipient_upi_id, status, bank_reference, initiated_at, paid_at")
          .gte("initiated_at", startOfDay(startDate).toISOString())
          .lte("initiated_at", endOfDay(endDate).toISOString())
          .order("initiated_at", { ascending: false })
          .range(from, from + 999);

        if (error) throw error;
        const page = data || [];
        rows.push(...page);
        if (page.length < 1000) break;
        from += page.length;
      }

      if (rows.length === 0) {
        setPayments([]);
        return;
      }

      const expenseIds = [...new Set(rows.map((row) => row.expense_id))];
      const payeeIds = [...new Set(rows.flatMap((row) => row.payee_user_id ? [row.payee_user_id] : []))];
      const [expenseResult, profileResult] = await Promise.all([
        supabase.from("expenses").select("id, amount, description, created_by").in("id", expenseIds),
        payeeIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", payeeIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (expenseResult.error) throw expenseResult.error;
      if (profileResult.error) throw profileResult.error;

      const expenseById = new Map((expenseResult.data || []).map((expense: ExpenseRow) => [expense.id, expense]));
      const profileById = new Map((profileResult.data || []).map((profile: ProfileRow) => [profile.user_id, profile.full_name]));
      setPayments(rows.map((row) => {
        const expense = expenseById.get(row.expense_id);
        return {
          ...row,
          amount: Number(expense?.amount || 0),
          description: expense?.description || "Expense",
          payee_name: row.payee_user_id ? profileById.get(row.payee_user_id) || "Unknown user" : row.recipient_upi_id,
        };
      }));
    } catch (error) {
      console.error("Error fetching UPI payment report:", error);
      toast({ variant: "destructive", title: "Could not load UPI payments", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setStatusDraft(payment.status);
    setReferenceDraft(payment.bank_reference || "");
  };

  const saveResult = async () => {
    if (!selectedPayment) return;
    try {
      setSaving(true);
      const paidAt = statusDraft === "paid"
        ? selectedPayment.paid_at || new Date().toISOString()
        : null;
      const { error } = await supabase
        .from("expense_payment_records")
        .update({
          status: statusDraft,
          bank_reference: referenceDraft.trim() || null,
          paid_at: paidAt,
        })
        .eq("id", selectedPayment.id);
      if (error) throw error;
      toast({ title: "Payment record updated" });
      setSelectedPayment(null);
      await fetchPayments();
    } catch (error) {
      console.error("Error updating UPI payment:", error);
      toast({ variant: "destructive", title: "Could not update payment", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const header = ["Recipient", "UPI ID", "Expense", "Amount", "Initiated At", "Status", "Bank Reference", "Paid At"];
    const rows = payments.map((payment) => [
      payment.payee_name,
      payment.recipient_upi_id,
      payment.description,
      payment.amount.toFixed(2),
      format(new Date(payment.initiated_at), "yyyy-MM-dd HH:mm"),
      paymentStatusLabels[payment.status],
      payment.bank_reference || "",
      payment.paid_at ? format(new Date(payment.paid_at), "yyyy-MM-dd HH:mm") : "",
    ].map(escapeCsv).join(","));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([[header.map(escapeCsv).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }));
    link.download = `UPI_Payments_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const statusClass = (status: PaymentStatus) => {
    if (status === "paid") return "bg-primary/10 text-primary";
    if (status === "failed") return "bg-destructive/10 text-destructive";
    if (status === "cancelled") return "bg-muted text-muted-foreground";
    return "bg-accent text-accent-foreground";
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>UPI Payment Records</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Payment results are recorded manually and are not verified by the bank.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient / UPI ID</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bank Reference</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading payment records…</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No UPI payments in this date range.</TableCell></TableRow>
                ) : payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">{payment.payee_name}</div>
                      <div className="text-xs text-muted-foreground">{payment.recipient_upi_id}</div>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{payment.description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{format(new Date(payment.initiated_at), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell><span className={`rounded px-2 py-1 text-xs font-medium ${statusClass(payment.status)}`}>{paymentStatusLabels[payment.status]}</span></TableCell>
                    <TableCell>{payment.bank_reference || "—"}</TableCell>
                    <TableCell>{payment.paid_at ? format(new Date(payment.paid_at), "dd MMM yyyy, HH:mm") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditor(payment)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />Record result
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record UPI payment result</DialogTitle>
            <DialogDescription>
              Confirm the result in your UPI app or bank statement before marking it paid.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="font-medium">{selectedPayment.payee_name}</span>
                <span className="text-muted-foreground"> · {selectedPayment.recipient_upi_id} · {formatCurrency(selectedPayment.amount)}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-result-status">Payment status</Label>
                <Select value={statusDraft} onValueChange={(value: PaymentStatus) => setStatusDraft(value)}>
                  <SelectTrigger id="payment-result-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initiated">Initiated</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-bank-reference">Bank / UPI reference ID</Label>
                <Input id="payment-bank-reference" value={referenceDraft} onChange={(event) => setReferenceDraft(event.target.value)} autoComplete="off" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedPayment(null)}>Cancel</Button>
                <Button onClick={saveResult} disabled={saving}>
                  {saving ? "Saving…" : "Save result"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}