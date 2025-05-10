import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, getDocs, updateDoc, Timestamp, addDoc, deleteDoc, where } from '@angular/fire/firestore';
import { User } from '../../../models/user.model';
import { Todo } from '../../../models/todo.model';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';

interface Issue {
  id?: string;
  issueTitle: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  assignees: string[];
  priority: string;
  memo: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  color?: string;
}

interface FirestoreIssueData {
  issueTitle: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  assignees: string[];
  priority: string;
  memo: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  color?: string;
}

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issue-detail.component.html',
  styleUrls: ['./issue-detail.component.css']
})
export class IssueDetailComponent implements OnInit {
  projectId: string | null = null;
  issueId: string | null = null;
  issue: Issue | null = null;
  project: { title: string } | null = null;  // プロジェクト情報を保持
  todos: Todo[] = [];
  memberDetails: User[] = [];
  isLoading = true;
  error: string | null = null;
  isPopupVisible = false;
  editingIssue: {
    issueTitle: string;
    startDate: string;
    dueDate: string;
    assignees: string[];
    priority: string;
    memo: string;
  } = {
    issueTitle: '',
    startDate: '',
    dueDate: '',
    assignees: [],
    priority: '',
    memo: ''
  };

  // 新しいTodo用のプロパティ
  newTodo = {
    todoTitle: '',
    assignee: '',
    todoDueDate: null as string | null
  };

  // テンプレートで使用するためにTimestampを追加
  Timestamp = Timestamp;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private projectService: ProjectService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.projectId = params.get('projectId');
      this.issueId = params.get('issueId');
      
