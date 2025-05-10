import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, setDoc, deleteDoc, Timestamp, collection, getDocs, updateDoc, query, where, serverTimestamp, orderBy, writeBatch, collection as fsCollection, doc as fsDoc, setDoc as fsSetDoc, deleteDoc as fsDeleteDoc, addDoc } from '@angular/fire/firestore';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { Project } from '../../../models/project.model';
import { Subscription } from 'rxjs';

interface Issue {
  id: string;
  issueTitle: string;
  description: string;
  status: '未着手' | '進行中' | '保留' | '完了';
  priority: 'high' | 'medium' | 'low';
  startDate?: any;
  dueDate?: any;
  assignee?: string;
  assignees?: string[];
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
export class ProjectDetailComponent implements OnInit, OnDestroy {
  project: Project | null = null;
  projectTitle: string = '';
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
  private userSub: Subscription | undefined;
  isSearching = false;
  commentText: string = '';
  isPostingComment: boolean = false;
  comments: any[] = [];
  commentAuthors: { [uid: string]: string } = {};
  showMentionList: boolean = false;
  mentionQuery: string = '';
  filteredMembers: any[] = [];
  mentionStartIndex: number | null = null;
  // コメントごとのローカルいいね状態
  commentLikeStates: { [commentId: string]: boolean } = {};
  replyingCommentId: string | null = null;
  replyText: string = '';
  // 返信用メンション状態
  replyShowMentionList: boolean = false;
  replyMentionQuery: string = '';
  replyFilteredMembers: any[] = [];
  replyMentionStartIndex: number | null = null;
  expandedReplies: { [commentId: string]: boolean } = {};

  get nonCreatorMembers() {
    return this.projectMembers.filter(member => !member.isCreator);
  }

