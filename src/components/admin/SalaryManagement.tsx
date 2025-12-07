import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

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
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SalaryManagementProps {
  isAdmin: boolean;
}

export function SalaryManagement({ isAdmin }: SalaryManagementProps) {
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<EmployeeSalary | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    employee_user_id: '',
    monthly_salary: '',
    effective_from: format(new Date(), 'yyyy-MM-dd'),
    effective_to: '',
    notes: '',
  });

  useEffect(() => {
    fetchSalaries();
    fetchProfiles();
  }, []);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('*')
        .order('effective_from', { ascending: false });

      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error('Error fetching salaries:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch salary records',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const getEmployeeName = (userId: string): string => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || userId;
  };

  const resetForm = () => {
    setFormData({
      employee_user_id: '',
      monthly_salary: '',
      effective_from: format(new Date(), 'yyyy-MM-dd'),
      effective_to: '',
      notes: '',
    });
    setEditingSalary(null);
  };

  const handleSubmit = async () => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only admins can manage employee salaries',
      });
      return;
    }

    if (!formData.employee_user_id || !formData.monthly_salary || !formData.effective_from) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    try {
      const currentUser = await supabase.auth.getUser();
      const salaryData = {
        employee_user_id: formData.employee_user_id,
        monthly_salary: parseFloat(formData.monthly_salary),
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || null,
        notes: formData.notes || null,
        created_by: currentUser.data.user?.id,
      };

      if (editingSalary) {
        const { error } = await supabase
          .from('employee_salaries')
          .update(salaryData)
          .eq('id', editingSalary.id);

        if (error) throw error;

        toast({
          title: 'Salary Updated',
          description: 'Employee salary record has been updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('employee_salaries')
          .insert([salaryData]);

        if (error) throw error;

        toast({
          title: 'Salary Added',
          description: 'Employee salary record has been created successfully.',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSalaries();
    } catch (error) {
      console.error('Error saving salary:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save salary record',
      });
    }
  };

  const handleEdit = (salary: EmployeeSalary) => {
    setEditingSalary(salary);
    setFormData({
      employee_user_id: salary.employee_user_id,
      monthly_salary: salary.monthly_salary.toString(),
      effective_from: salary.effective_from,
      effective_to: salary.effective_to || '',
      notes: salary.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only admins can delete salary records',
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this salary record?')) return;

    try {
      const { error } = await supabase
        .from('employee_salaries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Salary Deleted',
        description: 'Employee salary record has been deleted.',
      });
      fetchSalaries();
    } catch (error) {
      console.error('Error deleting salary:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete salary record',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Manage Employee Salaries
        </CardTitle>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Salary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSalary ? 'Edit Salary Record' : 'Add Salary Record'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="employee">Employee *</Label>
                  <Select
                    value={formData.employee_user_id}
                    onValueChange={(value) => setFormData({ ...formData, employee_user_id: value })}
                  >
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
                  <Label htmlFor="salary">Monthly Salary *</Label>
                  <Input
                    id="salary"
                    type="number"
                    step="0.01"
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                    placeholder="Enter monthly salary"
                  />
                </div>
                <div>
                  <Label htmlFor="effective_from">Effective From *</Label>
                  <Input
                    id="effective_from"
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="effective_to">Effective To (Optional)</Label>
                  <Input
                    id="effective_to"
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingSalary ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {salaries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No salary records found. {isAdmin && 'Click "Add Salary" to create one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Monthly Salary</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Notes</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-medium">
                      {getEmployeeName(salary.employee_user_id)}
                    </TableCell>
                    <TableCell>${salary.monthly_salary.toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(salary.effective_from), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {salary.effective_to 
                        ? format(new Date(salary.effective_to), 'MMM dd, yyyy') 
                        : 'Current'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {salary.notes || '-'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(salary)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDelete(salary.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}