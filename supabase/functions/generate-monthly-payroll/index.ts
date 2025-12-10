import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate pay period for previous month
    const now = new Date();
    const payPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    const payPeriodStart = new Date(payPeriodEnd.getFullYear(), payPeriodEnd.getMonth(), 1); // First day of previous month

    const payPeriodStartStr = payPeriodStart.toISOString().split('T')[0];
    const payPeriodEndStr = payPeriodEnd.toISOString().split('T')[0];

    console.log(`Generating payroll for period: ${payPeriodStartStr} to ${payPeriodEndStr}`);

    // Fetch all active employee salaries for the pay period
    const { data: salaries, error: salariesError } = await supabase
      .from('employee_salaries')
      .select('employee_user_id, monthly_salary')
      .lte('effective_from', payPeriodEndStr)
      .or(`effective_to.is.null,effective_to.gte.${payPeriodStartStr}`);

    if (salariesError) {
      console.error('Error fetching salaries:', salariesError);
      throw salariesError;
    }

    if (!salaries || salaries.length === 0) {
      console.log('No active salaries found for the period');
      return new Response(JSON.stringify({ message: 'No active salaries found', created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for existing payroll records to avoid duplicates
    const { data: existingPayrolls, error: existingError } = await supabase
      .from('payroll')
      .select('employee_user_id')
      .eq('pay_period_start', payPeriodStartStr)
      .eq('pay_period_end', payPeriodEndStr);

    if (existingError) {
      console.error('Error checking existing payrolls:', existingError);
      throw existingError;
    }

    const existingEmployeeIds = new Set(existingPayrolls?.map(p => p.employee_user_id) || []);

    // Get unique employees (latest salary per employee)
    const employeeSalaryMap = new Map<string, number>();
    for (const salary of salaries) {
      if (!employeeSalaryMap.has(salary.employee_user_id)) {
        employeeSalaryMap.set(salary.employee_user_id, salary.monthly_salary);
      }
    }

    // Get advances for each employee in the pay period
    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select('employee_user_id, amount')
      .gte('advance_date', payPeriodStartStr)
      .lte('advance_date', payPeriodEndStr);

    if (advancesError) {
      console.error('Error fetching advances:', advancesError);
      throw advancesError;
    }

    // Calculate total advances per employee
    const advancesMap = new Map<string, number>();
    for (const advance of advances || []) {
      const current = advancesMap.get(advance.employee_user_id) || 0;
      advancesMap.set(advance.employee_user_id, current + Number(advance.amount));
    }

    // Create payroll records for employees without existing records
    const payrollRecords = [];
    for (const [employeeUserId, baseSalary] of employeeSalaryMap) {
      if (existingEmployeeIds.has(employeeUserId)) {
        console.log(`Skipping employee ${employeeUserId} - payroll already exists`);
        continue;
      }

      const totalAdvances = advancesMap.get(employeeUserId) || 0;
      const netPay = baseSalary - totalAdvances;

      payrollRecords.push({
        employee_user_id: employeeUserId,
        pay_period_start: payPeriodStartStr,
        pay_period_end: payPeriodEndStr,
        base_salary: baseSalary,
        bonuses: 0,
        deductions: totalAdvances,
        net_pay: netPay,
        status: 'draft',
        created_by: employeeUserId, // Self-created by system
        notes: 'Auto-generated payroll record',
      });
    }

    if (payrollRecords.length === 0) {
      console.log('All payroll records already exist for this period');
      return new Response(JSON.stringify({ message: 'All payroll records already exist', created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: insertedPayrolls, error: insertError } = await supabase
      .from('payroll')
      .insert(payrollRecords)
      .select();

    if (insertError) {
      console.error('Error inserting payroll records:', insertError);
      throw insertError;
    }

    console.log(`Successfully created ${insertedPayrolls?.length || 0} payroll records`);

    return new Response(JSON.stringify({ 
      message: 'Payroll records generated successfully', 
      created: insertedPayrolls?.length || 0,
      period: { start: payPeriodStartStr, end: payPeriodEndStr }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating payroll:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
