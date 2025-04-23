import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  // タスクの作成
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const taskData = {
      ...task,
      userId: user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(this.firestore, 'tasks'), taskData);
    return docRef.id;
  }

  // ユーザーのタスク一覧を取得
  async getUserTasks(): Promise<Task[]> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const q = query(
      collection(this.firestore, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
  }

  // プロジェクトのタスク一覧を取得
  async getProjectTasks(projectId: string): Promise<Task[]> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const q = query(
      collection(this.firestore, 'tasks'),
      where('projectId', '==', projectId),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
  }

  // 担当タスク一覧を取得
  async getAssignedTasks(): Promise<Task[]> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const q = query(
      collection(this.firestore, 'tasks'),
      where('assignedTo', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
  }

  // タスクの更新
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    const taskRef = doc(this.firestore, 'tasks', taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  // タスクの削除
  async deleteTask(taskId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが認証されていません。');

    await deleteDoc(doc(this.firestore, 'tasks', taskId));
  }
} 