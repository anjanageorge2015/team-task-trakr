import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VendorFormProps {
  onVendorCreated: (vendorName: string) => void;
  onCancel: () => void;
}

export function VendorForm({ onVendorCreated, onCancel }: VendorFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    contactInfo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          name: formData.name,
          contact_info: formData.contactInfo || null,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Vendor created",
        description: "New vendor has been created successfully.",
      });

      onVendorCreated(data.name);
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Create New Vendor</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
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
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="contactInfo">Contact Information</Label>
              <Textarea
                id="contactInfo"
                value={formData.contactInfo}
                onChange={(e) => handleInputChange('contactInfo', e.target.value)}
                rows={3}
                placeholder="Phone, email, address, etc."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Vendor'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}