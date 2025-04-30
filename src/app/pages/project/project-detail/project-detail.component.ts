import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, setDoc, deleteDoc, Timestamp, collection, getDocs, updateDoc, query, where } from '@angular/fire/firestore';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { Project } from '../../../models/project.model';

interface Issue {
  id: string;
  title: string;
  description: string;
  status: '未着手' | '進行中' | '保留' | '完了';
  priority: 'high' | 'medium' | 'low';
  startDate?: any;
  dueDate?: any;
  assignee?: string;
  createdAt?: any;
  updatedAt?: any;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css']
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  creatorName: string = '';
  isLoading = true;
  isArchiving = false;
  archiveMessage = '';
  isEditing = false;
  editDescription = '';
  editDueDate: string | null = null;
  isSaving = false;
  issuesNotStarted: Issue[] = [];
  issuesInProgress: Issue[] = [];
  issuesOnHold: Issue[] = [];
  issuesDone: Issue[] = [];
  shouldScrollToIssues = false;
  membersUsernames: { uid: string, displayName: string, isCreator: boolean }[] = [];
  projectMembers: { uid: string; displayName: string; email: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private ngZone: NgZone,
    private projectService: ProjectService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      await this.loadProject(projectId);
      await this.loadProjectMembers();
      await this.loadIssues();
    }
  }

  async loadProject(projectId: string) {
    try {
      this.project = await this.projectService.getProject(projectId);
      if (this.project) {
        // プロジェクトの作成者の表示名を取得
        const creatorDoc = doc(this.firestore, 'users', this.project.createdBy);
        const creatorSnap = await getDoc(creatorDoc);
        this.creatorName = creatorSnap.exists() ? creatorSnap.data()['displayName'] || 'no name' : 'no name';
      }
    } catch (error) {
      console.error('Error loading project:', error);
      this.archiveMessage = 'プロジェクトの読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  async loadProjectMembers() {
    if (this.project?.id) {  // idの存在を明示的にチェック
      try {
        this.projectMembers = await this.projectService.getProjectMembers(this.project.id);
      } catch (error) {
        console.error('Error loading project members:', error);
        this.archiveMessage = 'メンバー情報の読み込みに失敗しました。';
      }
    }
  }

  async loadIssues() {
    if (!this.project?.id) return;
    try {
      const issuesRef = collection(this.firestore, `projects/${this.project.id}/issues`);
      const issuesSnap = await getDocs(issuesRef);
      
      // 配列を初期化
      this.issuesNotStarted = [];
      this.issuesInProgress = [];
      this.issuesOnHold = [];
      this.issuesDone = [];

      // 取得した課題を状態別に振り分け
      issuesSnap.docs.forEach(doc => {
        const issue = { id: doc.id, ...doc.data() } as Issue;
        switch (issue.status) {
          case '未着手':
            this.issuesNotStarted.push(issue);
            break;
          case '進行中':
            this.issuesInProgress.push(issue);
            break;
          case '保留':
            this.issuesOnHold.push(issue);
            break;
          case '完了':
            this.issuesDone.push(issue);
            break;
        }
      });
    } catch (error) {
      console.error('Error loading issues:', error);
    }
  }

  // ユーザーIDからdisplayNameを取得するメソッド
  getMemberDisplayName(uid: string | undefined): string {
    if (!uid) return ''; // undefinedの場合は空文字を返す
    const member = this.projectMembers.find(m => m.uid === uid);
    return member ? member.displayName : 'Unknown';
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

    if (confirm('このプロジェクトをアーカイブしますか？\n※プロジェクト内のすべての課題とToDoもアーカイブされます。')) {
      try {
        await this.projectService.archiveProject(this.project.id);
        this.router.navigate(['/projects']);
      } catch (error) {
        console.error('Error archiving project:', error);
        this.archiveMessage = 'プロジェクトのアーカイブに失敗しました。';
      }
    }
  }

  startEdit() {
    if (!this.project) return;
    this.isEditing = true;
    this.editDescription = this.project.description || '';
    
    // Firestoreのタイムスタンプ型かどうかをチェック
    if (this.project.dueDate) {
      let date: Date;
      if ('toDate' in this.project.dueDate) {
        // Firestoreのタイムスタンプの場合
        date = (this.project.dueDate as unknown as { toDate(): Date }).toDate();
      } else {
        // 通常のDateオブジェクトの場合
        date = this.project.dueDate;
      }
      this.editDueDate = date.toISOString().slice(0, 16);
    } else {
      this.editDueDate = null;
    }
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
      await this.loadProject(this.project.id);
    } finally {
      this.isSaving = false;
    }
  }

  goToProjectList() {
    this.router.navigate(['/projects']);
  }

  goToIssueCreate() {
    if (this.project) {
      this.router.navigate(['projects', this.project.id, 'issues', 'create']);
    }
  }

  goToIssueDetail(issueId: string) {
    if (this.project) {
      // URLパラメータをエンコードせずに渡す
      this.router.navigate(['projects', this.project.id, 'issues', issueId], {
        skipLocationChange: false,
        replaceUrl: false
      });
    }
  }

  async startIssue(issue: Issue) {
    if (!this.project?.id || !issue?.id) return;
    const issueRef = doc(this.firestore, `projects/${this.project.id}/issues`, issue.id);
    await updateDoc(issueRef, { status: '進行中' });
    this.shouldScrollToIssues = true;
    await this.loadIssues();
  }

  async updateIssueStatus(issue: Issue, status: string) {
    if (!this.project?.id || !issue?.id) return;
    const issueRef = doc(this.firestore, `projects/${this.project.id}/issues`, issue.id);
    await updateDoc(issueRef, { status });
    this.shouldScrollToIssues = true;
    await this.loadIssues();
  }
} 