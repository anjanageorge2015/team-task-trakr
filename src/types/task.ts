export type TaskStatus = 'unassigned' | 'assigned' | 'on_hold' | 'closed' | 'settled' | 'repeat';

export interface Task {
  id: string;
  scsId: string;
  vendorCallId: string;
  vendor: string;
  callDescription: string;
  callDate: string;
  customerName: string;
  customerAddress: string;
  remarks: string;
  scsRemarks: string;
  amount: number;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export const VENDORS = [
  'Tech Solutions Inc',
  'ServiceMax Pro',
  'QuickFix Systems',
  'EliteSupport Ltd',
  'TechCare Services',
  'ProActive Solutions',
] as const;

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'unassigned', label: 'Unassigned', color: 'text-status-unassigned' },
  { value: 'assigned', label: 'Assigned', color: 'text-status-assigned' },
  { value: 'on_hold', label: 'On Hold', color: 'text-status-on-hold' },
  { value: 'closed', label: 'Closed', color: 'text-status-closed' },
  { value: 'settled', label: 'Settled', color: 'text-status-settled' },
  { value: 'repeat', label: 'Repeat', color: 'text-status-repeat' },
];