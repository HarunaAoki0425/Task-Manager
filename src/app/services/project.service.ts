import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, Timestamp, doc, getDoc, query, where, updateDoc, deleteDoc, setDoc, writeBatch } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Project } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  async getUserProjects(): Promise<Project[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const projectsRef = collection(this.firestore, 'projects');
    const q = query(
      projectsRef,
      where('members', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data()['title'] || doc.data()['name'] || '',
      description: doc.data()['description'] || '',
      members: doc.data()['members'] || [],
      createdBy: doc.data()['createdBy'] || '',
      dueDate: doc.data()['dueDate'],
      createdAt: doc.data()['createdAt'] || Timestamp.now(),
      updatedAt: doc.data()['updatedAt'] || Timestamp.now()
    } as Project));
  }

  async getProject(projectId: string): Promise<Project | null> {
    let projectDoc = doc(this.firestore, 'projects', projectId);
    let projectSnap = await getDoc(projectDoc);
    
    if (!projectSnap.exists()) {
      projectDoc = doc(this.firestore, 'archives', projectId);
      projectSnap = await getDoc(projectDoc);
    }
    
    if (projectSnap.exists()) {
      const data = projectSnap.data();
      return {
        id: projectId,
        title: data['title'] || data['name'] || '',
        description: data['description'] || '',
        members: data['members'] || [],
        createdBy: data['createdBy'] || '',
        dueDate: data['dueDate'],
        createdAt: data['createdAt'] || Timestamp.now(),
        updatedAt: data['updatedAt'] || Timestamp.now()
      } as Project;
    }
    
    return null;
  }

  async getProjectMembers(projectId: string): Promise<{ uid: string; displayName: string; email: string }[]> {
    const project = await this.getProject(projectId);
    if (!project || !Array.isArray(project.members)) {
      return [];
    }

    const members = await Promise.all(project.members.map(async (uid: string) => {
      const userDoc = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userDoc);
      const result = {
        uid,
        displayName: userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name',
        email: userSnap.exists() ? userSnap.data()['email'] || '' : ''
      };
      return result;
    }));

    return members;
  }

  async addProjectMember(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data();
    const members = Array.isArray(project['members']) ? project['members'] : [];
    let notificationNeeded = false;
    if (!members.includes(userId)) {
      members.push(userId);
      await updateDoc(projectRef, { members });
      notificationNeeded = true;
      // 新メンバーを既存課題のmembersに追加
      await this.addMemberToAllIssues(projectId, userId);
    }

    // 通知作成
    if (notificationNeeded) {
      const notificationsRef = collection(this.firestore, 'notifications');
      const existingMembers = members.filter((uid: string) => uid !== userId);
      const addedMembers = [userId];
      const membersField = [
        ...existingMembers.map((uid: string) => ({ uid, type: 'existing' })),
        ...addedMembers.map((uid: string) => ({ uid, type: 'added' }))
      ];
      // recipients: 作成者以外のメンバー
      const recipients = existingMembers;
      if (recipients.length > 0) {
        await addDoc(notificationsRef, {
          createdAt: Timestamp.now(),
          createdBy: this.auth.currentUser?.uid ?? '',
          members: membersField,
          message: 'プロジェクトメンバーに追加されました。',
          projectId: projectId,
          read: false,
          title: project['title'] || '',
          recipients: recipients
        });
      }
    }
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data();
    const members = Array.isArray(project['members']) ? project['members'] : [];
    const updatedMembers = members.filter((id: string) => id !== userId);
    
    await updateDoc(projectRef, { members: updatedMembers });
  }

  async archiveProject(projectId: string): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);
      
      // プロジェクトデータを取得
      const projectRef = doc(this.firestore, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (!projectSnap.exists()) {
        throw new Error('プロジェクトが見つかりません');
      }

      const projectData = projectSnap.data();

      // アーカイブにプロジェクトデータを保存
      const archiveRef = doc(this.firestore, 'archives', projectId);
      await setDoc(archiveRef, {
        ...projectData,
        archivedAt: Timestamp.now(),
        isArchived: true
      });

      // 課題とTodoを取得
      const issuesRef = collection(this.firestore, 'projects', projectId, 'issues');
      const issuesSnap = await getDocs(issuesRef);

      // 各課題とそのTodoをアーカイブに移動
      for (const issueDoc of issuesSnap.docs) {
        const issueData = issueDoc.data();
        const todosRef = collection(this.firestore, 'projects', projectId, 'issues', issueDoc.id, 'todos');
        const todosSnap = await getDocs(todosRef);

        // アーカイブ内の課題を保存
        const archivedIssueRef = doc(collection(this.firestore, 'archives', projectId, 'issues'), issueDoc.id);
        await setDoc(archivedIssueRef, {
          ...issueData,
          archivedAt: Timestamp.now(),
          isArchived: true
        });

        // 各Todoをアーカイブに移動
        for (const todoDoc of todosSnap.docs) {
          const todoData = todoDoc.data();
          const archivedTodoRef = doc(
            collection(this.firestore, 'archives', projectId, 'issues', issueDoc.id, 'todos'),
            todoDoc.id
          );
          await setDoc(archivedTodoRef, {
            ...todoData,
            archivedAt: Timestamp.now(),
            isArchived: true
          });

          // 元のTodoを削除
          const todoRef = doc(this.firestore, 'projects', projectId, 'issues', issueDoc.id, 'todos', todoDoc.id);
          await deleteDoc(todoRef);
        }

        // 元の課題を削除
        const issueRef = doc(this.firestore, 'projects', projectId, 'issues', issueDoc.id);
        await deleteDoc(issueRef);
      }

      // コメントを取得
      const commentsRef = collection(this.firestore, 'projects', projectId, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      for (const commentDoc of commentsSnap.docs) {
        const commentData = commentDoc.data();
        const archivedCommentRef = doc(collection(this.firestore, 'archives', projectId, 'comments'), commentDoc.id);
        await setDoc(archivedCommentRef, {
          ...commentData,
          archivedAt: Timestamp.now(),
          isArchived: true
        });
        // 元のコメントを削除
        const commentRef = doc(this.firestore, 'projects', projectId, 'comments', commentDoc.id);
        await deleteDoc(commentRef);
      }

      // 元のプロジェクトを削除
      await deleteDoc(projectRef);

    } catch (error) {
      console.error('Error archiving project:', error);
      throw new Error('プロジェクトのアーカイブに失敗しました');
    }
  }

  async getArchivedProject(projectId: string): Promise<Project> {
    const projectDoc = await getDoc(doc(this.firestore, 'archives', projectId));
    if (!projectDoc.exists()) {
      throw new Error('アーカイブされたプロジェクトが見つかりません。');
    }
    return { id: projectDoc.id, ...projectDoc.data() } as Project;
  }

  async restoreProject(projectId: string): Promise<void> {
    try {
      // アーカイブからプロジェクトデータを取得
      const archiveRef = doc(this.firestore, 'archives', projectId);
      const archiveSnap = await getDoc(archiveRef);
      
      if (!archiveSnap.exists()) {
        throw new Error('アーカイブされたプロジェクトが見つかりません');
      }

      const projectData = archiveSnap.data();

      // プロジェクトを復元
      const projectRef = doc(this.firestore, 'projects', projectId);
      await setDoc(projectRef, {
        ...projectData,
        updatedAt: Timestamp.now(),
        isArchived: false
      });

      // アーカイブされた課題を取得
      const archivedIssuesRef = collection(this.firestore, 'archives', projectId, 'issues');
      const archivedIssuesSnap = await getDocs(archivedIssuesRef);

      // 各課題とそのTodoを復元
      for (const issueDoc of archivedIssuesSnap.docs) {
        const issueId = issueDoc.id;
        const issueData = issueDoc.data();

        // アーカイブされたTodoを取得
        const archivedTodosRef = collection(this.firestore, 'archives', projectId, 'issues', issueId, 'todos');
        const archivedTodosSnap = await getDocs(archivedTodosRef);

        // 課題を復元
        const restoredIssueRef = doc(collection(this.firestore, 'projects', projectId, 'issues'), issueId);
        await setDoc(restoredIssueRef, {
          ...issueData,
          updatedAt: Timestamp.now(),
          isArchived: false
        });

        // 各Todoを復元
        for (const todoDoc of archivedTodosSnap.docs) {
          const todoId = todoDoc.id;
          const todoData = todoDoc.data();

          const restoredTodoRef = doc(
            collection(this.firestore, 'projects', projectId, 'issues', issueId, 'todos'),
            todoId
          );

          await setDoc(restoredTodoRef, {
            ...todoData,
            updatedAt: Timestamp.now(),
            isArchived: false
          });

          // アーカイブからTodoを削除
          const archivedTodoRef = doc(this.firestore, 'archives', projectId, 'issues', issueId, 'todos', todoId);
          await deleteDoc(archivedTodoRef);
        }

        // アーカイブから課題を削除
        const archivedIssueRef = doc(this.firestore, 'archives', projectId, 'issues', issueId);
        await deleteDoc(archivedIssueRef);
      }

      // アーカイブからプロジェクトを削除
      await deleteDoc(archiveRef);

    } catch (error) {
      console.error('Error restoring project:', error);
      throw new Error('プロジェクトの復元に失敗しました: ' + 
        (error instanceof Error ? error.message : '不明なエラーが発生しました'));
    }
  }

  async deleteArchivedProjectWithSubcollections(projectId: string): Promise<void> {
    // アーカイブプロジェクトのissuesとtodosをすべて削除
    const issuesRef = collection(this.firestore, 'archives', projectId, 'issues');
    const issuesSnap = await getDocs(issuesRef);
    for (const issueDoc of issuesSnap.docs) {
      const issueId = issueDoc.id;
      // todos削除
      const todosRef = collection(this.firestore, 'archives', projectId, 'issues', issueId, 'todos');
      const todosSnap = await getDocs(todosRef);
      for (const todoDoc of todosSnap.docs) {
        await deleteDoc(doc(this.firestore, 'archives', projectId, 'issues', issueId, 'todos', todoDoc.id));
      }
      // issue削除
      await deleteDoc(doc(this.firestore, 'archives', projectId, 'issues', issueId));
    }
    // アーカイブプロジェクトのcommentsをすべて削除
    const commentsRef = collection(this.firestore, 'archives', projectId, 'comments');
    const commentsSnap = await getDocs(commentsRef);
    for (const commentDoc of commentsSnap.docs) {
      await deleteDoc(doc(this.firestore, 'archives', projectId, 'comments', commentDoc.id));
    }
    // プロジェクト本体削除
    await deleteDoc(doc(this.firestore, 'archives', projectId));
  }

  async deleteProjectWithSubcollections(projectId: string): Promise<void> {
    // プロジェクトのissuesとtodosをすべて削除
    const issuesRef = collection(this.firestore, 'projects', projectId, 'issues');
    const issuesSnap = await getDocs(issuesRef);
    for (const issueDoc of issuesSnap.docs) {
      const issueId = issueDoc.id;
      // todos削除
      const todosRef = collection(this.firestore, 'projects', projectId, 'issues', issueId, 'todos');
      const todosSnap = await getDocs(todosRef);
      for (const todoDoc of todosSnap.docs) {
        await deleteDoc(doc(this.firestore, 'projects', projectId, 'issues', issueId, 'todos', todoDoc.id));
      }
      // issue削除
      await deleteDoc(doc(this.firestore, 'projects', projectId, 'issues', issueId));
    }
    // プロジェクト本体削除
    await deleteDoc(doc(this.firestore, 'projects', projectId));
  }

  /**
   * 指定ユーザーがメンバーの全プロジェクトから、開始日が今日の課題を取得
   */
  async getTodayIssuesForUser(): Promise<any[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const projects = await this.getUserProjects();
    const allIssues: any[] = [];
    const notificationsRef = collection(this.firestore, 'notifications');
    for (const project of projects) {
      const issuesRef = collection(this.firestore, 'projects', project.id!, 'issues');
      // 開始日が今日の課題
      const qStart = query(
        issuesRef,
        where('startDate', '>=', Timestamp.fromDate(today)),
        where('startDate', '<', Timestamp.fromDate(tomorrow)),
        where('status', '==', '未着手')
      );
      const snapshotStart = await getDocs(qStart);
      for (const docSnap of snapshotStart.docs) {
        const issue = { id: docSnap.id, ...(docSnap.data() as any), projectId: project.id };
        allIssues.push(issue);
        // 通知作成処理
        // 課題のメンバー全員分通知を作成
        const members: string[] = Array.isArray(issue.members) ? issue.members : [];
        if (members.includes(userId)) {
          const notifQStart = query(
            notificationsRef,
            where('issueId', '==', issue.id),
            where('userId', '==', userId),
            where('type', '==', 'start')
          );
          const notifSnapStart = await getDocs(notifQStart);
          if (notifSnapStart.empty) {
            await addDoc(notificationsRef, {
              message: '今日が開始日の課題があります。',
              issueTitle: issue.issueTitle || '',
              issueId: issue.id,
              projectId: project.id,
              userId: userId,
              recipients: [userId],
              createdAt: Timestamp.now(),
              read: false,
              hidden: false,
              type: 'start'
            });
          }
        }
      }
      // 期限日が今日の課題
      const qDue = query(
        issuesRef,
        where('dueDate', '>=', Timestamp.fromDate(today)),
        where('dueDate', '<', Timestamp.fromDate(tomorrow)),
        where('status', 'in', ['未着手', '進行中', '保留'])
      );
      const snapshotDue = await getDocs(qDue);
      for (const docSnap of snapshotDue.docs) {
        const issue = { id: docSnap.id, ...(docSnap.data() as any), projectId: project.id };
        allIssues.push(issue);
        // 課題のメンバー全員分通知を作成
        const members: string[] = Array.isArray(issue.members) ? issue.members : [];
        if (members.includes(userId)) {
          const notifQDue = query(
            notificationsRef,
            where('issueId', '==', issue.id),
            where('userId', '==', userId),
            where('type', '==', 'due')
          );
          const notifSnapDue = await getDocs(notifQDue);
          if (notifSnapDue.empty) {
            await addDoc(notificationsRef, {
              message: '今日が期限日の課題があります。',
              issueTitle: issue.issueTitle || '',
              issueId: issue.id,
              projectId: project.id,
              userId: userId,
              recipients: [userId],
              createdAt: Timestamp.now(),
              read: false,
              hidden: false,
              type: 'due'
            });
          }
        }
      }
    }
    return allIssues;
  }

  // 新メンバーを既存課題のmembersに追加するバッチ処理
  async addMemberToAllIssues(projectId: string, newMemberUid: string): Promise<void> {
    const issuesRef = collection(this.firestore, 'projects', projectId, 'issues');
    const issuesSnap = await getDocs(issuesRef);
    for (const issueDoc of issuesSnap.docs) {
      const issueData = issueDoc.data();
      const members: string[] = Array.isArray(issueData['members']) ? issueData['members'] : [];
      if (!members.includes(newMemberUid)) {
        const issueRef = doc(this.firestore, 'projects', projectId, 'issues', issueDoc.id);
        await updateDoc(issueRef, { members: [...members, newMemberUid] });
      }
    }
  }
} 