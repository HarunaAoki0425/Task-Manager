import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, getDocs, updateDoc, Timestamp, addDoc, deleteDoc } from '@angular/fire/firestore';
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
  project: { title: string } | null = null;  // プロジェクト情報を保持
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
  newTodo = {
    title: '',
    assignee: '',
    dueDate: null as string | null
  };

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
      console.error('Error toggling todo:', error);
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
        console.error('Project not found');
        return;
      }

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
      this.error = 'Todoの読み込みに失敗しました。';
    }
  }

  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member ? member.displayName : 'Unknown';
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
    if (!this.projectId || !this.issueId || !this.issue || !this.project || !this.newTodo.title) return;

    try {
      const now = Timestamp.now();
      const todoData: Omit<Todo, 'id'> = {
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: this.newTodo.dueDate ? Timestamp.fromDate(new Date(this.newTodo.dueDate)) : null,
        completed: false,
        completedAt: null,
        projectId: this.projectId,
        projectTitle: this.project.title,  // プロジェクトのタイトルを正しく設定
        issueId: this.issueId,
        issueTitle: this.issue.title,      // 課題のタイトルを設定
        createdAt: now,
        updatedAt: now
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

      // フォームをリセット
      this.newTodo = {
        title: '',
        assignee: '',
        dueDate: null
      };
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
    if (!this.projectId || !this.issueId) {
      this.error = 'プロジェクトIDまたは課題IDが見つかりません。';
      return;
    }

    try {
      const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
      const now = Timestamp.now();

      const updatedIssue = {
        title: this.editingIssue.title,
        startDate: this.convertToTimestamp(this.editingIssue.startDate),
        dueDate: this.convertToTimestamp(this.editingIssue.dueDate),
        assignee: this.editingIssue.assignee,
        priority: this.editingIssue.priority,
        memo: this.editingIssue.memo,
        updatedAt: now
      };

      await updateDoc(issueRef, updatedIssue);

      // 成功したら、issue オブジェクトを更新
      if (this.issue) {
        Object.assign(this.issue, {
          ...updatedIssue,
          id: this.issueId
        });
      }

      this.isPopupVisible = false;
      this.error = null;
    } catch (error) {
      console.error('Error updating issue:', error);
      this.error = '課題の更新に失敗しました。';
    }
  }

  async deleteTodo(todoId: string) {
    if (!this.projectId || !this.issueId) return;

    try {
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${todoId}`);
      await deleteDoc(todoRef);
      this.todos = this.todos.filter(todo => todo.id !== todoId);
    } catch (error) {
      console.error('Error deleting todo:', error);
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
        console.error('ToDo削除中にエラーが発生しました:', error);
      }
    }
  }
}
