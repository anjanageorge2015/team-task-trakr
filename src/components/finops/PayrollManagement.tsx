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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Payroll, PayrollStatus, Advance } from "@/types/finops";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface PayrollManagementProps {
  isAdmin: boolean;
  userId: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface EmployeeSalary {
  id: string;
  employee_user_id: string;
  monthly_salary: number;
  effective_from: string;
  effective_to: string | null;
}

export function PayrollManagement({ isAdmin, userId }: PayrollManagementProps) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employeeSalaries, setEmployeeSalaries] = useState<EmployeeSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<Advance | null>(null);
  const { toast } = useToast();

  const [payrollFormData, setPayrollFormData] = useState({
    employee_user_id: '',
    pay_period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    pay_period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    base_salary: '',
    bonuses: '0',
    deductions: '0',
    payment_date: '',
    status: 'draft' as PayrollStatus,
    notes: '',
  });

  const [advanceFormData, setAdvanceFormData] = useState({
    employee_user_id: '',
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    notes: '',
  });

  useEffect(() => {
    fetchPayrolls();
    fetchAdvances();
    fetchProfiles();
    fetchEmployeeSalaries();
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

  const fetchAdvances = async () => {
    try {
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .order('advance_date', { ascending: false });

      if (error) throw error;
      setAdvances(data || []);
    } catch (error) {
      console.error('Error fetching advances:', error);
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

  const fetchEmployeeSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('id, employee_user_id, monthly_salary, effective_from, effective_to')
        .order('effective_from', { ascending: false });

      if (error) throw error;
      setEmployeeSalaries(data || []);
    } catch (error) {
      console.error('Error fetching employee salaries:', error);
    }
  };

  // Get current salary for an employee based on pay period
  const getCurrentSalary = (employeeUserId: string, payPeriodStart: string): number | null => {
    const periodDate = new Date(payPeriodStart);
    const salary = employeeSalaries.find(s => {
      if (s.employee_user_id !== employeeUserId) return false;
      const effectiveFrom = new Date(s.effective_from);
      const effectiveTo = s.effective_to ? new Date(s.effective_to) : null;
      return effectiveFrom <= periodDate && (!effectiveTo || effectiveTo >= periodDate);
    });
    return salary?.monthly_salary ?? null;
  };

  // Handle employee selection to auto-populate salary
  const handleEmployeeChange = (employeeUserId: string) => {
    const currentSalary = getCurrentSalary(employeeUserId, payrollFormData.pay_period_start);
    setPayrollFormData({ 
      ...payrollFormData, 
      employee_user_id: employeeUserId,
      base_salary: currentSalary !== null ? currentSalary.toString() : payrollFormData.base_salary
    });
  };

  const handlePayrollSubmit = async (e: React.FormEvent) => {
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
        employee_user_id: payrollFormData.employee_user_id,
        pay_period_start: payrollFormData.pay_period_start,
        pay_period_end: payrollFormData.pay_period_end,
        base_salary: parseFloat(payrollFormData.base_salary),
        bonuses: parseFloat(payrollFormData.bonuses),
        deductions: parseFloat(payrollFormData.deductions),
        payment_date: payrollFormData.payment_date || null,
        status: payrollFormData.status,
        notes: payrollFormData.notes || null,
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

      setIsPayrollDialogOpen(false);
      resetPayrollForm();
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

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Unauthorized",
        description: "Only admins can create/edit advance records",
      });
      return;
    }

    try {
      const advanceData = {
        employee_user_id: advanceFormData.employee_user_id,
        advance_date: advanceFormData.advance_date,
        amount: parseFloat(advanceFormData.amount),
        notes: advanceFormData.notes || null,
        created_by: userId,
      };

      if (editingAdvance) {
        const { error } = await supabase
          .from('advances')
          .update(advanceData)
          .eq('id', editingAdvance.id);

        if (error) throw error;
        toast({ title: "Success", description: "Advance updated successfully" });
      } else {
        const { error } = await supabase
          .from('advances')
          .insert(advanceData);

        if (error) throw error;
        toast({ title: "Success", description: "Advance created successfully" });
      }

      setIsAdvanceDialogOpen(false);
      resetAdvanceForm();
      fetchAdvances();
    } catch (error) {
      console.error('Error saving advance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save advance record",
      });
    }
  };

  const handlePayrollDelete = async (id: string) => {
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

  const handleAdvanceDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this advance record?')) return;

    try {
      const { error } = await supabase
        .from('advances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Advance deleted successfully" });
      fetchAdvances();
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete advance record",
      });
    }
  };

  const openPayrollEditDialog = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setPayrollFormData({
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
    setIsPayrollDialogOpen(true);
  };

  const openAdvanceEditDialog = (advance: Advance) => {
    setEditingAdvance(advance);
    setAdvanceFormData({
      employee_user_id: advance.employee_user_id,
      advance_date: advance.advance_date,
      amount: advance.amount.toString(),
      notes: advance.notes || '',
    });
    setIsAdvanceDialogOpen(true);
  };

  const resetPayrollForm = () => {
    setEditingPayroll(null);
    setPayrollFormData({
      employee_user_id: '',
      pay_period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      pay_period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      base_salary: '',
      bonuses: '0',
      deductions: '0',
      payment_date: '',
      status: 'draft',
      notes: '',
    });
  };

  const resetAdvanceForm = () => {
    setEditingAdvance(null);
    setAdvanceFormData({
      employee_user_id: '',
      advance_date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      notes: '',
    });
  };

  const getEmployeeName = (employeeUserId: string) => {
    const profile = profiles.find(p => p.user_id === employeeUserId);
    return profile?.full_name || profile?.email || 'Unknown';
  };

  // Calculate total advances for a given employee within a pay period
  const getAdvancesForPeriod = (employeeUserId: string, periodStart: string, periodEnd: string) => {
    return advances.filter(adv => 
      adv.employee_user_id === employeeUserId &&
      adv.advance_date >= periodStart &&
      adv.advance_date <= periodEnd
    );
  };

  const getTotalAdvancesForPeriod = (employeeUserId: string, periodStart: string, periodEnd: string) => {
    const periodAdvances = getAdvancesForPeriod(employeeUserId, periodStart, periodEnd);
    return periodAdvances.reduce((sum, adv) => sum + adv.amount, 0);
  };

  // Calculate balance due (salary - advances)
  const getBalanceDue = (payroll: Payroll) => {
    const totalAdvances = getTotalAdvancesForPeriod(
      payroll.employee_user_id,
      payroll.pay_period_start,
      payroll.pay_period_end
    );
    return (payroll.net_pay || 0) - totalAdvances;
  };

  if (loading) {
    return <div className="p-8">Loading payroll records...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Tabs defaultValue="payroll" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Payroll Management</CardTitle>
              {isAdmin && (
                <Dialog open={isPayrollDialogOpen} onOpenChange={(open) => {
                  setIsPayrollDialogOpen(open);
                  if (!open) resetPayrollForm();
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
                    <form onSubmit={handlePayrollSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="employee">Employee</Label>
                        <Select value={payrollFormData.employee_user_id} onValueChange={handleEmployeeChange}>
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
                            value={payrollFormData.pay_period_start}
                            onChange={(e) => setPayrollFormData({ ...payrollFormData, pay_period_start: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="pay_period_end">Period End</Label>
                          <Input
                            id="pay_period_end"
                            type="date"
                            value={payrollFormData.pay_period_end}
                            onChange={(e) => setPayrollFormData({ ...payrollFormData, pay_period_end: e.target.value })}
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
                          value={payrollFormData.base_salary}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, base_salary: e.target.value })}
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
                            value={payrollFormData.bonuses}
                            onChange={(e) => setPayrollFormData({ ...payrollFormData, bonuses: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="deductions">Deductions</Label>
                          <Input
                            id="deductions"
                            type="number"
                            step="0.01"
                            value={payrollFormData.deductions}
                            onChange={(e) => setPayrollFormData({ ...payrollFormData, deductions: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="payment_date">Payment Date</Label>
                        <Input
                          id="payment_date"
                          type="date"
                          value={payrollFormData.payment_date}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, payment_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={payrollFormData.status} onValueChange={(value) => setPayrollFormData({ ...payrollFormData, status: value as PayrollStatus })}>
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
                          value={payrollFormData.notes}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsPayrollDialogOpen(false)}>
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
                    <TableHead>Advances</TableHead>
                    <TableHead>Balance Due</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map((payroll) => {
                    const totalAdvances = getTotalAdvancesForPeriod(
                      payroll.employee_user_id,
                      payroll.pay_period_start,
                      payroll.pay_period_end
                    );
                    const balanceDue = getBalanceDue(payroll);
                    
                    return (
                      <TableRow key={payroll.id}>
                        <TableCell>{getEmployeeName(payroll.employee_user_id)}</TableCell>
                        <TableCell>
                          {format(new Date(payroll.pay_period_start), 'MMM dd')} - {format(new Date(payroll.pay_period_end), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>${payroll.base_salary.toFixed(2)}</TableCell>
                        <TableCell>${(payroll.bonuses || 0).toFixed(2)}</TableCell>
                        <TableCell>${(payroll.deductions || 0).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${(payroll.net_pay || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-orange-600">${totalAdvances.toFixed(2)}</TableCell>
                        <TableCell className={`font-semibold ${balanceDue < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${balanceDue.toFixed(2)}
                        </TableCell>
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
                              <Button size="sm" variant="outline" onClick={() => openPayrollEditDialog(payroll)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handlePayrollDelete(payroll.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Advance Payments</CardTitle>
              {isAdmin && (
                <Dialog open={isAdvanceDialogOpen} onOpenChange={(open) => {
                  setIsAdvanceDialogOpen(open);
                  if (!open) resetAdvanceForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Advance
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingAdvance ? 'Edit Advance' : 'Add New Advance'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdvanceSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="advance_employee">Employee</Label>
                        <Select value={advanceFormData.employee_user_id} onValueChange={(value) => setAdvanceFormData({ ...advanceFormData, employee_user_id: value })}>
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
                      <div>
                        <Label htmlFor="advance_date">Advance Date</Label>
                        <Input
                          id="advance_date"
                          type="date"
                          value={advanceFormData.advance_date}
                          onChange={(e) => setAdvanceFormData({ ...advanceFormData, advance_date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="advance_amount">Amount</Label>
                        <Input
                          id="advance_amount"
                          type="number"
                          step="0.01"
                          value={advanceFormData.amount}
                          onChange={(e) => setAdvanceFormData({ ...advanceFormData, amount: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="advance_notes">Notes</Label>
                        <Textarea
                          id="advance_notes"
                          value={advanceFormData.notes}
                          onChange={(e) => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsAdvanceDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingAdvance ? 'Update' : 'Create'}
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
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((advance) => (
                    <TableRow key={advance.id}>
                      <TableCell>{getEmployeeName(advance.employee_user_id)}</TableCell>
                      <TableCell>{format(new Date(advance.advance_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>${advance.amount.toFixed(2)}</TableCell>
                      <TableCell>{advance.notes || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openAdvanceEditDialog(advance)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAdvanceDelete(advance.id)}>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}