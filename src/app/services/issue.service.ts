import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Issue, Todo, ProjectMember } from '../models/project.model';
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

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw new Error('プロジェクトが見つかりません。');
    }

    const memberPromises = project.members.map(async (member) => {
      if (typeof member === 'string') {
        const user = await this.userService.getUser(member);
        return {
          uid: member,
          displayName: user?.displayName || '未設定'
        };
      }
      return member;
    });

    return Promise.all(memberPromises);
  }

  async getIssuesByProject(projectId: string): Promise<Issue[]> {
    try {
      const issuesRef = collection(this.firestore, `projects/${projectId}/issues`);
      const querySnapshot = await getDocs(issuesRef);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: projectId,
          title: data['title'] || '',
          description: data['description'] || '',
          solution: data['solution'] || '',
          status: data['status'] || 'not_started',
          priority: data['priority'] || 'medium',
          assignedTo: data['assignedTo'] || '',
          dueDate: data['dueDate']?.toDate() || new Date(),
          tags: data['tags'] || [],
          todos: data['todos'] || [],
          createdBy: data['createdBy'] || '',
          createdAt: data['createdAt']?.toDate() || new Date(),
          comment: data['comment'] || ''
        };
      });
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      throw error;
    }
  }

  async createIssue(projectId: string, issueData: Partial<Issue>): Promise<void> {
    try {
      const issuesRef = collection(this.firestore, `projects/${projectId}/issues`);
      const newIssue = {
        ...issueData,
        projectId,
        status: issueData.status || 'not_started',
        priority: issueData.priority || 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        todos: issueData.todos || [],
        tags: issueData.tags || [],
        solution: issueData.solution || '',
        comment: issueData.comment || ''
      };

      if (!newIssue.createdBy) {
        const currentUser = await this.userService.getCurrentUser();
        if (currentUser) {
          newIssue.createdBy = currentUser.uid;
        }
      }

      await addDoc(issuesRef, newIssue);
    } catch (error) {
      console.error('Failed to create issue:', error);
      throw new Error('課題の作成に失敗しました。');
    }
  }

  async updateIssue(issueId: string, updates: Partial<Issue>): Promise<void> {
    try {
      // まずアーカイブされた課題かどうかを確認
      const archivedIssueRef = doc(this.firestore, 'archived_issues', issueId);
      const archivedIssueSnap = await getDoc(archivedIssueRef);

      if (archivedIssueSnap.exists()) {
        // アーカイブされた課題の場合
        await updateDoc(archivedIssueRef, {
          ...updates,
          updatedAt: new Date()
        });
        return;
      }

      // 通常の課題の場合、プロジェクト内から検索
      const projectsRef = collection(this.firestore, 'projects');
      const projectsSnap = await getDocs(projectsRef);
      
      for (const projectDoc of projectsSnap.docs) {
        const issueRef = doc(this.firestore, `projects/${projectDoc.id}/issues`, issueId);
        const issueSnap = await getDoc(issueRef);
        
        if (issueSnap.exists()) {
          await updateDoc(issueRef, {
            ...updates,
            updatedAt: new Date()
          });
          return;
        }
      }

      throw new Error('課題が見つかりません。');
    } catch (error) {
      console.error('課題の更新に失敗しました:', error);
      throw new Error('課題の更新に失敗しました。');
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

  async getIssue(issueId: string): Promise<Issue | null> {
    try {
      // まず通常の課題コレクションから検索
      const projectsRef = collection(this.firestore, 'projects');
      const projectsSnap = await getDocs(projectsRef);
      
      for (const projectDoc of projectsSnap.docs) {
        const issueRef = doc(this.firestore, `projects/${projectDoc.id}/issues`, issueId);
        const issueSnap = await getDoc(issueRef);
        
        if (issueSnap.exists()) {
          const data = issueSnap.data();
          return this.mapIssueData(issueSnap.id, data);
        }
      }

      // 通常の課題が見つからない場合、アーカイブから検索
      const archivedIssueRef = doc(this.firestore, 'archived_issues', issueId);
      const archivedIssueSnap = await getDoc(archivedIssueRef);

      if (!archivedIssueSnap.exists()) {
        return null;
      }

      const data = archivedIssueSnap.data();
      return this.mapIssueData(archivedIssueSnap.id, data);
    } catch (error) {
      console.error('課題の読み込みに失敗しました:', error);
      throw new Error('課題の読み込みに失敗しました。');
    }
  }

  private mapIssueData(id: string, data: any): Issue {
    return {
      id,
      projectId: data['projectId'] || '',
      title: data['title'] || '',
      description: data['description'] || '',
      solution: data['solution'] || '',
      status: data['status'] || 'not_started',
      priority: data['priority'] || 'medium',
      assignedTo: data['assignedTo'] || '',
      dueDate: data['dueDate']?.toDate() || new Date(),
      tags: data['tags'] || [],
      todos: data['todos'] || [],
      createdBy: data['createdBy'] || '',
      createdAt: data['createdAt']?.toDate() || new Date(),
      comment: data['comment']
    };
  }

  async archiveIssue(projectId: string, issueId: string): Promise<void> {
    try {
      // 課題を取得
      const issueRef = doc(this.firestore, `projects/${projectId}/issues`, issueId);
      const issueSnap = await getDoc(issueRef);

      if (!issueSnap.exists()) {
        throw new Error('課題が見つかりません。');
      }

      const issueData = issueSnap.data();

      // アーカイブコレクションに課題を追加
      const archiveRef = collection(this.firestore, 'archived_issues');
      await addDoc(archiveRef, {
        ...issueData,
        projectId,
        originalIssueId: issueId,
        archivedAt: new Date()
      });

      // 元の課題を削除
      await deleteDoc(issueRef);
    } catch (error) {
      console.error('Failed to archive issue:', error);
      throw new Error('課題のアーカイブに失敗しました。');
    }
  }

  async getArchivedIssues(): Promise<Issue[]> {
    try {
      const archiveRef = collection(this.firestore, 'archived_issues');
      const querySnapshot = await getDocs(archiveRef);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data['projectId'] || '',
          title: data['title'] || '',
          description: data['description'] || '',
          solution: data['solution'] || '',
          status: data['status'] || 'not_started',
          priority: data['priority'] || 'medium',
          assignedTo: data['assignedTo'] || '',
          dueDate: data['dueDate']?.toDate() || new Date(),
          tags: data['tags'] || [],
          todos: data['todos'] || [],
          createdBy: data['createdBy'] || '',
          createdAt: data['createdAt']?.toDate() || new Date(),
          comment: data['comment'] || '',
          archivedAt: data['archivedAt']?.toDate() || new Date()
        };
      });
    } catch (error) {
      console.error('Failed to fetch archived issues:', error);
      throw error;
    }
  }
} 