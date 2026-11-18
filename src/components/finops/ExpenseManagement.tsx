import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Expense, ExpenseCategory, ExpensePaymentType, ExpenseStatus } from "@/types/finops";
import { format } from "date-fns";

interface ExpenseManagementProps {
  isAdmin: boolean;
  userId: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function ExpenseManagement({ isAdmin, userId }: ExpenseManagementProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedUserUpiId, setSelectedUserUpiId] = useState("");
  const [loadingUpiId, setLoadingUpiId] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: 'other' as ExpenseCategory,
    description: '',
    vendor_id: '',
    created_by: userId,
    payment_type: 'Others' as ExpensePaymentType,
  });

  useEffect(() => {
    fetchExpenses();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!isAdmin || !isDialogOpen || formData.payment_type !== "UPI" || !formData.created_by) {
      setSelectedUserUpiId("");
      setLoadingUpiId(false);
      return;
    }

    let cancelled = false;
    const loadUserUpiId = async () => {
      setLoadingUpiId(true);
      setSelectedUserUpiId("");
      const { data, error } = await supabase
        .from("user_payment_details")
        .select("upi_id")
        .eq("user_id", formData.created_by)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ variant: "destructive", title: "Could not load UPI ID", description: "Please try selecting the user again." });
      } else {
        setSelectedUserUpiId(data?.upi_id || "");
      }
      setLoadingUpiId(false);
    };

    void loadUserUpiId();
    return () => { cancelled = true; };
  }, [isAdmin, isDialogOpen, formData.payment_type, formData.created_by, toast]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses((data || []).map((expense) => ({
        ...expense,
        payment_type: (expense.payment_type === "UPI" ? "UPI" : "Others") as ExpensePaymentType,
      })));
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch expenses",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const expenseAmount = Number(formData.amount);
    const shouldInitiateUpi = !editingExpense && isAdmin && formData.payment_type === "UPI";
    if (shouldInitiateUpi && !selectedUserUpiId) {
      toast({ variant: "destructive", title: "UPI ID unavailable", description: "Add a UPI ID for the selected user before initiating payment." });
      return;
    }
    if (shouldInitiateUpi && (!Number.isFinite(expenseAmount) || expenseAmount <= 0)) {
      toast({ variant: "destructive", title: "Check the amount", description: "Enter an amount greater than ₹0 for a UPI payment." });
      return;
    }
    
    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            expense_date: formData.expense_date,
            amount: parseFloat(formData.amount),
            category: formData.category,
            description: formData.description,
            vendor_id: formData.vendor_id || null,
            payment_type: formData.payment_type,
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast({ title: "Success", description: "Expense updated successfully" });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            expense_date: formData.expense_date,
            amount: parseFloat(formData.amount),
            category: formData.category,
            description: formData.description,
            vendor_id: formData.vendor_id || null,
            created_by: formData.created_by,
            payment_type: formData.payment_type,
          });

        if (error) throw error;
        if (shouldInitiateUpi) {
          const selectedUser = users.find((user) => user.user_id === formData.created_by);
          const params = new URLSearchParams({
            pa: selectedUserUpiId,
            am: expenseAmount.toFixed(2),
            cu: "INR",
            tn: formData.description.trim().slice(0, 80) || "Expense payment",
          });
          if (selectedUser?.full_name) params.set("pn", selectedUser.full_name);
          window.location.assign(`upi://pay?${params.toString()}`);
        }
        toast({ title: "Success", description: "Expense created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save expense",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted successfully" });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense",
      });
    }
  };

  const handleStatusChange = async (id: string, status: ExpenseStatus) => {
    try {
      const updateData: any = { status };
      if (status === 'approved') {
        updateData.approved_by = userId;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: `Expense ${status} successfully` });
      fetchExpenses();
    } catch (error) {
      console.error('Error updating expense status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update expense status",
      });
    }
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date,
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description,
      vendor_id: expense.vendor_id || '',
      created_by: expense.created_by,
      payment_type: expense.payment_type === "UPI" ? "UPI" : "Others",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      category: 'other',
      description: '',
      vendor_id: '',
      created_by: userId,
      payment_type: 'Others',
    });
  };

  if (loading) {
    return <div className="p-8">Loading expenses...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expense Management</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="expense_date">Date</Label>
                  <Input
                    id="expense_date"
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="petrol">Petrol</SelectItem>
                      <SelectItem value="office_expense">Office Expense</SelectItem>
                      <SelectItem value="other">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="created_by">User</Label>
                  <Select value={formData.created_by} onValueChange={(value) => setFormData({ ...formData, created_by: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name || user.email || user.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expense-payment-type">Payment Type</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value: ExpensePaymentType) => setFormData({ ...formData, payment_type: value })}
                  >
                    <SelectTrigger id="expense-payment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="UPI">UPI</SelectItem>}
                      <SelectItem value="Others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && formData.payment_type === "UPI" && (
                  <div>
                    <Label htmlFor="expense-user-upi-id">Selected user’s UPI ID</Label>
                    <Input
                      id="expense-user-upi-id"
                      value={loadingUpiId ? "Loading UPI ID…" : selectedUserUpiId || "No UPI ID saved for this user"}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loadingUpiId || (isAdmin && formData.payment_type === "UPI" && !editingExpense && !selectedUserUpiId)}>
                    {editingExpense ? 'Update' : isAdmin && formData.payment_type === "UPI" ? <><ExternalLink className="h-4 w-4 mr-2" />Create and Initiate UPI</> : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const expenseUser = users.find(u => u.user_id === expense.created_by);
                return (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{expenseUser?.full_name || expenseUser?.email || '-'}</TableCell>
                  <TableCell>${expense.amount.toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{expense.category === 'office_expense' ? 'Office Expense' : expense.category}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                      expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      expense.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {expense.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {expense.status === 'pending' && expense.created_by === userId && (
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(expense)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {isAdmin && expense.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(expense.id, 'approved')}>
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(expense.id, 'rejected')}>
                            <XCircle className="h-3 w-3 text-red-600" />
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(expense.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
