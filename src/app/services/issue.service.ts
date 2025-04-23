import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Issue, Todo } from '../models/project.model';
import { ProjectService } from './project.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class IssueService {
  constructor(
    private firestore: Firestore,
    private projectService: ProjectService,
    private userService: UserService
  ) {}

  async getProjectMembers(projectId: string): Promise<{ uid: string; displayName: string; }[]> {
    try {
      const project = await this.projectService.getProject(projectId);
      if (!project) {
        throw new Error('プロジェクトが見つかりません。');
      }

      const memberPromises = project.members.map(async (uid) => {
        const user = await this.userService.getUser(uid);
        return {
          uid,
          displayName: user?.displayName || 'Unknown User'
        };
      });

      return await Promise.all(memberPromises);
    } catch (error) {
      console.error('Failed to load project members:', error);
      throw new Error('プロジェクトメンバーの読み込みに失敗しました。');
    }
  }

  async getIssuesByProject(projectId: string): Promise<Issue[]> {
    try {
      const issuesRef = collection(this.firestore, 'issues');
      const q = query(issuesRef, where('projectId', '==', projectId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Issue));
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      throw error;
    }
  }

  async createIssue(projectId: string, issueData: Partial<Issue>): Promise<void> {
    try {
      const issuesRef = collection(this.firestore, 'issues');
      await addDoc(issuesRef, {
        ...issueData,
        projectId,
        status: issueData.status || 'not_started',
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to create issue:', error);
      throw error;
    }
  }

  async updateIssue(issueId: string, updates: Partial<Issue>): Promise<void> {
    try {
      const issueRef = doc(this.firestore, 'issues', issueId);
      await updateDoc(issueRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to update issue:', error);
      throw error;
    }
  }

  async deleteIssue(issueId: string): Promise<void> {
    try {
      const issueRef = doc(this.firestore, 'issues', issueId);
      await deleteDoc(issueRef);
    } catch (error) {
      console.error('Failed to delete issue:', error);
      throw error;
    }
  }

  async getIssue(issueId: string): Promise<Issue> {
    try {
      const docRef = doc(this.firestore, 'issues', issueId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Issue not found');
      }

      const data = docSnap.data();
      
      // 日付フィールドを適切に変換
      const createdAt = data['createdAt']?.toDate() || new Date();
      const updatedAt = data['updatedAt']?.toDate() || new Date();
      const dueDate = data['dueDate']?.toDate() || new Date();

      // TODOリストの日付も変換
      const todos = data['todos']?.map((todo: any) => ({
        ...todo,
        createdAt: todo.createdAt?.toDate() || new Date()
      })) || [];

      return {
        id: docSnap.id,
        title: data['title'] || '',
        solution: data['solution'] || '',
        status: data['status'] || 'not_started',
        priority: data['priority'] || 'medium',
        assignedTo: data['assignedTo'] || '',
        projectId: data['projectId'] || '',
        createdBy: data['createdBy'] || '',
        tags: data['tags'] || [],
        todos: todos,
        createdAt: createdAt,
        updatedAt: updatedAt,
        dueDate: dueDate
      } as Issue;
    } catch (error) {
      console.error('Error getting issue:', error);
      throw error;
    }
  }
} 