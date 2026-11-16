import { useEffect, useState } from "react";
import { Task } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { X, Calendar, User, MapPin, FileText, Edit, IndianRupee, ExternalLink } from "lucide-react";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskAttachments } from "./TaskAttachments";

interface TaskDetailsProps {
  task: Task;
  onClose: () => void;
  onEdit: () => void;
  isAdmin: boolean;
}

export function TaskDetails({ task, onClose, onEdit, isAdmin }: TaskDetailsProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payeeUpiId, setPayeeUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setPaymentAmount(task.amount > 0 ? String(task.amount) : "");
  }, [task.id, task.amount]);

  const openUpiApp = () => {
    const upiId = payeeUpiId.trim();
    const amount = Number(paymentAmount);
    if (!/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(upiId)) {
      toast({ variant: "destructive", title: "Check the UPI ID", description: "Enter a valid payee UPI ID, such as name@bank." });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Check the amount", description: "Enter an amount greater than ₹0." });
      return;
    }

    const params = new URLSearchParams({
      pa: upiId,
      am: amount.toFixed(2),
      cu: "INR",
      tn: `Task ${task.scsId}`,
    });
    if (payeeName.trim()) params.set("pn", payeeName.trim());
    window.location.assign(`upi://pay?${params.toString()}`);
    setPaymentOpen(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto max-h-[85vh] overflow-y-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Task Details - {task.scsId}
            <TaskStatusBadge status={task.status} />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Task
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close task details">
              <X className="h-4 w-4" />
            </Button>
          </div>
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

        {isAdmin && (
          <div className="border-t pt-4">
            <Button variant="outline" className="gap-2" onClick={() => setPaymentOpen(true)}>
              <IndianRupee className="h-4 w-4" /> Prepare UPI payment
            </Button>
          </div>
        )}

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

      {isAdmin && (
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Prepare UPI payment</DialogTitle>
              <DialogDescription>
                SmartCore won’t process or record this payment. Review and approve it in your UPI app.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upi-payee-id">Payee UPI ID</Label>
                <Input id="upi-payee-id" autoComplete="off" value={payeeUpiId} onChange={(event) => setPayeeUpiId(event.target.value)} placeholder="name@bank" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upi-payee-name">Payee name (optional)</Label>
                <Input id="upi-payee-name" autoComplete="off" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} placeholder="Name shown in UPI app" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upi-payment-amount">Amount (₹)</Label>
                <Input id="upi-payment-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                <Button className="gap-2" onClick={openUpiApp}>
                  <ExternalLink className="h-4 w-4" /> Open UPI app
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}