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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Payroll, PayrollStatus } from "@/types/finops";
import { format } from "date-fns";

interface PayrollManagementProps {
  isAdmin: boolean;
  userId: string;
}

export function PayrollManagement({ isAdmin, userId }: PayrollManagementProps) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    employee_user_id: '',
    pay_period_start: format(new Date(), 'yyyy-MM-dd'),
    pay_period_end: format(new Date(), 'yyyy-MM-dd'),
    base_salary: '',
    bonuses: '0',
    deductions: '0',
    payment_date: '',
    status: 'draft' as PayrollStatus,
    notes: '',
  });

  useEffect(() => {
    fetchPayrolls();
    fetchProfiles();
  }, []);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payroll')
        .select('*')
        .order('pay_period_end', { ascending: false });

      if (error) throw error;
      setPayrolls(data || []);
    } catch (error) {
      console.error('Error fetching payroll:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch payroll records",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Unauthorized",
        description: "Only admins can create/edit payroll records",
      });
      return;
    }

    try {
      const payrollData = {
        employee_user_id: formData.employee_user_id,
        pay_period_start: formData.pay_period_start,
        pay_period_end: formData.pay_period_end,
        base_salary: parseFloat(formData.base_salary),
        bonuses: parseFloat(formData.bonuses),
        deductions: parseFloat(formData.deductions),
        payment_date: formData.payment_date || null,
        status: formData.status,
        notes: formData.notes || null,
        created_by: userId,
      };

      if (editingPayroll) {
        const { error } = await supabase
          .from('payroll')
          .update(payrollData)
          .eq('id', editingPayroll.id);

        if (error) throw error;
        toast({ title: "Success", description: "Payroll updated successfully" });
      } else {
        const { error } = await supabase
          .from('payroll')
          .insert(payrollData);

        if (error) throw error;
        toast({ title: "Success", description: "Payroll created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayrolls();
    } catch (error) {
      console.error('Error saving payroll:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save payroll record",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this payroll record?')) return;

    try {
      const { error } = await supabase
        .from('payroll')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Payroll deleted successfully" });
      fetchPayrolls();
    } catch (error) {
      console.error('Error deleting payroll:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete payroll record",
      });
    }
  };

  const openEditDialog = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setFormData({
      employee_user_id: payroll.employee_user_id,
      pay_period_start: payroll.pay_period_start,
      pay_period_end: payroll.pay_period_end,
      base_salary: payroll.base_salary.toString(),
      bonuses: payroll.bonuses.toString(),
      deductions: payroll.deductions.toString(),
      payment_date: payroll.payment_date || '',
      status: payroll.status,
      notes: payroll.notes || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPayroll(null);
    setFormData({
      employee_user_id: '',
      pay_period_start: format(new Date(), 'yyyy-MM-dd'),
      pay_period_end: format(new Date(), 'yyyy-MM-dd'),
      base_salary: '',
      bonuses: '0',
      deductions: '0',
      payment_date: '',
      status: 'draft',
      notes: '',
    });
  };

  const getEmployeeName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || 'Unknown';
  };

  if (loading) {
    return <div className="p-8">Loading payroll records...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payroll Management</CardTitle>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Payroll
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPayroll ? 'Edit Payroll' : 'Add New Payroll'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="employee">Employee</Label>
                    <Select value={formData.employee_user_id} onValueChange={(value) => setFormData({ ...formData, employee_user_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.user_id} value={profile.user_id}>
                            {profile.full_name || profile.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pay_period_start">Period Start</Label>
                      <Input
                        id="pay_period_start"
                        type="date"
                        value={formData.pay_period_start}
                        onChange={(e) => setFormData({ ...formData, pay_period_start: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="pay_period_end">Period End</Label>
                      <Input
                        id="pay_period_end"
                        type="date"
                        value={formData.pay_period_end}
                        onChange={(e) => setFormData({ ...formData, pay_period_end: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="base_salary">Base Salary</Label>
                    <Input
                      id="base_salary"
                      type="number"
                      step="0.01"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bonuses">Bonuses</Label>
                      <Input
                        id="bonuses"
                        type="number"
                        step="0.01"
                        value={formData.bonuses}
                        onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deductions">Deductions</Label>
                      <Input
                        id="deductions"
                        type="number"
                        step="0.01"
                        value={formData.deductions}
                        onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as PayrollStatus })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingPayroll ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Bonuses</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map((payroll) => (
                <TableRow key={payroll.id}>
                  <TableCell>{getEmployeeName(payroll.employee_user_id)}</TableCell>
                  <TableCell>
                    {format(new Date(payroll.pay_period_start), 'MMM dd')} - {format(new Date(payroll.pay_period_end), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>${payroll.base_salary.toFixed(2)}</TableCell>
                  <TableCell>${(payroll.bonuses || 0).toFixed(2)}</TableCell>
                  <TableCell>${(payroll.deductions || 0).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">${(payroll.net_pay || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      payroll.status === 'paid' ? 'bg-green-100 text-green-800' :
                      payroll.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {payroll.status}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(payroll)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(payroll.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
