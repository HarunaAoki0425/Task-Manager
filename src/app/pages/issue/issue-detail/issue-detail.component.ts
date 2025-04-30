import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, getDocs, updateDoc, Timestamp, addDoc } from '@angular/fire/firestore';
import { User } from '../../../models/user.model';
import { Todo } from '../../../models/todo.model';
import { FormsModule } from '@angular/forms';

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

  // 新しいTodo用のプロパティ
  newTodoTitle = '';
  newTodoDueDate = '';
  newTodoAssignee = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.projectId = params.get('projectId');
      this.issueId = params.get('issueId');
      
      if (this.projectId && this.issueId) {
        this.loadIssue();
      } else {
        this.error = '課題が見つかりませんでした。';
        this.isLoading = false;
      }
    });
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
        await this.loadMemberDetails();
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

  // メンバー情報を取得
  async loadMemberDetails() {
    if (!this.issue) return;

    try {
      // issueの担当者情報を取得
      if (this.issue.assignee) {
        const userRef = doc(this.firestore, `users/${this.issue.assignee}`);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          this.memberDetails.push({
            uid: this.issue.assignee,
            displayName: userData.displayName,
            email: userData.email
          });
        }
      }

      // Todoの担当者情報を取得
      for (const todo of this.todos) {
        if (todo.assignee && !this.memberDetails.find(m => m.uid === todo.assignee)) {
          const userRef = doc(this.firestore, `users/${todo.assignee}`);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            this.memberDetails.push({
              uid: todo.assignee,
              displayName: userData.displayName,
              email: userData.email
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading member details:', error);
    }
  }

  // ユーザーIDからdisplayNameを取得
  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member ? member.displayName : uid;
  }

  // 日付をフォーマット
  formatDate(timestamp: Timestamp | null): string {
    if (!timestamp) return '未設定';
    return timestamp.toDate().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '未設定';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return '未対応';
      case 'in_progress': return '対応中';
      case 'resolved': return '解決済み';
      case 'closed': return '完了';
      default: return '未設定';
    }
  }

  // 新しいTodoを追加
  async addTodo() {
    if (!this.projectId || !this.issueId || !this.newTodoTitle || !this.newTodoAssignee) return;

    try {
      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const now = Timestamp.now();
      const newTodo = {
        title: this.newTodoTitle,
        assignee: this.newTodoAssignee,
        dueDate: this.newTodoDueDate ? Timestamp.fromDate(new Date(this.newTodoDueDate)) : null,
        completed: false,
        createdAt: now,
        updatedAt: now
      };

      await addDoc(todosRef, newTodo);

      // フォームをリセット
      this.newTodoTitle = '';
      this.newTodoDueDate = '';
      this.newTodoAssignee = '';

      // Todoリストを再読み込み
      await this.loadTodos();
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  }
}
