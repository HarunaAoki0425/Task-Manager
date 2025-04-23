export interface Project {
  id?: string;
  userId: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  members: string[]; // ユーザーIDの配列
}

export interface Issue {
  id: string;
  projectId: string;
  title: string;
  solution: string; // 解決方法
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignedTo: string;
  dueDate: Date;
  tags: string[];
  todos: Todo[]; // ToDoリスト
  createdBy: string;
  createdAt: Date;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
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