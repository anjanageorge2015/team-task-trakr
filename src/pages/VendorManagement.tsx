import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Vendor {
  id: string;
  name: string;
  contact_info: string | null;
  created_at: string;
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_info: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Vendor name is required",
      });
      return;
    }

    try {
      if (editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update({
            name: formData.name.trim(),
            contact_info: formData.contact_info.trim() || null,
          })
          .eq('id', editingVendor.id);

        if (error) throw error;

        toast({
          title: "Vendor updated",
          description: "Vendor has been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert([{
            name: formData.name.trim(),
            contact_info: formData.contact_info.trim() || null,
          }]);

        if (error) throw error;

        toast({
          title: "Vendor created",
          description: "New vendor has been added successfully.",
        });
      }

      await fetchVendors();
      handleCancel();
    } catch (error) {
      console.error('Error saving vendor:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingVendor ? 'update' : 'create'} vendor`,
      });
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contact_info: vendor.contact_info || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (vendorId: string) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);

      if (error) throw error;

      await fetchVendors();
      toast({
        title: "Vendor deleted",
        description: "Vendor has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete vendor",
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVendor(null);
    setFormData({ name: "", contact_info: "" });
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.contact_info && vendor.contact_info.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle>Vendor Management</CardTitle>
            <Button onClick={() => setShowForm(true)} className="w-fit">
              <Plus className="h-4 w-4 mr-2" />
              New Vendor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div className="space-y-2 flex-1">
                      <div className="font-medium text-lg">{vendor.name}</div>
                      {vendor.contact_info && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Contact:</span> {vendor.contact_info}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(vendor.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full lg:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vendor)}
                        className="flex-1 lg:flex-none"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{vendor.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(vendor.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredVendors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No vendors found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{editingVendor ? 'Edit Vendor' : 'Create New Vendor'}</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Vendor Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter vendor name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_info">Contact Information</Label>
                  <Textarea
                    id="contact_info"
                    value={formData.contact_info}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_info: e.target.value }))}
                    placeholder="Enter contact information (optional)"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingVendor ? 'Update Vendor' : 'Create Vendor'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}