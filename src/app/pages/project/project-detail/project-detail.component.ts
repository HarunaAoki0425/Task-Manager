import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, setDoc, deleteDoc, Timestamp, collection, getDocs, updateDoc, query, where, serverTimestamp } from '@angular/fire/firestore';
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
  color?: string;  // プロジェクトから継承したカラー
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
  isArchived = false;  // プロジェクトのアーカイブ状態を管理

  // プロジェクトカラー関連
  projectColors = [
    { name: 'ブルー', value: '#2196F3' },
    { name: 'グリーン', value: '#4CAF50' },
    { name: 'レッド', value: '#F44336' },
    { name: 'パープル', value: '#9C27B0' },
    { name: 'オレンジ', value: '#FF9800' },
    { name: 'ティール', value: '#009688' },
    { name: 'ピンク', value: '#E91E63' },
    { name: 'インディゴ', value: '#3F51B5' }
  ];
  editColor: string = '';
  customColor: string = '#000000';
  isColorPickerVisible: boolean = false;

  issuesNotStarted: Issue[] = [];
  issuesInProgress: Issue[] = [];
  issuesOnHold: Issue[] = [];
  issuesDone: Issue[] = [];
  shouldScrollToIssues = false;
  membersUsernames: { uid: string, displayName: string, isCreator: boolean }[] = [];
  projectMembers: { uid: string; displayName: string; email: string; isCreator: boolean }[] = [];
  isAddingMember = false;
  searchQuery = '';
  searchResults: { uid: string; displayName: string; email: string; }[] = [];
  currentUserId: string | null = null;
  isSearching = false;

  get nonCreatorMembers() {
    return this.projectMembers.filter(member => !member.isCreator);
  }

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private ngZone: NgZone,
    private projectService: ProjectService,
    private authService: AuthService
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.uid || null;
  }

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
      const projectRef = doc(this.firestore, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (projectSnap.exists()) {
        const data = projectSnap.data();
        this.project = {
          id: projectSnap.id,
          ...data
        } as Project;
        this.isArchived = data['isArchived'] || false;  // アーカイブ状態を設定
        
        // クリエイター情報を取得
        if (data['createdBy']) {
          const userRef = doc(this.firestore, 'users', data['createdBy']);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            this.creatorName = userSnap.data()['displayName'] || 'Unknown User';
          }
        }
      } else {
        this.archiveMessage = 'プロジェクトが見つかりませんでした。';
      }
    } catch (error) {
      console.error('Error loading project:', error);
      this.archiveMessage = 'プロジェクトの読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  async loadProjectMembers() {
    if (!this.project?.members) return;
    
    try {
      const memberPromises = this.project.members.map(async (uid) => {
        const userDoc = doc(this.firestore, 'users', uid);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          return {
            uid,
            displayName: userData['displayName'] || 'Unknown User',
            email: userData['email'] || '',
            isCreator: uid === this.project?.createdBy
          };
        }
        return null;
      });

      const members = (await Promise.all(memberPromises)).filter((member): member is NonNullable<typeof member> => member !== null);
      this.projectMembers = members;
    } catch (error) {
      console.error('Error loading project members:', error);
      this.archiveMessage = 'メンバー情報の読み込みに失敗しました。';
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
    // YYYY/MM/DD 形式で返す
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
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
    this.editDescription = this.project.description;
    this.editDueDate = this.project.dueDate ? this.formatDateForInput(this.project.dueDate) : null;
    this.editColor = this.project.color || this.projectColors[0].value;
    if (!this.projectColors.some(color => color.value === this.editColor)) {
      this.customColor = this.editColor;
      this.editColor = 'custom';
    }
  }

  formatDateForInput(ts: Timestamp): string {
    const date = ts.toDate();
    return date.toISOString().slice(0, 16);
  }

  cancelEdit() {
    this.isEditing = false;
    this.editDescription = '';
    this.editDueDate = null;
    this.editColor = '';
    this.isColorPickerVisible = false;
  }

  selectProjectColor(color: string) {
    if (color === 'custom') {
      this.isColorPickerVisible = true;
    } else {
      this.editColor = color;
      this.isColorPickerVisible = false;
    }
  }

  onColorPickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.customColor = input.value;
    this.editColor = 'custom';
  }

  closeColorPicker() {
    this.isColorPickerVisible = false;
  }

  async saveEdit() {
    if (!this.project?.id) return;

    try {
      this.isSaving = true;
      const projectRef = doc(this.firestore, 'projects', this.project.id);
      await updateDoc(projectRef, {
        description: this.editDescription,
        dueDate: this.editDueDate,
        color: this.editColor === 'custom' ? this.customColor : this.editColor,
        updatedAt: serverTimestamp()
      });

      // プロジェクト情報を再読み込み
      await this.loadProject(this.project.id);
      this.isEditing = false;
    } catch (error) {
      console.error('Error updating project:', error);
      this.archiveMessage = 'プロジェクトの更新に失敗しました。';
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

  openAddMemberDialog() {
    this.isAddingMember = true;
    this.searchQuery = '';
    this.searchResults = [];
  }

  closeAddMemberDialog() {
    this.isAddingMember = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  async searchUsers() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;
    try {
      const usersRef = collection(this.firestore, 'users');
      const searchTerm = this.searchQuery.toLowerCase().trim();
      
      // メールアドレスでの検索
      const emailQuery = query(usersRef,
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff')
      );
      
      // ユーザー名での検索
      const displayNameQuery = query(usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff')
      );

      // 両方のクエリを実行
      const [emailSnapshot, displayNameSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(displayNameQuery)
      ]);

      // 結果をマージして重複を除去
      const userMap = new Map<string, { uid: string; displayName: string; email: string; }>();
      
      // メールアドレス検索の結果を追加
      emailSnapshot.docs.forEach(doc => {
        const userData = doc.data() as { displayName: string; email: string; };
        userMap.set(doc.id, {
          uid: doc.id,
          displayName: userData.displayName || 'Unknown User',
          email: userData.email || ''
        });
      });

      // ユーザー名検索の結果を追加
      displayNameSnapshot.docs.forEach(doc => {
        const userData = doc.data() as { displayName: string; email: string; };
        userMap.set(doc.id, {
          uid: doc.id,
          displayName: userData.displayName || 'Unknown User',
          email: userData.email || ''
        });
      });

      // 自分自身を除外して結果を配列に変換
      this.searchResults = Array.from(userMap.values())
        .filter(user => user.uid !== this.currentUserId)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      this.isSearching = false;
    }
  }

  isUserAlreadyMember(uid: string): boolean {
    return this.project?.members?.includes(uid) || false;
  }

  async addMember(uid: string) {
    if (!this.project?.id || this.isUserAlreadyMember(uid)) return;

    try {
      const projectRef = doc(this.firestore, 'projects', this.project.id);
      const updatedMembers = [...(this.project.members || []), uid];
      await updateDoc(projectRef, { 
        members: updatedMembers,
        updatedAt: Timestamp.now()
      });
      
      // プロジェクトとメンバー情報を再読み込み
      await this.loadProject(this.project.id);
      await this.loadProjectMembers();
      
      // 検索結果から追加したユーザーを除外
      this.searchResults = this.searchResults.filter(user => user.uid !== uid);
    } catch (error) {
      console.error('Error adding member:', error);
    }
  }

  async removeMember(uid: string) {
    if (!this.project?.id || !this.project.members) return;
    
    if (confirm('このメンバーを削除してもよろしいですか？')) {
      try {
        const projectRef = doc(this.firestore, 'projects', this.project.id);
        const updatedMembers = this.project.members.filter(memberId => memberId !== uid);
        await updateDoc(projectRef, { 
          members: updatedMembers,
          updatedAt: Timestamp.now()
        });
        
        // プロジェクトとメンバー情報を再読み込み
        await this.loadProject(this.project.id);
        await this.loadProjectMembers();
      } catch (error) {
        console.error('Error removing member:', error);
      }
    }
  }
} 