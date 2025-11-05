import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/types/task";
import { TaskForm } from "@/components/tasks/TaskForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Vendor {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

type SortField = 'scsId' | 'vendorCallId' | 'vendor' | 'customerName' | 'callDate' | 'status' | 'assignedTo' | 'amount' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export default function Reports() {
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sortField, setSortField] = useState<SortField>('callDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles(user?.id);

  useEffect(() => {
    fetchVendors();
    fetchProfiles();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch vendors",
      });
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .not('full_name', 'is', null)
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch profiles",
      });
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select both start and end dates",
      });
      return;
    }

    setIsGenerating(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          vendor:vendors(name),
          assigned_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .gte('call_date', format(startDate, 'yyyy-MM-dd'))
        .lte('call_date', format(endDate, 'yyyy-MM-dd'));

      if (selectedVendor !== "all") {
        query = query.eq('vendor_id', selectedVendor);
      }

      if (selectedAssignedTo !== "all") {
        query = query.eq('assigned_to', selectedAssignedTo);
      }

      if (selectedStatus !== "all") {
        query = query.eq('status', selectedStatus as Task['status']);
      }

      const { data, error } = await query.order('call_date', { ascending: false });

      if (error) throw error;

      const formattedTasks: Task[] = data.map(task => ({
        id: task.id,
        scsId: task.scs_id,
        vendorCallId: task.vendor_call_id,
        vendor: task.vendor?.name || '',
        callDescription: task.call_description,
        callDate: task.call_date,
        customerName: task.customer_name,
        customerAddress: task.customer_address || '',
        remarks: task.remarks || '',
        scsRemarks: task.scs_remarks || '',
        amount: task.amount || 0,
        status: task.status as Task['status'],
        assignedTo: task.assigned_profile?.full_name || '',
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }));

      setFilteredTasks(formattedTasks);
      toast({
        title: "Report generated",
        description: `Found ${formattedTasks.length} tasks matching your criteria`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate report",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToCSV = () => {
    if (filteredTasks.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data to export. Please generate a report first.",
      });
      return;
    }

    const headers = [
      "SCS ID",
      "Vendor Call ID", 
      "Vendor",
      "Call Description",
      "Call Date",
      "Customer Name",
      "Customer Address",
      "Remarks",
      "SCS Remarks",
      "Amount",
      "Status",
      "Assigned To",
      "Last Modified Date"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredTasks.map(task => [
        task.scsId,
        task.vendorCallId,
        `"${task.vendor}"`,
        `"${task.callDescription}"`,
        task.callDate,
        `"${task.customerName}"`,
        `"${task.customerAddress}"`,
        `"${task.remarks}"`,
        `"${task.scsRemarks}"`,
        task.amount,
        task.status,
        `"${task.assignedTo}"`,
        format(new Date(task.updatedAt), 'MMM dd, yyyy HH:mm')
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report exported",
      description: "CSV file has been downloaded successfully",
    });
  };

  const getReportSummary = () => {
    if (filteredTasks.length === 0) return null;

    const totalAmount = filteredTasks.reduce((sum, task) => sum + task.amount, 0);
    const statusCounts = filteredTasks.reduce((counts, task) => {
      counts[task.status] = (counts[task.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return { totalAmount, statusCounts, totalTasks: filteredTasks.length };
  };

  const summary = getReportSummary();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedTasks = () => {
    return [...filteredTasks].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Convert to comparable values
      if (sortField === 'callDate' || sortField === 'updatedAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const sortedTasks = getSortedTasks();

  const handleEditTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          vendor:vendors(name),
          assigned_profile:profiles!tasks_assigned_to_fkey(full_name)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;

      const taskData: Task = {
        id: data.id,
        scsId: data.scs_id,
        vendorCallId: data.vendor_call_id,
        vendor: data.vendor?.name || '',
        callDescription: data.call_description,
        callDate: data.call_date,
        customerName: data.customer_name,
        customerAddress: data.customer_address || '',
        remarks: data.remarks || '',
        scsRemarks: data.scs_remarks || '',
        amount: data.amount || 0,
        status: data.status,
        assignedTo: data.assigned_profile?.full_name || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setEditingTask(taskData);
    } catch (error) {
      console.error('Error fetching task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load task details",
      });
    }
  };

  const handleUpdateTask = async (updatedTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingTask) return;

    try {
      // Get vendor_id from vendor name
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', updatedTaskData.vendor)
        .single();

      // Get assigned_to user_id from full_name
      let assignedToId = null;
      if (updatedTaskData.assignedTo && updatedTaskData.assignedTo !== 'unassigned') {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('full_name', updatedTaskData.assignedTo)
          .single();
        assignedToId = profileData?.user_id;
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          vendor_call_id: updatedTaskData.vendorCallId,
          vendor_id: vendorData?.id,
          call_description: updatedTaskData.callDescription,
          call_date: updatedTaskData.callDate,
          customer_name: updatedTaskData.customerName,
          customer_address: updatedTaskData.customerAddress,
          remarks: updatedTaskData.remarks,
          scs_remarks: updatedTaskData.scsRemarks,
          amount: updatedTaskData.amount,
          status: updatedTaskData.status,
          assigned_to: assignedToId,
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      toast({
        title: "Task updated",
        description: "Task has been updated successfully",
      });

      setEditingTask(null);
      generateReport(); // Refresh the report
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reports Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select value={selectedAssignedTo} onValueChange={setSelectedAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="repeat">Reopen</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={generateReport} 
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Report"}
            </Button>
            
            {filteredTasks.length > 0 && (
              <Button 
                onClick={exportToCSV}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{summary.totalTasks}</div>
                <div className="text-sm text-muted-foreground">Total Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">₹{summary.totalAmount.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Status Breakdown</div>
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="capitalize">{status.replace('_', ' ')}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b">
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('scsId')}>
                       SCS ID <SortIcon field="scsId" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('vendorCallId')}>
                       Vendor Call ID <SortIcon field="vendorCallId" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('vendor')}>
                       Vendor <SortIcon field="vendor" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('customerName')}>
                       Customer <SortIcon field="customerName" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('callDate')}>
                       Call Date <SortIcon field="callDate" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('status')}>
                       Status <SortIcon field="status" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('assignedTo')}>
                       Assigned To <SortIcon field="assignedTo" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('amount')}>
                       Amount <SortIcon field="amount" />
                     </th>
                     <th className="text-left p-2 cursor-pointer hover:bg-accent/50" onClick={() => handleSort('updatedAt')}>
                        Last Modified <SortIcon field="updatedAt" />
                      </th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                 </thead>
                <tbody>
                   {sortedTasks.map((task) => (
                       <tr key={task.id} className="border-b">
                        <td className="p-2">{task.scsId}</td>
                        <td className="p-2">{task.vendorCallId}</td>
                        <td className="p-2">{task.vendor}</td>
                        <td className="p-2">{task.customerName}</td>
                        <td className="p-2">{format(new Date(task.callDate), 'MMM dd, yyyy')}</td>
                        <td className="p-2">
                          <span className="capitalize">{task.status.replace('_', ' ')}</span>
                        </td>
                        <td className="p-2">{task.assignedTo || 'Unassigned'}</td>
                        <td className="p-2">₹{task.amount.toLocaleString()}</td>
                        <td className="p-2">{format(new Date(task.updatedAt), 'MMM dd, yyyy HH:mm')}</td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTask(task.id)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={handleUpdateTask}
          onCancel={() => setEditingTask(null)}
          isAdmin={isAdmin()}
        />
      )}
    </div>
  );
}