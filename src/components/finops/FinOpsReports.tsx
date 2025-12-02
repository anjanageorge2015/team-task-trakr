import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";

export function FinOpsReports() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [metrics, setMetrics] = useState({
    totalExpenses: 0,
    totalPayroll: 0,
    pendingExpenses: 0,
    employeeCount: 0,
  });

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    try {
      const now = new Date();
      let startDate = new Date();
      
      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, status')
        .gte('expense_date', startDate.toISOString());

      const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
      const pendingExpenses = expenses?.filter(exp => exp.status === 'pending').length || 0;

      // Fetch payroll
      const { data: payroll } = await supabase
        .from('payroll')
        .select('net_pay')
        .gte('pay_period_end', startDate.toISOString());

      const totalPayroll = payroll?.reduce((sum, pay) => sum + Number(pay.net_pay), 0) || 0;

      // Fetch employee count
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id', { count: 'exact' });

      setMetrics({
        totalExpenses,
        totalPayroll,
        pendingExpenses,
        employeeCount: profiles?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.pendingExpenses} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalPayroll.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              For selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(metrics.totalExpenses + metrics.totalPayroll).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined expenses & payroll
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.employeeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total active employees
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
