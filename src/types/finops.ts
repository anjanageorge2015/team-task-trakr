export type ExpenseCategory = 'travel' | 'supplies' | 'services' | 'equipment' | 'utilities' | 'maintenance' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type PayrollStatus = 'draft' | 'approved' | 'paid';

export interface Expense {
  id: string;
  created_at: string;
  updated_at: string;
  expense_date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  vendor_id?: string;
  receipt_url?: string;
  status: ExpenseStatus;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
}

export interface Payroll {
  id: string;
  created_at: string;
  updated_at: string;
  employee_user_id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_pay: number;
  payment_date?: string;
  status: PayrollStatus;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface Advance {
  id: string;
  created_at: string;
  updated_at: string;
  employee_user_id: string;
  advance_date: string;
  amount: number;
  notes?: string;
  created_by: string;
}
