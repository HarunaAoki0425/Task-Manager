import { Timestamp } from '@angular/fire/firestore';

export interface Todo {
  id?: string;
  todoTitle: string;
  description?: string;
  completed: boolean;
  assignee: string;
  todoDueDate: Timestamp | null;
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