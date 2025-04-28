import { Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, setDoc, deleteDoc, Timestamp, collection, getDocs, updateDoc, query, where } from '@angular/fire/firestore';
import { ProjectService } from '../../../services/project.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css']
})
export class ProjectDetailComponent {
  project: any = null;
  creatorName: string = '';
  isLoading = true;
  isArchiving = false;
  archiveMessage = '';
  isEditing = false;
  editDescription = '';
  editDueDate: string | null = null;
  isSaving = false;
  issuesNotStarted: any[] = [];
  issuesInProgress: any[] = [];
  issuesOnHold: any[] = [];
  issuesDone: any[] = [];
  shouldScrollToIssues = false;
  showInviteInput: boolean = false;
  inviteEmail: string = '';
  inviteErrorMessage: string = '';
  inviteSending: boolean = false;
  inviteSuccessMessage: string = '';
  pendingInvites: any[] = [];
  membersUsernames: { uid: string, displayName: string, isCreator: boolean }[] = [];

  constructor(private route: ActivatedRoute, private firestore: Firestore, private router: Router, private ngZone: NgZone, private projectService: ProjectService) {
    this.loadProject();
  }

  async loadProject() {
    this.isLoading = true;
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    // まずprojectsから取得
    let projectDoc = doc(this.firestore, 'projects', id);
    let projectSnap = await getDoc(projectDoc);
    let isArchive = false;
    if (!projectSnap.exists()) {
      // なければarchivesから取得
      projectDoc = doc(this.firestore, 'archives', id);
      projectSnap = await getDoc(projectDoc);
      isArchive = true;
    }
    if (projectSnap.exists()) {
      this.project = { id, ...projectSnap.data() };
      if (this.project.createdBy) {
        const userDoc = doc(this.firestore, 'users', this.project.createdBy);
        const userSnap = await getDoc(userDoc);
        this.creatorName = userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name';
      } else {
        this.creatorName = 'no name';
      }
      // メンバー名リスト取得
      if (Array.isArray(this.project.members)) {
        this.membersUsernames = await Promise.all(this.project.members.map(async (uid: string) => {
          const userDoc = doc(this.firestore, 'users', uid);
          const userSnap = await getDoc(userDoc);
          return {
            uid,
            displayName: userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name',
            isCreator: uid === this.project.createdBy
          };
        }));
      } else {
        this.membersUsernames = [];
      }
      // 課題一覧取得
      const issuesRef = collection(this.firestore, `projects/${id}/issues`);
      const issuesSnap = await getDocs(issuesRef);
      const issues: any[] = issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.issuesNotStarted = issues.filter(issue => !issue.status || issue.status === '未着手');
      this.issuesInProgress = issues.filter(issue => issue.status === '進行中');
      this.issuesOnHold = issues.filter(issue => issue.status === '保留');
      this.issuesDone = issues.filter(issue => issue.status === '完了');
      // 招待一覧取得
      try {
        this.pendingInvites = (await this.projectService.getProjectInvites(id)).filter(invite => invite.status === 'pending');
      } catch {
        this.pendingInvites = [];
      }
    }
    this.isLoading = false;
    // 課題status変更時のみ中央にスクロール
    if (this.shouldScrollToIssues) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          const section = document.getElementById('issues-section');
          if (section) {
            const rect = section.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const sectionCenter = rect.top + scrollTop + rect.height / 2;
            const windowCenter = window.innerHeight / 2;
            window.scrollTo({ top: sectionCenter - windowCenter, behavior: 'smooth' });
          }
        }, 0);
      });
      this.shouldScrollToIssues = false;
    }
  }

  formatDate(ts: any): string {
    if (!ts) return '';
    let date: Date;
    if (ts.toDate) {
      try {
        date = ts.toDate();
      } catch {
        return String(ts);
      }
    } else if (ts instanceof Date) {
      date = ts;
    } else if (typeof ts === 'number') {
      date = new Date(ts * 1000);
    } else {
      date = new Date(ts);
    }
    // YYYY/MM/DD HH:mm 形式で返す
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }

  async archiveProject() {
    if (!this.project?.id) return;
    if (!confirm('本当にアーカイブしますか？')) return;
    this.isArchiving = true;
    this.archiveMessage = '';
    try {
      // 1. プロジェクトデータ取得
      const projectRef = doc(this.firestore, 'projects', this.project.id);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) throw new Error('プロジェクトが見つかりません');
      // 2. archivesコレクションに保存（削除時間を追加）
      const archiveRef = doc(this.firestore, 'archives', this.project.id);
      const archiveData = { ...projectSnap.data(), deletedAt: Timestamp.now() };
      await setDoc(archiveRef, archiveData);
      // 3. projectsコレクションから削除
      await deleteDoc(projectRef);
      this.archiveMessage = '削除しました。';
      // 必要なら画面遷移やリロード処理を追加
    } catch (e) {
      this.archiveMessage = 'アーカイブに失敗しました。';
    } finally {
      this.isArchiving = false;
    }
  }

  startEdit() {
    if (!this.project) return;
    this.isEditing = true;
    this.editDescription = this.project.description || '';
    this.editDueDate = this.project.dueDate
      ? (this.project.dueDate.toDate ? this.project.dueDate.toDate().toISOString().slice(0, 16) : new Date(this.project.dueDate).toISOString().slice(0, 16))
      : null;
  }

  cancelEdit() {
    this.isEditing = false;
  }

  async saveEdit() {
    if (!this.project?.id) return;
    this.isSaving = true;
    try {
      const projectRef = doc(this.firestore, 'projects', this.project.id);
      const updateData: any = {
        description: this.editDescription,
        updatedAt: Timestamp.now(),
      };
      if (this.editDueDate) {
        updateData.dueDate = Timestamp.fromDate(new Date(this.editDueDate));
      } else {
        updateData.dueDate = null;
      }
      await setDoc(projectRef, updateData, { merge: true });
      this.isEditing = false;
      await this.loadProject();
    } finally {
      this.isSaving = false;
    }
  }

  goToIssueCreate() {
    if (!this.project?.id) return;
    this.router.navigate(['/issue-create'], { queryParams: { projectId: this.project.id } });
  }

  async startIssue(issue: any) {
    if (!this.project?.id || !issue?.id) return;
    const issueRef = doc(this.firestore, `projects/${this.project.id}/issues`, issue.id);
    await updateDoc(issueRef, { status: '進行中' });
    this.shouldScrollToIssues = true;
    await this.loadProject();
  }

  async updateIssueStatus(issue: any, status: string) {
    if (!this.project?.id || !issue?.id) return;
    const issueRef = doc(this.firestore, `projects/${this.project.id}/issues`, issue.id);
    await updateDoc(issueRef, { status });
    this.shouldScrollToIssues = true;
    await this.loadProject();
  }

  validateInviteEmail(): boolean {
    this.inviteErrorMessage = '';
    if (!this.inviteEmail || !this.inviteEmail.trim()) {
      this.inviteErrorMessage = 'メールアドレスを入力してください。';
      return false;
    }
    // 簡易メール形式チェック
    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailPattern.test(this.inviteEmail.trim())) {
      this.inviteErrorMessage = '正しいメールアドレスを入力してください。';
      return false;
    }
    return true;
  }

  async onInviteSend() {
    if (!this.validateInviteEmail()) return;
    this.inviteSending = true;
    this.inviteErrorMessage = '';
    this.inviteSuccessMessage = '';
    try {
      // usersコレクションからメールアドレスで検索
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', this.inviteEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        this.inviteErrorMessage = 'そのメールアドレスのユーザーは存在しません。';
        this.inviteSending = false;
        return;
      }
      const userDoc = snap.docs[0];
      const userUid = userDoc.id;

      // プロジェクト取得
      const projectRef = doc(this.firestore, `projects/${this.project.id}`);
      const projectSnap = await getDoc(projectRef);
      const project = projectSnap.data() as any;

      // すでにメンバーか
      if (project.members && project.members.includes(userUid)) {
        this.inviteErrorMessage = 'このユーザーはすでにメンバーです。';
        this.inviteSending = false;
        return;
      }

      // すでに招待中か
      const invitesRef = collection(this.firestore, `projects/${this.project.id}/invites`);
      const inviteQ = query(invitesRef, where('email', '==', this.inviteEmail.trim()), where('status', '==', 'pending'));
      const inviteSnap = await getDocs(inviteQ);
      if (!inviteSnap.empty) {
        this.inviteErrorMessage = 'このユーザーはすでに招待中です。';
        this.inviteSending = false;
        return;
      }

      // Firestoreに招待情報を追加
      const inviterUid = this.project.userId || '';
      await this.projectService.addProjectInvite(this.project.id, this.inviteEmail.trim(), inviterUid);
      this.inviteSuccessMessage = '招待を送信しました。';
      this.inviteEmail = '';
      setTimeout(() => {
        this.showInviteInput = false;
        this.inviteSuccessMessage = '';
      }, 1200);
    } catch (e) {
      this.inviteErrorMessage = '招待処理中にエラーが発生しました。';
    } finally {
      this.inviteSending = false;
    }
  }
} 