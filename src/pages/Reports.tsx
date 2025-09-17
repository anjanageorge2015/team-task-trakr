import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/types/task";

interface Vendor {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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
      "Assigned To"
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
        `"${task.assignedTo}"`
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
                <div className="text-2xl font-bold text-primary">${summary.totalAmount.toLocaleString()}</div>
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
                     <th className="text-left p-2">SCS ID</th>
                     <th className="text-left p-2">Vendor Call ID</th>
                     <th className="text-left p-2">Vendor</th>
                     <th className="text-left p-2">Customer</th>
                     <th className="text-left p-2">Call Date</th>
                     <th className="text-left p-2">Status</th>
                     <th className="text-left p-2">Assigned To</th>
                     <th className="text-left p-2">Amount</th>
                   </tr>
                 </thead>
                <tbody>
                   {filteredTasks.map((task) => (
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
                       <td className="p-2">${task.amount.toLocaleString()}</td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}