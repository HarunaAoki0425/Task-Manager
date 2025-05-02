import { Timestamp } from '@angular/fire/firestore';

export interface Todo {
  id?: string;
  title: string;
  description?: string;
  completed: boolean;
  assignee: string;
  dueDate: Timestamp | null;
  projectId: string;
  projectTitle: string;
  issueId: string;
  issueTitle: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
  isArchived?: boolean;
  color?: string;
} 