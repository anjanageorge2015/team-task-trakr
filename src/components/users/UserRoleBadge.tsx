import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/types/user";

interface UserRoleBadgeProps {
  role: UserRole;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'Admin':
        return "bg-destructive/10 text-destructive border-destructive/20";
      case 'Engineer':
        return "bg-primary/10 text-primary border-primary/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Badge variant="outline" className={getRoleColor(role)}>
      {role}
    </Badge>
  );
}