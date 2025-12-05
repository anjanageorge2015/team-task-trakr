import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Users, Wallet, CreditCard, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  full_name: string | null;
}

interface PayrollByUser {
  user_id: string;
  full_name: string;
  totalSalary: number;
  totalAdvances: number;
  balanceDue: number;
  payrollCount: number;
}

interface PayrollByMonth {
  month: string;
  totalSalary: number;
  totalAdvances: number;
  balanceDue: number;
  employeeCount: number;
}

interface AdvanceByUser {
  user_id: string;
  full_name: string;
  totalAdvances: number;
  advanceCount: number;
}

interface ExpenseByCategory {
  category: string;
  totalAmount: number;
  count: number;
  pendingCount: number;
  approvedCount: number;
}

interface ExpenseByUser {
  user_id: string;
  full_name: string;
  totalAmount: number;
  count: number;
  pendingAmount: number;
  approvedAmount: number;
}

export function FinOpsReports() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [metrics, setMetrics] = useState({
    totalExpenses: 0,
    totalPayroll: 0,
    pendingExpenses: 0,
    employeeCount: 0,
    totalAdvances: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payrollByUser, setPayrollByUser] = useState<PayrollByUser[]>([]);
  const [payrollByMonth, setPayrollByMonth] = useState<PayrollByMonth[]>([]);
  const [advancesByUser, setAdvancesByUser] = useState<AdvanceByUser[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);
  const [expensesByUser, setExpensesByUser] = useState<ExpenseByUser[]>([]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (profiles.length > 0) {
      fetchAllData();
    }
  }, [period, profiles]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    setProfiles(data || []);
  };

  const getProfileName = (userId: string) => {
    return profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';
  };

  const getStartDate = () => {
    const now = new Date();
    let startDate = new Date();
    if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === 'quarter') {
      startDate.setMonth(now.getMonth() - 3);
    } else {
      startDate.setFullYear(now.getFullYear() - 1);
    }
    return startDate;
  };

  const fetchAllData = async () => {
    const startDate = getStartDate();
    await Promise.all([
      fetchMetrics(startDate),
      fetchPayrollByUser(startDate),
      fetchPayrollByMonth(startDate),
      fetchAdvancesByUser(startDate),
      fetchExpensesByCategory(startDate),
      fetchExpensesByUser(startDate),
    ]);
  };

  const fetchMetrics = async (startDate: Date) => {
    try {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, status')
        .gte('expense_date', startDate.toISOString());

      const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      const pendingExpenses = expenses?.filter(exp => exp.status === 'pending').length || 0;

      const { data: payroll } = await supabase
        .from('payroll')
        .select('net_pay')
        .gte('pay_period_end', startDate.toISOString());

      const totalPayroll = payroll?.reduce((sum, pay) => sum + Number(pay.net_pay || 0), 0) || 0;

      const { data: advances } = await supabase
        .from('advances')
        .select('amount')
        .gte('advance_date', startDate.toISOString());

      const totalAdvances = advances?.reduce((sum, adv) => sum + Number(adv.amount), 0) || 0;

      setMetrics({
        totalExpenses,
        totalPayroll,
        pendingExpenses,
        employeeCount: profiles.length,
        totalAdvances,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchPayrollByUser = async (startDate: Date) => {
    try {
      const { data: payroll } = await supabase
        .from('payroll')
        .select('employee_user_id, net_pay, pay_period_start, pay_period_end')
        .gte('pay_period_end', startDate.toISOString());

      const { data: advances } = await supabase
        .from('advances')
        .select('employee_user_id, amount')
        .gte('advance_date', startDate.toISOString());

      const userMap = new Map<string, PayrollByUser>();

      payroll?.forEach(p => {
        const existing = userMap.get(p.employee_user_id) || {
          user_id: p.employee_user_id,
          full_name: getProfileName(p.employee_user_id),
          totalSalary: 0,
          totalAdvances: 0,
          balanceDue: 0,
          payrollCount: 0,
        };
        existing.totalSalary += Number(p.net_pay || 0);
        existing.payrollCount += 1;
        userMap.set(p.employee_user_id, existing);
      });

      advances?.forEach(a => {
        const existing = userMap.get(a.employee_user_id);
        if (existing) {
          existing.totalAdvances += Number(a.amount);
        }
      });

      userMap.forEach(user => {
        user.balanceDue = user.totalSalary - user.totalAdvances;
      });

      setPayrollByUser(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching payroll by user:', error);
    }
  };

  const fetchPayrollByMonth = async (startDate: Date) => {
    try {
      const { data: payroll } = await supabase
        .from('payroll')
        .select('employee_user_id, net_pay, pay_period_end')
        .gte('pay_period_end', startDate.toISOString());

      const { data: advances } = await supabase
        .from('advances')
        .select('employee_user_id, amount, advance_date')
        .gte('advance_date', startDate.toISOString());

      const monthMap = new Map<string, PayrollByMonth>();

      payroll?.forEach(p => {
        const monthKey = format(new Date(p.pay_period_end), 'yyyy-MM');
        const existing = monthMap.get(monthKey) || {
          month: monthKey,
          totalSalary: 0,
          totalAdvances: 0,
          balanceDue: 0,
          employeeCount: 0,
        };
        existing.totalSalary += Number(p.net_pay || 0);
        existing.employeeCount += 1;
        monthMap.set(monthKey, existing);
      });

      advances?.forEach(a => {
        const monthKey = format(new Date(a.advance_date), 'yyyy-MM');
        const existing = monthMap.get(monthKey);
        if (existing) {
          existing.totalAdvances += Number(a.amount);
        }
      });

      monthMap.forEach(month => {
        month.balanceDue = month.totalSalary - month.totalAdvances;
      });

      const sorted = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
      setPayrollByMonth(sorted);
    } catch (error) {
      console.error('Error fetching payroll by month:', error);
    }
  };

  const fetchAdvancesByUser = async (startDate: Date) => {
    try {
      const { data: advances } = await supabase
        .from('advances')
        .select('employee_user_id, amount')
        .gte('advance_date', startDate.toISOString());

      const userMap = new Map<string, AdvanceByUser>();

      advances?.forEach(a => {
        const existing = userMap.get(a.employee_user_id) || {
          user_id: a.employee_user_id,
          full_name: getProfileName(a.employee_user_id),
          totalAdvances: 0,
          advanceCount: 0,
        };
        existing.totalAdvances += Number(a.amount);
        existing.advanceCount += 1;
        userMap.set(a.employee_user_id, existing);
      });

      setAdvancesByUser(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching advances by user:', error);
    }
  };

  const fetchExpensesByCategory = async (startDate: Date) => {
    try {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('category, amount, status')
        .gte('expense_date', startDate.toISOString());

      const categoryMap = new Map<string, ExpenseByCategory>();

      expenses?.forEach(e => {
        const existing = categoryMap.get(e.category) || {
          category: e.category,
          totalAmount: 0,
          count: 0,
          pendingCount: 0,
          approvedCount: 0,
        };
        existing.totalAmount += Number(e.amount);
        existing.count += 1;
        if (e.status === 'pending') existing.pendingCount += 1;
        if (e.status === 'approved' || e.status === 'paid') existing.approvedCount += 1;
        categoryMap.set(e.category, existing);
      });

      setExpensesByCategory(Array.from(categoryMap.values()));
    } catch (error) {
      console.error('Error fetching expenses by category:', error);
    }
  };

  const fetchExpensesByUser = async (startDate: Date) => {
    try {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('created_by, amount, status')
        .gte('expense_date', startDate.toISOString());

      const userMap = new Map<string, ExpenseByUser>();

      expenses?.forEach(e => {
        const existing = userMap.get(e.created_by) || {
          user_id: e.created_by,
          full_name: getProfileName(e.created_by),
          totalAmount: 0,
          count: 0,
          pendingAmount: 0,
          approvedAmount: 0,
        };
        existing.totalAmount += Number(e.amount);
        existing.count += 1;
        if (e.status === 'pending') existing.pendingAmount += Number(e.amount);
        if (e.status === 'approved' || e.status === 'paid') existing.approvedAmount += Number(e.amount);
        userMap.set(e.created_by, existing);
      });

      setExpensesByUser(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching expenses by user:', error);
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const downloadCSV = (data: any[], headers: string[], filename: string) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const key = h.toLowerCase().replace(/ /g, '_').replace(/[()]/g, '');
        const value = row[key] ?? row[Object.keys(row).find(k => k.toLowerCase().includes(key.split('_')[0])) || ''] ?? '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success(`${filename} exported successfully`);
  };

  const exportPayrollByUser = () => {
    const data = payrollByUser.map(item => ({
      employee: item.full_name,
      total_salary: item.totalSalary.toFixed(2),
      total_advances: item.totalAdvances.toFixed(2),
      balance_due: item.balanceDue.toFixed(2),
      pay_periods: item.payrollCount,
    }));
    downloadCSV(data, ['Employee', 'Total_Salary', 'Total_Advances', 'Balance_Due', 'Pay_Periods'], 'Payroll_By_User');
  };

  const exportPayrollByMonth = () => {
    const data = payrollByMonth.map(item => ({
      month: format(new Date(item.month + '-01'), 'MMMM yyyy'),
      total_salary: item.totalSalary.toFixed(2),
      total_advances: item.totalAdvances.toFixed(2),
      balance_due: item.balanceDue.toFixed(2),
      employees: item.employeeCount,
    }));
    downloadCSV(data, ['Month', 'Total_Salary', 'Total_Advances', 'Balance_Due', 'Employees'], 'Payroll_By_Month');
  };

  const exportAdvancesByUser = () => {
    const data = advancesByUser.map(item => ({
      employee: item.full_name,
      total_advances: item.totalAdvances.toFixed(2),
      number_of_advances: item.advanceCount,
    }));
    downloadCSV(data, ['Employee', 'Total_Advances', 'Number_Of_Advances'], 'Advances_By_User');
  };

  const exportExpensesByCategory = () => {
    const data = expensesByCategory.map(item => ({
      category: item.category,
      total_amount: item.totalAmount.toFixed(2),
      count: item.count,
      pending: item.pendingCount,
      approved: item.approvedCount,
    }));
    downloadCSV(data, ['Category', 'Total_Amount', 'Count', 'Pending', 'Approved'], 'Expenses_By_Category');
  };

  const exportExpensesByUser = () => {
    const data = expensesByUser.map(item => ({
      user: item.full_name,
      total_amount: item.totalAmount.toFixed(2),
      count: item.count,
      pending: item.pendingAmount.toFixed(2),
      approved: item.approvedAmount.toFixed(2),
    }));
    downloadCSV(data, ['User', 'Total_Amount', 'Count', 'Pending', 'Approved'], 'Expenses_By_User');
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">FinOps Reports</h2>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Last Month</SelectItem>
            <SelectItem value="quarter">Last Quarter</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Expenses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(metrics.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.pendingExpenses} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(metrics.totalPayroll)}</div>
            <p className="text-xs text-muted-foreground mt-1">Net pay</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Advances</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(metrics.totalAdvances)}</div>
            <p className="text-xs text-muted-foreground mt-1">Given to employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Spending</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(metrics.totalExpenses + metrics.totalPayroll)}</div>
            <p className="text-xs text-muted-foreground mt-1">Combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold">{metrics.employeeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports Tabs */}
      <Tabs defaultValue="payroll-user" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="payroll-user" className="text-xs md:text-sm">Payroll by User</TabsTrigger>
          <TabsTrigger value="payroll-month" className="text-xs md:text-sm">Payroll by Month</TabsTrigger>
          <TabsTrigger value="advances" className="text-xs md:text-sm">Advances by User</TabsTrigger>
          <TabsTrigger value="expense-category" className="text-xs md:text-sm">Expenses by Category</TabsTrigger>
          <TabsTrigger value="expense-user" className="text-xs md:text-sm">Expenses by User</TabsTrigger>
        </TabsList>

        {/* Payroll by User */}
        <TabsContent value="payroll-user">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Payroll Report by User
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportPayrollByUser} disabled={payrollByUser.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Total Salary</TableHead>
                    <TableHead className="text-right">Total Advances</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right">Pay Periods</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollByUser.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No payroll data found</TableCell>
                    </TableRow>
                  ) : (
                    payrollByUser.map((item) => (
                      <TableRow key={item.user_id}>
                        <TableCell className="font-medium">{item.full_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.totalSalary)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(item.totalAdvances)}</TableCell>
                        <TableCell className={`text-right font-semibold ${item.balanceDue < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrency(item.balanceDue)}
                        </TableCell>
                        <TableCell className="text-right">{item.payrollCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll by Month */}
        <TabsContent value="payroll-month">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payroll Report by Month
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportPayrollByMonth} disabled={payrollByMonth.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Total Salary</TableHead>
                    <TableHead className="text-right">Total Advances</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollByMonth.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No payroll data found</TableCell>
                    </TableRow>
                  ) : (
                    payrollByMonth.map((item) => (
                      <TableRow key={item.month}>
                        <TableCell className="font-medium">{format(new Date(item.month + '-01'), 'MMMM yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.totalSalary)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(item.totalAdvances)}</TableCell>
                        <TableCell className={`text-right font-semibold ${item.balanceDue < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {formatCurrency(item.balanceDue)}
                        </TableCell>
                        <TableCell className="text-right">{item.employeeCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advances by User */}
        <TabsContent value="advances">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Advances Report by User
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportAdvancesByUser} disabled={advancesByUser.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Total Advances</TableHead>
                    <TableHead className="text-right">Number of Advances</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advancesByUser.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">No advances data found</TableCell>
                    </TableRow>
                  ) : (
                    advancesByUser.map((item) => (
                      <TableRow key={item.user_id}>
                        <TableCell className="font-medium">{item.full_name}</TableCell>
                        <TableCell className="text-right text-orange-600 font-semibold">{formatCurrency(item.totalAdvances)}</TableCell>
                        <TableCell className="text-right">{item.advanceCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses by Category */}
        <TabsContent value="expense-category">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Expense Report by Category
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportExpensesByCategory} disabled={expensesByCategory.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesByCategory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No expense data found</TableCell>
                    </TableRow>
                  ) : (
                    expensesByCategory.map((item) => (
                      <TableRow key={item.category}>
                        <TableCell className="font-medium capitalize">{item.category}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalAmount)}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right text-yellow-600">{item.pendingCount}</TableCell>
                        <TableCell className="text-right text-green-600">{item.approvedCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses by User */}
        <TabsContent value="expense-user">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Expense Report by User
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportExpensesByUser} disabled={expensesByUser.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesByUser.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No expense data found</TableCell>
                    </TableRow>
                  ) : (
                    expensesByUser.map((item) => (
                      <TableRow key={item.user_id}>
                        <TableCell className="font-medium">{item.full_name}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalAmount)}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right text-yellow-600">{formatCurrency(item.pendingAmount)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(item.approvedAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
