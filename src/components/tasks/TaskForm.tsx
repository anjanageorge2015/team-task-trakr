import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Task, TaskStatus } from "@/types/task";
import { supabase } from "@/integrations/supabase/client";
import { X, Plus } from "lucide-react";
import { VendorForm } from "@/components/vendors/VendorForm";
import { TaskAttachments } from "./TaskAttachments";

interface TaskFormProps {
  task?: Task;
  onSubmit: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isAdmin: boolean;
}

export function TaskForm({ task, onSubmit, onCancel, isAdmin }: TaskFormProps) {
  const [formData, setFormData] = useState({
    scsId: task?.scsId || '',
    vendorCallId: task?.vendorCallId || '',
    vendor: task?.vendor || '',
    callDescription: task?.callDescription || '',
    callDate: task?.callDate || new Date().toISOString().split('T')[0],
    customerName: task?.customerName || '',
    customerAddress: task?.customerAddress || '',
    remarks: task?.remarks || '',
    scsRemarks: task?.scsRemarks || '',
    amount: task?.amount || 0,
    status: task?.status || 'unassigned' as TaskStatus,
    assignedTo: task?.assignedTo || 'unassigned',
  });

  const [vendors, setVendors] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [showVendorForm, setShowVendorForm] = useState(false);

  useEffect(() => {
    fetchVendors();
    fetchTeamMembers();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('name')
        .order('name');

      if (error) throw error;
      setVendors(data.map(v => v.name));
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data.map(p => p.full_name).filter(Boolean));
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{task ? 'Edit Task' : 'Create New Task'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scsId">SCS ID</Label>
                <Input
                  id="scsId"
                  value={formData.scsId}
                  onChange={(e) => handleInputChange('scsId', e.target.value)}
                  placeholder="Auto-generated"
                  disabled={!task}
                />
              </div>
              <div>
                <Label htmlFor="vendorCallId">
                  Vendor Call ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendorCallId"
                  value={formData.vendorCallId}
                  onChange={(e) => handleInputChange('vendorCallId', e.target.value)}
                  placeholder="Enter vendor call ID"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="vendor">Vendor</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVendorForm(true)}
                  className="h-6 px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              <Select value={formData.vendor} onValueChange={(value) => handleInputChange('vendor', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor} value={vendor}>
                      {vendor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="callDescription">Call Description</Label>
              <Textarea
                id="callDescription"
                value={formData.callDescription}
                onChange={(e) => handleInputChange('callDescription', e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="callDate">Call Date</Label>
                <Input
                  id="callDate"
                  type="date"
                  value={formData.callDate}
                  onChange={(e) => handleInputChange('callDate', e.target.value)}
                  required
                />
              </div>
              {isAdmin && (
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="customerAddress">Customer Address</Label>
              <Textarea
                id="customerAddress"
                value={formData.customerAddress}
                onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="repeat">Repeat</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange('assignedTo', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="scsRemarks">SCS Remarks</Label>
              <Textarea
                id="scsRemarks"
                value={formData.scsRemarks}
                onChange={(e) => handleInputChange('scsRemarks', e.target.value)}
                rows={2}
              />
            </div>

            {task && (
              <div className="pt-4 border-t">
                <TaskAttachments taskId={task.id} />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {task ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showVendorForm && (
        <VendorForm
          onVendorCreated={(vendorName) => {
            setVendors(prev => [...prev, vendorName]);
            handleInputChange('vendor', vendorName);
            setShowVendorForm(false);
          }}
          onCancel={() => setShowVendorForm(false)}
        />
      )}
    </div>
  );
}