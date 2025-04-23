import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Project } from '../models/project.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

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

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private http: HttpClient
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

    const projectsRef = collection(this.firestore, 'projects');
    const q = query(
      projectsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        members: data['members'] || [data['userId']],
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date(),
        dueDate: data['dueDate']?.toDate() || new Date()
      } as Project;
    });
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

    const projectRef = doc(this.firestore, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return null;
    }

    const data = projectSnap.data();
    if (data['userId'] !== user.uid && !data['members']?.includes(user.uid)) {
      throw new Error('このプロジェクトにアクセスする権限がありません。');
    }

    return {
      id: projectSnap.id,
      ...data,
      members: data['members'] || [data['userId']],
      createdAt: data['createdAt']?.toDate() || new Date(),
      updatedAt: data['updatedAt']?.toDate() || new Date(),
      dueDate: data['dueDate']?.toDate() || new Date()
    } as Project;
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
} 