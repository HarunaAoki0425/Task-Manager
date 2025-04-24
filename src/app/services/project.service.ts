import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Project, Todo, ProjectMember } from '../models/project.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';

export interface ProjectCreate {
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  dueDate: Date;
  members: string[];
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = `${environment.apiUrl}/projects`;
  private projects: Project[] = [];

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private http: HttpClient,
    private userService: UserService
  ) {}

  // プロジェクトの作成
  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const projectData = {
      ...project,
      userId: user.uid,
      members: [user.uid],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(this.firestore, 'projects'), projectData);
    return docRef.id;
  }

  // プロジェクト一覧の取得
  async getProjects(): Promise<Project[]> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    try {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(
        projectsRef,
        where('members', 'array-contains', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const projects = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // issuesコレクションからプロジェクトに関連する課題を取得
        const issuesRef = collection(this.firestore, `projects/${doc.id}/issues`);
        const issuesSnapshot = await getDocs(issuesRef);
        const issues = issuesSnapshot.docs.map(issueDoc => {
          const issueData = issueDoc.data();
          return {
            id: issueDoc.id,
            title: issueData['title'] || '',
            description: issueData['description'] || '',
            status: issueData['status'] || 'not_started',
            priority: issueData['priority'] || 'medium',
            assignedTo: issueData['assignedTo'] || '',
            dueDate: issueData['dueDate']?.toDate() || null,
            todos: (issueData['todos'] || []).map((todo: any) => ({
              id: todo.id || crypto.randomUUID(),
              title: todo.title || '',
              completed: todo.completed || false,
              assignedTo: todo.assignedTo || '',
              dueDate: todo.dueDate ? (todo.dueDate.toDate ? todo.dueDate.toDate() : new Date(todo.dueDate.seconds * 1000)) : null
            })),
            createdBy: issueData['createdBy'] || '',
            createdAt: issueData['createdAt']?.toDate() || new Date(),
            solution: issueData['solution'] || '',
            tags: issueData['tags'] || []
          };
        });

        return {
          id: doc.id,
          title: data['title'] || '',
          description: data['description'] || '',
          status: data['status'] || 'not_started',
          userId: data['userId'] || '',
          members: data['members'] || [],
          issues: issues,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date(),
          dueDate: data['dueDate']?.toDate() || new Date()
        } as Project;
      }));

      return projects;
    } catch (error) {
      console.error('プロジェクトの取得に失敗しました:', error);
      throw new Error('プロジェクトの取得に失敗しました。');
    }
  }

  // プロジェクトの更新
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const projectRef = doc(this.firestore, 'projects', projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  // プロジェクトの削除
  async deleteProject(projectId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    await deleteDoc(doc(this.firestore, 'projects', projectId));
  }

  // メンバーとして参加しているプロジェクトを取得
  async getMemberProjects(): Promise<Project[]> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const q = query(
      collection(this.firestore, 'projects'),
      where('members', 'array-contains', user.uid)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        members: data['members'] || [data['userId']],
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date()
      } as Project;
    });
  }

  // 個別のプロジェクトを取得
  async getProject(projectId: string): Promise<Project | null> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    try {
      const projectRef = doc(this.firestore, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        return null;
      }

      const data = projectSnap.data();
      if (data['userId'] !== user.uid && !data['members']?.includes(user.uid)) {
        throw new Error('このプロジェクトにアクセスする権限がありません。');
      }

      // issuesサブコレクションを取得
      const issuesRef = collection(this.firestore, `projects/${projectId}/issues`);
      const issuesSnapshot = await getDocs(issuesRef);
      const issues = issuesSnapshot.docs.map(issueDoc => {
        const issueData = issueDoc.data();
        return {
          id: issueDoc.id,
          title: issueData['title'] || '',
          description: issueData['description'] || '',
          status: issueData['status'] || 'not_started',
          priority: issueData['priority'] || 'medium',
          assignedTo: issueData['assignedTo'] || '',
          dueDate: issueData['dueDate']?.toDate() || null,
          todos: (issueData['todos'] || []).map((todo: any) => ({
            id: todo.id || crypto.randomUUID(),
            title: todo.title || '',
            completed: todo.completed || false,
            assignedTo: todo.assignedTo || '',
            dueDate: todo.dueDate ? (todo.dueDate.toDate ? todo.dueDate.toDate() : new Date(todo.dueDate.seconds * 1000)) : null
          })),
          createdBy: issueData['createdBy'] || '',
          createdAt: issueData['createdAt']?.toDate() || new Date(),
          solution: issueData['solution'] || '',
          tags: issueData['tags'] || []
        };
      });

      return {
        id: projectSnap.id,
        title: data['title'] || '',
        description: data['description'] || '',
        status: data['status'] || 'not_started',
        userId: data['userId'],
        members: data['members'] || [data['userId']],
        issues: issues,
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date(),
        dueDate: data['dueDate']?.toDate() || new Date()
      } as Project;
    } catch (error) {
      console.error('プロジェクトの取得に失敗しました:', error);
      throw new Error('プロジェクトの取得に失敗しました。');
    }
  }

  // プロジェクトのステータスを更新
  async updateProjectStatus(projectId: string, status: 'not_started' | 'in_progress' | 'completed'): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const projectRef = doc(this.firestore, 'projects', projectId);
    await updateDoc(projectRef, {
      status,
      updatedAt: new Date()
    });
  }

  // Todoのステータス更新
  async updateTodoStatus(projectId: string, issueId: string, todoId: string, completed: boolean): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    try {
      const issueRef = doc(this.firestore, `projects/${projectId}/issues/${issueId}`);
      const issueSnap = await getDoc(issueRef);

      if (!issueSnap.exists()) {
        throw new Error('課題が見つかりません。');
      }

      const issueData = issueSnap.data();
      const todos = issueData['todos'] || [];
      const todoIndex = todos.findIndex((todo: any) => todo.id === todoId);

      if (todoIndex === -1) {
        throw new Error('Todoが見つかりません。');
      }

      // Todoのステータスを更新
      todos[todoIndex].completed = completed;

      await updateDoc(issueRef, {
        todos: todos,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Todoの更新に失敗しました:', error);
      throw new Error('Todoの更新に失敗しました。');
    }
  }

  // Todoの作成
  async createTodo(projectId: string, issueId: string, todo: Omit<Todo, 'id'>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    try {
      const issueRef = doc(this.firestore, `projects/${projectId}/issues/${issueId}`);
      const issueSnap = await getDoc(issueRef);

      if (!issueSnap.exists()) {
        throw new Error('課題が見つかりません。');
      }

      const issueData = issueSnap.data();
      const todos = issueData['todos'] || [];

      // 新しいTodoを作成
      const newTodo = {
        ...todo,
        id: crypto.randomUUID(),
        completed: false
      };

      // Todoリストに追加
      todos.push(newTodo);

      // 課題を更新
      await updateDoc(issueRef, {
        todos: todos,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Todoの作成に失敗しました:', error);
      throw new Error('Todoの作成に失敗しました。');
    }
  }

  // Todoの削除
  async deleteTodo(projectId: string, issueId: string, todoId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    try {
      const issueRef = doc(this.firestore, `projects/${projectId}/issues/${issueId}`);
      const issueSnap = await getDoc(issueRef);

      if (!issueSnap.exists()) {
        throw new Error('課題が見つかりません。');
      }

      const issueData = issueSnap.data();
      const todos = issueData['todos'] || [];

      // Todoを削除
      const updatedTodos = todos.filter((todo: Todo) => todo.id !== todoId);

      // 課題を更新
      await updateDoc(issueRef, {
        todos: updatedTodos,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Todoの削除に失敗しました:', error);
      throw new Error('Todoの削除に失敗しました。');
    }
  }

  // プロジェクトメンバーの情報を取得
  async getProjectMember(uid: string): Promise<ProjectMember | null> {
    try {
      const userDoc = await this.userService.getUser(uid);
      if (userDoc) {
        return {
          uid: uid,
          displayName: userDoc.displayName || 'Unknown User',
          email: userDoc.email || '',
          photoURL: userDoc.photoURL || null
        };
      }
      return null;
    } catch (error) {
      console.error('メンバー情報の取得に失敗しました:', error);
      return null;
    }
  }
} 