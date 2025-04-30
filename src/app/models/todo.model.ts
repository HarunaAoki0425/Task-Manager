import { Timestamp } from '@angular/fire/firestore';

export interface Todo {
  id?: string;
  title: string;
  assignee: string;
  dueDate: Timestamp | null;
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 