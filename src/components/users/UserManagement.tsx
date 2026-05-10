import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserRoleBadge } from "./UserRoleBadge";
import { Search, UserPlus, Settings, Shield, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User, UserRole, USER_ROLES } from "@/types/user";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface UserFormState {
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
}

const emptyForm: UserFormState = { email: "", full_name: "", password: "", role: "Member" };

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRoles = useUserRoles(currentUser?.id);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: "", full_name: "", password: "" });

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, avatar_url, created_at');
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const usersWithRoles: User[] = profiles?.map(profile => ({
        id: profile.user_id,
        email: profile.email || '',
        full_name: profile.full_name || '',
        avatar_url: profile.avatar_url || '',
        created_at: profile.created_at,
        roles: userRoles?.filter(r => r.user_id === profile.user_id).map(r => r.role as UserRole) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch users" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const invokeAdmin = async (action: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke("admin-user-management", {
      body: { action, payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      toast({ variant: "destructive", title: "Missing fields", description: "Email and password are required." });
      return;
    }
    try {
      setSubmitting(true);
      await invokeAdmin("create", createForm);
      toast({ title: "User created", description: `${createForm.email} has been created.` });
      setCreateOpen(false);
      setCreateForm(emptyForm);
      await fetchUsers();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Create failed", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    try {
      setSubmitting(true);
      await invokeAdmin("update", {
        user_id: editUser.id,
        email: editForm.email !== editUser.email ? editForm.email : undefined,
        full_name: editForm.full_name,
        password: editForm.password || undefined,
      });
      toast({ title: "User updated" });
      setEditUser(null);
      await fetchUsers();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      await invokeAdmin("delete", { user_id: user.id });
      toast({ title: "User deleted", description: `${user.email} removed.` });
      await fetchUsers();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };

  const handleRoleAssign = async (userId: string, role: UserRole) => {
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId, role, created_by: currentUser?.id,
      });
      if (error) throw error;
      await fetchUsers();
      toast({ title: "Role assigned", description: `${role} role assigned.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to assign role" });
    }
  };

  const handleRoleRemove = async (userId: string, role: UserRole) => {
    try {
      const { error } = await supabase.from('user_roles').delete()
        .eq('user_id', userId).eq('role', role);
      if (error) throw error;
      await fetchUsers();
      toast({ title: "Role removed" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove role" });
    }
  };

  if (!currentUserRoles.isAdmin()) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">You need administrator privileges to access user management.</p>
        </CardContent>
      </Card>
    );
  }

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ email: user.email, full_name: user.full_name || "", password: "" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>User Management</span>
            </CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" />Add User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Create a new user account and assign a role.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as UserRole })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser} disabled={submitting}>
                    {submitting ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | "all")}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found.</div>
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-4 flex-wrap gap-2">
                          <div className="font-medium">{user.full_name || user.email}</div>
                          <div className="flex flex-wrap gap-2">
                            {user.roles.length > 0 ? (
                              user.roles.map((role) => <UserRoleBadge key={role} role={role} />)
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">No roles assigned</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Email:</span> {user.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full lg:w-auto">
                        <div className="flex flex-wrap gap-2">
                          {USER_ROLES.map((roleOption) => (
                            user.roles.includes(roleOption.value) ? (
                              <AlertDialog key={roleOption.value}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline" size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={user.id === currentUser?.id && roleOption.value === 'Admin'}
                                  >
                                    Remove {roleOption.value}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove the {roleOption.value} role from {user.full_name || user.email}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRoleRemove(user.id, roleOption.value)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Button key={roleOption.value} variant="outline" size="sm"
                                onClick={() => handleRoleAssign(user.id, roleOption.value)}>
                                Assign {roleOption.value}
                              </Button>
                            )
                          ))}
                          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={user.id === currentUser?.id}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes {user.full_name || user.email} and their auth account. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>New Password (optional)</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
