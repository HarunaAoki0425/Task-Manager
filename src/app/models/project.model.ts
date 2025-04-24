export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  userId: string;
  members: string[];
  issues: Issue[];
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  solution: string;
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignedTo: string;
  dueDate: Date;
  tags: string[];
  todos: Todo[];
  createdBy: string;
  createdAt: Date;
  comment?: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: Date;
}

export interface Task {
  id: string;
  issueId: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  assignedTo: string;
  dueDate: Date;
  createdBy: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'deadline' | 'status_change' | 'member_added';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedId?: string; // プロジェクト、課題、またはタスクのID
}

export interface ProjectMember {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string | null;
} 