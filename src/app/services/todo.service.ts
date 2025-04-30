import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, getDoc, deleteDoc, collectionGroup, DocumentData } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Todo } from '../models/todo.model';
import { User } from '../models/user.model';

interface ProjectData extends DocumentData {
  id: string;
  name?: string;
  title?: string;
  members: string[];
  isArchived: boolean;
}

interface IssueData {
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class TodoService {
  private memberDetails: { [key: string]: User } = {};

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  private waitForAuth(): Promise<string> {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe(); // 監視を解除
        if (user) {
          resolve(user.uid);
        } else {
          reject(new Error('ログインが必要です'));
        }
      });
    });
  }

  async getCompletedTodos(): Promise<Todo[]> {
    try {
      const uid = await this.waitForAuth();
      const allTodos: Todo[] = [];

      // 1. アクティブなプロジェクトからTodoを取得
      const projectsRef = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsRef, 
        where('members', 'array-contains', uid)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      // 2. アーカイブされたプロジェクトからTodoを取得
      const archivesRef = collection(this.firestore, 'archives');
      const archivesQuery = query(archivesRef,
        where('members', 'array-contains', uid)
      );
      const archivesSnapshot = await getDocs(archivesQuery);

      // プロジェクトとアーカイブの両方から完了済みTodoを取得
      const allProjects: ProjectData[] = [
        ...projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isArchived: false } as ProjectData)),
        ...archivesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isArchived: true } as ProjectData))
      ];

      // 各プロジェクトの完了済みTodoを取得
      for (const project of allProjects) {
        try {
          const issuesRef = collection(this.firestore, 'projects', project.id, 'issues');
          const issuesSnapshot = await getDocs(issuesRef);

          for (const issueDoc of issuesSnapshot.docs) {
            const issueData = issueDoc.data();
            const todosRef = collection(this.firestore, 'projects', project.id, 'issues', issueDoc.id, 'todos');
            const todosQuery = query(todosRef,
              where('completed', '==', true),
              where('assignee', '==', uid)
            );
            const todosSnapshot = await getDocs(todosQuery);

            const todos = todosSnapshot.docs.map(todoDoc => {
              const todoData = { id: todoDoc.id, ...todoDoc.data() } as Todo;
              return {
                ...todoData,
                projectId: project.id,
                issueId: issueDoc.id,
                projectTitle: project['name'] || project['title'] || '',
                issueTitle: issueData['title'] || ''
              };
            });

            allTodos.push(...todos);
          }
        } catch (error) {
          console.error(`Error loading todos for project ${project.id}:`, error);
        }
      }

      return allTodos;
    } catch (error) {
      console.error('Error getting completed todos:', error);
      throw error;
    }
  }

  async deleteTodo(todoId: string): Promise<void> {
    try {
      const uid = await this.waitForAuth();

      // プロジェクトとアーカイブの両方から完了済みTodoを取得して、指定されたtodoIdを持つTodoを探す
      const todos = await this.getCompletedTodos();
      const todo = todos.find(t => t.id === todoId);
      
      if (!todo || !todo.projectId || !todo.issueId) {
        throw new Error('Todoが見つかりません');
      }

      const todoRef = doc(this.firestore, `projects/${todo.projectId}/issues/${todo.issueId}/todos/${todoId}`);
      await deleteDoc(todoRef);
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }
} 