  get filteredMembersWithAll() {
    return [
      { uid: 'all', displayName: 'All' },
      ...this.filteredMembers
    ];
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
    // ユーザー情報の購読
    this.userSub = this.authService.user$.subscribe(user => {
      this.currentUserId = user?.uid || null;
    });
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      await this.loadProject(projectId);
      await this.loadProjectMembers();
      await this.loadIssues();
      await this.loadComments();
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
        this.projectTitle = data['title'] || '';
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
        // 1. まず親アーカイブドキュメントを作成
        await setDoc(doc(this.firestore, 'archives', this.project.id), {
          createdBy: this.project.createdBy,
          members: this.project.members,
          // 他のプロジェクト情報も必要に応じて追加
        });

        // 2. commentsとrepliesをバッチでコピー＆削除
        const commentsRef = collection(this.firestore, 'projects', this.project.id, 'comments');
        const commentsSnap = await getDocs(commentsRef);
        const batch = writeBatch(this.firestore);

        for (const commentDoc of commentsSnap.docs) {
          const commentData = commentDoc.data();
          const commentId = commentDoc.id;

          // アーカイブ先にコメントをコピー
          const archiveCommentRef = doc(this.firestore, 'archives', this.project.id, 'comments', commentId);
          batch.set(archiveCommentRef, commentData);

          // replies取得
          const repliesRef = collection(this.firestore, 'projects', this.project.id, 'comments', commentId, 'replies');
          const repliesSnap = await getDocs(repliesRef);

          for (const replyDoc of repliesSnap.docs) {
            const replyData = replyDoc.data();
            const replyId = replyDoc.id;
            // アーカイブ先にリプライをコピー
            const archiveReplyRef = doc(this.firestore, 'archives', this.project.id, 'comments', commentId, 'replies', replyId);
            batch.set(archiveReplyRef, replyData);
            // 元のリプライを削除
            batch.delete(replyDoc.ref);
          }

          // 元のコメントを削除
          batch.delete(commentDoc.ref);
        }

        await batch.commit();

        // 既存のプロジェクトアーカイブ処理
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

      // 通知作成処理を追加
      const notificationsRef = collection(this.firestore, 'notifications');
      const existingMembers = (this.project.members || []).filter((memberUid: string) => memberUid !== uid);
      const addedMembers = [uid];
      const membersField = [
        ...existingMembers.map((memberUid: string) => ({ uid: memberUid, type: 'existing' })),
        ...addedMembers.map((memberUid: string) => ({ uid: memberUid, type: 'added' }))
      ];
      await addDoc(notificationsRef, {
        createdAt: Timestamp.now(),
        recipients: [uid],
        message: 'プロジェクトメンバーに追加されました。',
        projectId: this.project.id,
        read: false,
        title: this.project.title || ''
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

  async loadComments() {
    if (!this.project?.id) return;
    const commentsRef = collection(this.firestore, 'projects', this.project.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    this.comments = [];
    // ユニークなuidを抽出
    const uids = new Set<string>();
    for (const docSnap of snap.docs) {
      const comment = { id: docSnap.id, ...docSnap.data(), replies: [] as any[] } as any;
      // repliesサブコレクション取得
      const repliesRef = collection(this.firestore, 'projects', this.project.id, 'comments', comment.id, 'replies');
      const repliesSnap = await getDocs(repliesRef);
      comment.replies = repliesSnap.docs.map(r => ({ id: r.id, ...r.data() }));
      this.comments.push(comment);
      if (comment.author?.uid) uids.add(comment.author.uid);
      for (const reply of comment.replies) {
        if (reply.user?.uid) uids.add(reply.user.uid);
      }
    }
    this.commentAuthors = {};
    for (const uid of uids) {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      this.commentAuthors[uid] = userDoc.exists() ? (userDoc.data()['displayName'] || '不明') : '不明';
    }
  }

  formatDateTime(ts: any): string {
    if (!ts) return '';
    let date: Date;
    if (ts.toDate) {
      try { date = ts.toDate(); } catch { return String(ts); }
    } else if (ts instanceof Date) {
      date = ts;
    } else if (typeof ts === 'number') {
      date = new Date(ts * 1000);
    } else {
      date = new Date(ts);
    }
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }

  // コメント本文から@メンション（@displayName/@All）を抽出しuid配列で返す
  extractMentionUids(content: string): string[] {
    const mentionPattern = /@([^\s@]+)/g;
    const mentions: string[] = [];
    let match;
    let allMentioned = false;

    console.log('[DEBUG] projectMembers:', this.projectMembers);

    while ((match = mentionPattern.exec(content)) !== null) {
      const displayName = match[1];
      console.log('[DEBUG] 抽出displayName:', displayName);
      if (displayName === 'All') {
        allMentioned = true;
      } else {
        const member = this.projectMembers?.find(m => m.displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
        console.log('[DEBUG] member found for', displayName, ':', member);
        if (member && member.uid) {
          mentions.push(member.uid);
        }
      }
    }

    if (allMentioned && this.projectMembers) {
      mentions.push(...this.projectMembers.filter(m => m.uid !== this.currentUserId).map(m => m.uid));
    }

    // 重複排除
    return Array.from(new Set(mentions));
  }

  // コメント本文から@メンションを除去
  removeMentions(text: string): string {
    return text.replace(/@[^ -\s@]+ ?/g, '').trim();
  }

  // コメント投稿
  async postComment() {
    if (!this.project?.id || !this.commentText.trim()) return;
    this.isPostingComment = true;
    try {
      const user = this.authService.getCurrentUser();
      const commentsRef = collection(this.firestore, 'projects', this.project.id, 'comments');
      const mentions = this.extractMentionUids(this.commentText.trim());
      await setDoc(doc(commentsRef), {
        content: this.commentText.trim(),
        author: user ? { uid: user.uid, displayName: user.displayName || '' } : null,
        createdAt: Timestamp.now(),
        mentions: mentions
      });

      // メンション通知を作成
      if (mentions.length > 0) {
        const notificationsRef = collection(this.firestore, 'notifications');
        const contentWithoutMentions = this.removeMentions(this.commentText.trim());
        let contentPreview = contentWithoutMentions.slice(0, 10);
        if (contentWithoutMentions.length > 10) {
          contentPreview += '・・・';
        }
        await addDoc(notificationsRef, {
          createdAt: Timestamp.now(),
          title: this.projectTitle,
          message: `コメントでメンションされました。「${contentPreview}」`,
          recipients: mentions,
          read: false,
          projectId: this.project?.id,
          content: this.commentText.trim()
        });
      }

      this.commentText = '';
      await this.loadComments();
    } catch (e) {
      console.error('コメント投稿エラー', e);
    } finally {
      this.isPostingComment = false;
    }
  }

  async deleteComment(commentId: string, authorUid: string) {
    if (!this.project?.id) return;
    if (!confirm('このコメントを削除しますか？')) return;
    try {
      await deleteDoc(doc(this.firestore, 'projects', this.project.id, 'comments', commentId));
      await this.loadComments();
    } catch (e) {
      console.error('コメント削除エラー', e);
    }
  }

  onCommentInput(event: any) {
    const value = event.target.value;
    const cursorPos = event.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      this.mentionQuery = textBeforeCursor.slice(atIndex + 1);
      this.filteredMembers = this.projectMembers.filter(m =>
        m.displayName.toLowerCase().includes(this.mentionQuery.toLowerCase()) &&
        m.uid !== this.currentUserId
      );
      this.showMentionList = this.filteredMembers.length > 0;
      this.mentionStartIndex = atIndex;
    } else {
      this.showMentionList = false;
      this.mentionStartIndex = null;
    }
  }

  selectMention(member: any) {
    if (this.mentionStartIndex !== null) {
      const textarea = document.querySelector('.comment-textarea') as HTMLTextAreaElement;
      const cursorPos = textarea ? textarea.selectionStart : this.commentText.length;
      const before = this.commentText.slice(0, this.mentionStartIndex);
      const after = this.commentText.slice(cursorPos);
      this.commentText = `${before}@${member.displayName} ${after}`;
      this.showMentionList = false;
      this.mentionStartIndex = null;
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = (before + '@' + member.displayName + ' ').length;
        }
      });
    }
  }

  toggleLike(commentId: string) {
    this.commentLikeStates[commentId] = !this.commentLikeStates[commentId];
  }

  async likeComment(comment: any) {
    if (!this.project?.id || !this.currentUserId) return;
    const commentRef = doc(this.firestore, 'projects', this.project.id, 'comments', comment.id);
    const likes: string[] = Array.isArray(comment['likes']) ? [...comment['likes']] : [];
    if (!likes.includes(this.currentUserId)) {
      likes.push(this.currentUserId);
      await updateDoc(commentRef, { likes });
      comment['likes'] = likes;

      // --- 通知作成 ---
      if (comment.author?.uid && comment.author.uid !== this.currentUserId) {
        const notificationsRef = collection(this.firestore, 'notifications');
        const contentWithoutMentions = this.removeMentions(comment.content || '');
        let contentPreview = contentWithoutMentions.slice(0, 10);
        if (contentWithoutMentions.length > 10) {
          contentPreview += '・・・';
        }
        await addDoc(notificationsRef, {
          createdAt: Timestamp.now(),
          title: this.projectTitle,
          message: `コメントにいいねされました。「${contentPreview}」`,
          recipients: [comment.author.uid],
          read: false,
          projectId: this.project?.id,
          content: comment.content || ''
        });
      }
      // --- 通知作成ここまで ---
    }
  }

  /**
   * 指定コメントにログインユーザーがいいねしているか判定
   */
  hasLiked(comment: any): boolean {
    if (!this.currentUserId) {
      return false;
    }
    const likes: string[] = Array.isArray(comment['likes']) ? comment['likes'] : [];
    return likes.includes(this.currentUserId);
  }

  /**
   * 指定コメントのlikesからログインユーザーを削除（いいね解除）
   */
  async unlikeComment(comment: any) {
    if (!this.project?.id || !this.currentUserId) return;
    const commentRef = doc(this.firestore, 'projects', this.project.id, 'comments', comment.id);
    const likes: string[] = Array.isArray(comment['likes']) ? [...comment['likes']] : [];
    const index = likes.indexOf(this.currentUserId);
    if (index !== -1) {
      likes.splice(index, 1);
      await updateDoc(commentRef, { likes });
      comment['likes'] = likes;
    }
  }

  openReplyPopup(commentId: string) {
    this.replyingCommentId = commentId;
    this.replyText = '';
  }

  closeReplyPopup() {
    this.replyingCommentId = null;
    this.replyText = '';
  }

  onReplyInput(event: any) {
    const value = event.target.value;
    const cursorPos = event.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      this.replyMentionQuery = textBeforeCursor.slice(atIndex + 1);
      // プロジェクトメンバー全員＋@Allでフィルタ
      const allMembers = [
        { uid: 'all', displayName: 'All' },
        ...this.projectMembers
      ];
      this.replyFilteredMembers = allMembers.filter(m =>
        m.displayName.toLowerCase().includes(this.replyMentionQuery.toLowerCase())
      );
      this.replyShowMentionList = this.replyFilteredMembers.length > 0;
      this.replyMentionStartIndex = atIndex;
    } else {
      this.replyShowMentionList = false;
      this.replyMentionStartIndex = null;
    }
  }

