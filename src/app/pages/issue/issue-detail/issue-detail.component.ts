import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, getDocs, updateDoc, Timestamp, addDoc } from '@angular/fire/firestore';
import { User } from '../../../models/user.model';
import { Todo } from '../../../models/todo.model';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';

interface Issue {
  id?: string;
  title: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  assignee: string;
  priority: string;
  memo: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface FirestoreIssueData {
  title: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  assignee: string;
  priority: string;
  memo: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  todos: Todo[] = [];
  memberDetails: User[] = [];
  isLoading = true;
  error: string | null = null;
  isPopupVisible = false;
  editingIssue: {
    title: string;
    startDate: string;
    dueDate: string;
    assignee: string;
    priority: string;
    memo: string;
  } = {
    title: '',
    startDate: '',
    dueDate: '',
    assignee: '',
    priority: '',
    memo: ''
  };

  // 新しいTodo用のプロパティ
  newTodoTitle = '';
  newTodoDueDate = '';
  newTodoAssignee = '';

  // テンプレートで使用するためにTimestampを追加
  Timestamp = Timestamp;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private projectService: ProjectService
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
      console.log('Project ID is missing');
      return;
    }
    try {
      console.log('Loading members for project:', this.projectId);
      this.memberDetails = await this.projectService.getProjectMembers(this.projectId);
      console.log('Loaded members:', this.memberDetails);
    } catch (error) {
      console.error('Error loading project members:', error);
    }
  }

  // Todoの完了状態を切り替え
  async toggleTodo(todo: Todo) {
    if (!this.projectId || !this.issueId || !todo.id) return;

    try {
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${todo.id}`);
      await updateDoc(todoRef, {
        completed: !todo.completed,
        updatedAt: Timestamp.now()
      });
      todo.completed = !todo.completed;
    } catch (error) {
      console.error('Error toggling todo:', error);
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
      this.isLoading = true;
      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      const issueSnap = await getDoc(issueRef);
      
      if (issueSnap.exists()) {
        const data = issueSnap.data() as FirestoreIssueData;
        this.issue = {
          id: issueSnap.id,
          title: data.title,
          startDate: data.startDate,
          dueDate: data.dueDate,
          assignee: data.assignee,
          priority: data.priority,
          memo: data.memo,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as Issue;
        await this.loadTodos();
      } else {
        this.error = '課題が見つかりませんでした。';
      }
    } catch (error) {
      console.error('Error loading issue:', error);
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
      console.error('Error loading todos:', error);
    }
  }

  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member ? member.displayName : 'Unknown';
  }

  formatDate(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('ja-JP');
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
    if (!this.projectId || !this.issueId || !this.newTodoTitle || !this.newTodoAssignee) return;

    try {
      // プロジェクト情報を取得
      const projectRef = doc(this.firestore, `projects/${this.projectId}`);
      const projectSnap = await getDoc(projectRef);
      const projectTitle = projectSnap.exists() ? projectSnap.data()['title'] || '' : '';

      const now = Timestamp.now();
      const dueDate = this.newTodoDueDate ? Timestamp.fromDate(new Date(this.newTodoDueDate)) : null;
      
      const todoData: Omit<Todo, 'id'> = {
        title: this.newTodoTitle,
        assignee: this.newTodoAssignee,
        dueDate: dueDate,
        completed: false,
        projectId: this.projectId,
        projectTitle: projectTitle,
        issueId: this.issueId,
        issueTitle: this.issue?.title || '',
        createdAt: now,
        updatedAt: now
      };

      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const todoRef = await addDoc(todosRef, todoData);

      // UIのTodoリストを更新
      const newTodo: Todo = {
        id: todoRef.id,
        ...todoData
      };
      this.todos.push(newTodo);

      // フォームをリセット
      this.newTodoTitle = '';
      this.newTodoDueDate = '';
      this.newTodoAssignee = '';
    } catch (error) {
      console.error('Error adding todo:', error);
      this.error = 'Todoの追加に失敗しました。';
    }
  }

  // ポップアップの表示/非表示を切り替え
  togglePopup() {
    this.isPopupVisible = !this.isPopupVisible;
    if (this.isPopupVisible && this.issue) {
      // ポップアップを開く時に現在の値をフォームに設定
      this.editingIssue = {
        title: this.issue.title,
        startDate: this.formatDateForInput(this.issue.startDate),
        dueDate: this.formatDateForInput(this.issue.dueDate),
        assignee: this.issue.assignee,
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

  async saveIssue() {
    if (!this.projectId || !this.issueId) return;

    try {
      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      
      const updatedData = {
        title: this.editingIssue.title,
        startDate: this.convertToTimestamp(this.editingIssue.startDate),
        dueDate: this.convertToTimestamp(this.editingIssue.dueDate),
        assignee: this.editingIssue.assignee,
        priority: this.editingIssue.priority,
        memo: this.editingIssue.memo,
        updatedAt: Timestamp.now()
      };

      await updateDoc(issueRef, updatedData);
      
      // 更新後に課題を再読み込み
      await this.loadIssue();
      
      // ポップアップを閉じる
      this.isPopupVisible = false;
    } catch (error) {
      console.error('Error saving issue:', error);
      this.error = '課題の保存に失敗しました。';
    }
  }
}
