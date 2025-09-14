import { Badge } from "@/components/ui/badge";
import { TaskStatus } from "@/types/task";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

const statusConfig = {
  unassigned: { label: "Unassigned", variant: "secondary" as const },
  assigned: { label: "Assigned", variant: "default" as const },
  on_hold: { label: "On Hold", variant: "outline" as const },
  closed: { label: "Closed", variant: "secondary" as const },
  settled: { label: "Settled", variant: "default" as const },
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant={config.variant}
      className={`
        ${status === 'unassigned' && 'bg-status-unassigned/20 text-status-unassigned border-status-unassigned/50'}
        ${status === 'assigned' && 'bg-status-assigned/20 text-status-assigned border-status-assigned/50'}
        ${status === 'on_hold' && 'bg-status-on-hold/20 text-status-on-hold border-status-on-hold/50'}
        ${status === 'closed' && 'bg-status-closed/20 text-status-closed border-status-closed/50'}
        ${status === 'settled' && 'bg-status-settled/20 text-status-settled border-status-settled/50'}
      `}
    >
      {config.label}
    </Badge>
  );
}