      if (this.projectId && this.issueId) {
        this.loadIssue();
        this.loadProjectMembers();
      } else {
        this.error = '課題が見つかりませんでした。';
        this.isLoading = false;
      }
    });
  }

  // プロジェクトメンバーを読み込む
  async loadProjectMembers() {
    if (!this.projectId) {
      return;
    }
    try {
      this.memberDetails = await this.projectService.getProjectMembers(this.projectId);
    } catch (error) {
    }
  }

  // Todoの完了状態を切り替え
  async toggleTodo(todo: Todo) {
    if (!this.projectId || !this.issueId || !todo.id) return;

    try {
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${todo.id}`);
      const now = Timestamp.now();
      const newCompleted = !todo.completed;

      if (newCompleted) {
        // 完了状態に変更する場合
        await updateDoc(todoRef, {
          completed: true,
          completedAt: now,
          updatedAt: now
        });
        todo.completed = true;
        todo.completedAt = now;
      } else {
        // 未完了状態に変更する場合
        await updateDoc(todoRef, {
          completed: false,
          completedAt: null,
          updatedAt: now
        });
        todo.completed = false;
        todo.completedAt = null;
      }
      todo.updatedAt = now;
    } catch (error) {
      this.error = 'Todoの状態更新に失敗しました。';
    }
  }

  // プロジェクト詳細画面に戻る
  goBack() {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId]);
    }
  }

  // issue情報を取得
  async loadIssue() {
    if (!this.projectId || !this.issueId) return;

    try {
      // プロジェクト情報を取得
      const projectRef = doc(this.firestore, `projects/${this.projectId}`);
      const projectSnap = await getDoc(projectRef);
      
      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        this.project = {
          title: projectData['title'] || ''
        };
      } else {
        return;
      }

      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      const issueSnap = await getDoc(issueRef);
      
      if (issueSnap.exists()) {
        const data = issueSnap.data() as FirestoreIssueData;
        this.issue = {
          id: issueSnap.id,
          issueTitle: data.issueTitle,
          startDate: data.startDate,
          dueDate: data.dueDate,
          assignees: data.assignees,
          priority: data.priority,
          memo: data.memo,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          color: data.color
        } as Issue;
        await this.loadTodos();
        // デバッグ: assigneesの中身を出力
        if (this.issue.assignees) {
          for (const uid of this.issue.assignees) {
          }
        }
      } else {
        this.error = '課題が見つかりませんでした。';
      }
    } catch (error) {
      this.error = '課題の読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  // Todoリストを取得
  async loadTodos() {
    if (!this.projectId || !this.issueId) return;

    try {
      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const todosQuery = query(todosRef);
      const todosDocs = await getDocs(todosQuery);

      this.todos = todosDocs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Todo[];
    } catch (error) {
      this.error = 'Todoの読み込みに失敗しました。';
    }
  }

  getMemberDisplayName(uid: string): string {
    if (!this.memberDetails) return '';
    if (uid === 'unassigned') {
      return ' ';
    }
    const member = this.memberDetails.find(m => m.uid === uid);
    return member?.displayName || '未割り当て';
  }

  formatDate(ts: string | Timestamp | null | undefined): string {
    if (!ts) return '';
    
    let date: Date;
    if (typeof ts === 'string') {
      date = new Date(ts);
    } else if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else {
      return '';
    }

    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }

  getPriorityLabel(priority: string): string {
    const labels: { [key: string]: string } = {
      high: '高',
      medium: '中',
      low: '低'
    };
    return labels[priority] || priority;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      open: '未対応',
      in_progress: '対応中',
      resolved: '解決済み',
      closed: '完了'
    };
    return labels[status] || status;
  }

  // 新しいTodoを追加
  async addTodo() {
    if (!this.projectId || !this.issueId || !this.issue || !this.project || !this.newTodo.todoTitle) return;

    try {
      // issueのcolorを取得
      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      const issueSnap = await getDoc(issueRef);
      const issueColor = issueSnap.exists() ? issueSnap.data()['color'] : null;

      const now = Timestamp.now();
      const todoData: Omit<Todo, 'id'> = {
        todoTitle: this.newTodo.todoTitle,
        assignee: this.newTodo.assignee,
        todoDueDate: this.newTodo.todoDueDate ? Timestamp.fromDate(new Date(this.newTodo.todoDueDate)) : null,
        completed: false,
        completedAt: null,
        projectId: this.projectId,
        projectTitle: this.project.title,  // プロジェクトのタイトルを正しく設定
        issueId: this.issueId,
        issueTitle: this.issue.issueTitle,      // 課題のタイトルを設定
        createdAt: now,
        updatedAt: now,
        color: issueColor  // issueのcolorを設定
      };

      // 入力値の検証
      if (!todoData.projectTitle) {
        throw new Error('プロジェクトタイトルが設定されていません');
      }

      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const todoDocRef = await addDoc(todosRef, todoData);

      // UIに表示するTodoリストを更新
      const todo: Todo = {
        id: todoDocRef.id,
        ...todoData
      };
      this.todos.push(todo);

      // Todo担当者への通知
      const assignee = todo.assignee;
      const currentUser = this.authService.getCurrentUser();
      if (assignee && assignee !== (currentUser?.uid ?? '') && assignee !== 'unassigned') {
        const notificationsRef = collection(this.firestore, 'notifications');
        await addDoc(notificationsRef, {
          projectId: this.projectId,
          issueId: this.issueId,
          issueTitle: this.issue?.issueTitle || '',
          createdAt: now,
          read: false,
          recipients: [assignee],
          message: `課題「${this.issue?.issueTitle || ''}」のToDo「${todo.todoTitle}」の担当者に選ばれました。`
        });
      }

      // フォームをリセット
      this.newTodo = {
        todoTitle: '',
        assignee: '',
        todoDueDate: null
      };
    } catch (error) {
      this.error = 'Todoの追加に失敗しました。';
    }
  }

  // ポップアップの表示/非表示を切り替え
  togglePopup() {
    this.isPopupVisible = !this.isPopupVisible;
    if (this.isPopupVisible && this.issue) {
      // ポップアップを開く時に現在の値をフォームに設定
      this.editingIssue = {
        issueTitle: this.issue.issueTitle,
        startDate: this.formatDateForInput(this.issue.startDate),
        dueDate: this.formatDateForInput(this.issue.dueDate),
        assignees: this.issue.assignees || [],
        priority: this.issue.priority,
        memo: this.issue.memo || ''
      };
    }
  }

  // 日付をinput type="date"用にフォーマット
  formatDateForInput(timestamp: Timestamp | null): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toISOString().split('T')[0];
  }

  // Firestoreのタイムスタンプに変換
  convertToTimestamp(dateString: string): Timestamp {
    if (!dateString) return Timestamp.now();
    const date = new Date(dateString);
    return Timestamp.fromDate(date);
  }

  toggleAssignee(uid: string) {
    const index = this.editingIssue.assignees.indexOf(uid);
    if (index === -1) {
      this.editingIssue.assignees.push(uid);
      this.editingIssue.assignees = this.editingIssue.assignees.filter(a => a !== 'unassigned');
    } else {
      this.editingIssue.assignees.splice(index, 1);
      // 0人になっても空配列のまま
    }
  }

  isAssigneeSelected(uid: string): boolean {
    return this.editingIssue.assignees.includes(uid);
  }

  async saveIssue() {
    if (!this.projectId || !this.issueId) {
      this.error = 'プロジェクトIDまたは課題IDが見つかりません。';
      return;
    }

    try {
      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      const now = Timestamp.now();

      // 変更前のassignees
      const prevAssignees = this.issue?.assignees || [];
      const assignees = this.editingIssue.assignees.filter(a => a !== 'unassigned');

      const updatedIssue = {
        issueTitle: this.editingIssue.issueTitle,
        startDate: this.convertToTimestamp(this.editingIssue.startDate),
        dueDate: this.convertToTimestamp(this.editingIssue.dueDate),
        assignees, // 空配列もそのまま保存
        priority: this.editingIssue.priority,
        memo: this.editingIssue.memo,
        updatedAt: now
      };

      await updateDoc(issueRef, updatedIssue);

      // 通知: 新たに追加された担当者のみ
      const newAssignees = assignees.filter(uid => !prevAssignees.includes(uid));
      // 編集者（自分）を除外
      const currentUser = this.authService.getCurrentUser();
      const recipients = newAssignees.filter(uid => uid !== currentUser?.uid);
      if (recipients.length > 0) {
        const notificationsRef = collection(this.firestore, 'notifications');
        await addDoc(notificationsRef, {
          projectId: this.projectId,
          issueId: this.issueId,
          issueTitle: this.editingIssue.issueTitle,
          createdAt: now,
          read: false,
          recipients: recipients,
          message: `課題「${this.editingIssue.issueTitle}」の担当者に追加されました。`
        });
      }

      // 編集ポップアップを閉じ、課題詳細を再取得
      this.isPopupVisible = false;
      await this.loadIssue();
    } catch (error) {
      this.error = '課題の保存に失敗しました。';
    }
  }

  async deleteTodo(todoId: string) {
    if (!this.projectId || !this.issueId) return;

    try {
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${todoId}`);
      await deleteDoc(todoRef);
      this.todos = this.todos.filter(todo => todo.id !== todoId);
    } catch (error) {
      this.error = 'Todoの削除に失敗しました。';
    }
  }

  async confirmDeleteTodo(todoId: string | undefined) {
    if (!todoId) return;
    
    const isConfirmed = window.confirm('このToDoを削除してもよろしいですか？');
    
    if (isConfirmed) {
      try {
        await this.deleteTodo(todoId);
      } catch (error) {
      }
    }
  }

  async confirmDeleteIssue() {
    if (!this.projectId || !this.issueId) return;

    if (confirm('この課題を削除してもよろしいですか？\n※この課題に関連するToDoもすべて削除されます。')) {
      try {
        // 関連するTodoを削除（サブコレクションから削除）
        const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
        const todosSnapshot = await getDocs(todosRef);
        const deleteTodoPromises = todosSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteTodoPromises);

        // 課題を削除
        const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
        await deleteDoc(issueRef);

        // プロジェクト詳細画面に戻る
        this.router.navigate(['/projects', this.projectId]);
      } catch (error) {
        this.error = '課題の削除に失敗しました。';
      }
    }
  }

  isOverdue(date: Timestamp | string | null | undefined): boolean {
    if (!date) return false;
    let d: Date;
    if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Timestamp) {
      d = date.toDate();
    } else {
      return false;
    }
    return d.getTime() < Date.now();
  }
}