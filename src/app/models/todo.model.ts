import { Timestamp } from '@angular/fire/firestore';

export interface Todo {
  id?: string;
  title: string;
  assignee: string;
  dueDate: Timestamp | null;
  completed: boolean;
  projectId: string;
  projectTitle: string;
  issueId: string;
  issueTitle: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 