  selectReplyMention(member: any) {
    if (this.replyMentionStartIndex !== null) {
      const textarea = document.querySelector('.reply-textarea') as HTMLTextAreaElement;
      const cursorPos = textarea ? textarea.selectionStart : this.replyText.length;
      const before = this.replyText.slice(0, this.replyMentionStartIndex);
      const after = this.replyText.slice(cursorPos);
      this.replyText = `${before}@${member.displayName} ${after}`;
      this.replyShowMentionList = false;
      this.replyMentionStartIndex = null;
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = (before + '@' + member.displayName + ' ').length;
        }
      });
    }
  }

  async sendReply(comment: any) {
    if (!this.project?.id || !this.replyText.trim() || !this.currentUserId) return;
    const user = this.authService.getCurrentUser();
    const repliesRef = collection(this.firestore, 'projects', this.project.id, 'comments', comment.id, 'replies');
    const replyData = {
      user: user ? { uid: user.uid, displayName: user.displayName || '' } : null,
      content: this.replyText.trim(),
      createdAt: Timestamp.now()
    };
    await setDoc(doc(repliesRef), replyData);
    // ローカルにも即時反映
    if (!comment.replies) comment.replies = [];
    comment.replies.push({
      ...replyData,
      id: Math.random().toString(36).slice(2) // 仮ID
    });
    this.replyText = '';
    this.replyingCommentId = null;
    this.replyShowMentionList = false;
    this.replyMentionQuery = '';
    this.replyMentionStartIndex = null;

    // --- 通知作成 ---
    if (comment.author?.uid && comment.author.uid !== this.currentUserId) {
      const notificationsRef = collection(this.firestore, 'notifications');
      const contentWithoutMentions = this.removeMentions(replyData.content);
      let contentPreview = contentWithoutMentions.slice(0, 10);
      if (contentWithoutMentions.length > 10) {
        contentPreview += '・・・';
      }
      await addDoc(notificationsRef, {
        createdAt: Timestamp.now(),
        title: this.projectTitle,
        message: `コメントに返信がありました。「${contentPreview}」`,
        recipients: [comment.author.uid],
        read: false,
        projectId: this.project?.id,
        content: replyData.content
      });
    }
    // --- 通知作成ここまで ---
  }

  getRepliesSorted(comment: any) {
    return [...(comment.replies || [])].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // 降順
    });
  }

  getCommentsSorted() {
    return [...(this.comments || [])].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // 降順
    });
  }

  toggleReplies(commentId: string) {
    this.expandedReplies[commentId] = !this.expandedReplies[commentId];
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }
} 