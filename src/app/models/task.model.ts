export interface Task {
  id?: string;
  userId: string;
  projectId?: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string; // ユーザーID
} 