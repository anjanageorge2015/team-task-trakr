import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

export function useUserRoles(userId?: string) {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchUserRoles(userId);
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchUserRoles = async (targetUserId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId);

      if (error) throw error;
      
      setRoles(data?.map(item => item.role as UserRole) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch user roles",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (targetUserId: string, role: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: targetUserId,
          role: role,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      await fetchUserRoles(targetUserId);
      toast({
        title: "Role assigned",
        description: `${role} role has been assigned successfully.`,
      });
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign role",
      });
    }
  };

  const removeRole = async (targetUserId: string, role: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', role);

      if (error) throw error;

      await fetchUserRoles(targetUserId);
      toast({
        title: "Role removed",
        description: `${role} role has been removed successfully.`,
      });
    } catch (error) {
      console.error('Error removing role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove role",
      });
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = (): boolean => {
    return hasRole('Admin');
  };

  const isMember = (): boolean => {
    return hasRole('Member');
  };

  return {
    roles,
    loading,
    assignRole,
    removeRole,
    hasRole,
    isAdmin,
    isMember,
    refetch: () => userId && fetchUserRoles(userId)
  };
}