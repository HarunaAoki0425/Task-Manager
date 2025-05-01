import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  Firestore, 
  Timestamp, 
  collection,
  query, 
  getDocs,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  collectionGroup,
  setDoc,
  deleteDoc
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';
import { Project } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { TodoService } from '../../../services/todo.service';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './todo-list.component.html',
  styleUrls: ['./todo-list.component.css']
})
export class TodoListComponent implements OnInit, OnDestroy {
  todos: Todo[] = [];
  projects: Project[] = [];
  members: User[] = [];
  isLoading = true;
  error: string | null = null;
  private unsubscribeAuth?: Unsubscribe;

  // フィルター用の状態
  selectedProject = '';
  selectedMember = '';
  selectedStatus = 'incomplete';
  selectedSort = 'dueDate';

  constructor(
    private firestore: Firestore,
    private projectService: ProjectService,
    private authService: AuthService,
    private todoService: TodoService,
    private router: Router,
    private auth: Auth
  ) {}

  ngOnInit() {
    // 認証状態の変更を監視
    this.unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        // 認証済みの場合はデータを読み込む
        this.loadAllData();
      } else {
        // 未認証の場合はログインページにリダイレクト
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy() {
    // コンポーネントの破棄時に購読を解除
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
  }

  async loadAllData() {
    try {
      this.isLoading = true;
      this.error = null;

      // プロジェクト一覧を取得
      await this.loadProjects();

      // メンバー一覧を取得（全プロジェクトのメンバーを統合）
      const memberIds = new Set<string>();
      this.projects.forEach(project => {
        project.members.forEach(memberId => memberIds.add(memberId));
      });
      
      const memberPromises = Array.from(memberIds).map(async (memberId) => {
        const userDoc = await getDoc(doc(this.firestore, 'users', memberId));
        if (userDoc.exists()) {
          return { uid: userDoc.id, ...userDoc.data() } as User;
        }
        return null;
      });
      
      const members = await Promise.all(memberPromises);
      this.members = members.filter((member): member is User => member !== null);

      // Todoを取得
      await this.loadTodos();

    } catch (error) {
      console.error('Error loading data:', error);
      this.error = 'データの読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  async loadProjects() {
    const userProjects = await this.projectService.getUserProjects();
    this.projects = userProjects;
  }

  async loadTodos() {
    try {
      const allTodos: Todo[] = [];

      // 選択されたプロジェクトがある場合は、そのプロジェクトのTodoのみを取得
      const projectsToQuery = this.selectedProject
        ? [this.projects.find(p => p.id === this.selectedProject)].filter((p): p is Project => p !== undefined)
        : this.projects;

      // 各プロジェクトのTodoを取得
      for (const project of projectsToQuery) {
        const collectionPath = project.isArchived ? 'archives' : 'projects';
        const issuesRef = collection(this.firestore, `${collectionPath}/${project.id}/issues`);
        const issuesSnap = await getDocs(issuesRef);

        for (const issueDoc of issuesSnap.docs) {
          const issueData = issueDoc.data();
          const todosRef = collection(this.firestore, `${collectionPath}/${project.id}/issues/${issueDoc.id}/todos`);
          let todosQuery = query(todosRef);

          // フィルター条件を追加（インデックスが必要ない順序で追加）
          if (this.selectedStatus !== 'all') {
            todosQuery = query(todosQuery, where('completed', '==', this.selectedStatus === 'completed'));
          }
          
          if (this.selectedMember) {
            todosQuery = query(todosQuery, where('assignee', '==', this.selectedMember));
          }

          const todosSnap = await getDocs(todosQuery);
          const todos = todosSnap.docs.map(doc => ({
            id: doc.id,
            projectId: project.id,
            projectTitle: project.title,
            issueId: issueDoc.id,
            issueTitle: issueData['title'] || '',
            isArchived: project.isArchived,
            ...doc.data()
          } as Todo));

          allTodos.push(...todos);
        }
      }

      // 完了済みTodoも取得（アーカイブされていないものも含む）
      if (this.selectedStatus === 'completed' || this.selectedStatus === 'all') {
        const completedTodos = await this.todoService.getCompletedTodos();
        // 既に取得済みのTodoと重複しないように、IDで重複チェック
        const existingTodoIds = new Set(allTodos.map(todo => todo.id!));
        const newCompletedTodos = completedTodos.filter(todo => !existingTodoIds.has(todo.id!));
        allTodos.push(...newCompletedTodos);
      }

      // メモリ上でソート
      this.todos = allTodos.sort((a, b) => {
        if (this.selectedSort === 'dueDate') {
          let dateA: Date;
          let dateB: Date;
          
          if (a.dueDate instanceof Timestamp) {
            dateA = a.dueDate.toDate();
          } else if (typeof a.dueDate === 'string') {
            dateA = new Date(a.dueDate);
          } else {
            dateA = new Date(0);
          }

          if (b.dueDate instanceof Timestamp) {
            dateB = b.dueDate.toDate();
          } else if (typeof b.dueDate === 'string') {
            dateB = new Date(b.dueDate);
          } else {
            dateB = new Date(0);
          }

          return dateA.getTime() - dateB.getTime();
        } else {
          const dateA = a.createdAt.toDate();
          const dateB = b.createdAt.toDate();
          return dateA.getTime() - dateB.getTime();
        }
      });

    } catch (error) {
      console.error('Error loading todos:', error);
      this.error = 'Todoの読み込みに失敗しました。';
    }
  }

  // フィルター変更時の処理
  async onFilterChange() {
    await this.loadTodos();
  }

  // Todo完了状態の切り替え
  async toggleTodoComplete(todo: Todo) {
    if (!todo.id || !todo.projectId || !todo.issueId) return;

    try {
      const todoRef = doc(
        this.firestore, 
        `${todo.isArchived ? 'archives' : 'projects'}/${todo.projectId}/issues/${todo.issueId}/todos/${todo.id}`
      );
      
      const now = Timestamp.now();
      const newCompleted = !todo.completed;

      await updateDoc(todoRef, {
        completed: newCompleted,
        completedAt: newCompleted ? now : null,
        updatedAt: now
      });

      // UIを更新
      todo.completed = newCompleted;
      todo.completedAt = newCompleted ? now : null;
      todo.updatedAt = now;

      // フィルターが適用されている場合は再読み込み
      if (this.selectedStatus !== 'all') {
        await this.loadTodos();
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
      this.error = 'Todoの更新に失敗しました。';
    }
  }

  // メンバー名の取得
  getMemberName(uid: string): string {
    const member = this.members.find(m => m.uid === uid);
    return member ? member.displayName : '未割り当て';
  }

  // 期限日の表示フォーマット
  formatDate(date: Timestamp | string | null | undefined): string {
    if (!date) return '期限なし';
    
    let dateObj: Date;
    if (date instanceof Timestamp) {
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return '期限なし';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    // 時刻部分のフォーマット
    const timeStr = dateObj.toLocaleTimeString('ja-JP', { 
      hour: '2-digit',
      minute: '2-digit'
    });

    // 日付が今日の場合
    if (dateOnly.getTime() === today.getTime()) {
      return `今日 ${timeStr}`;
    }
    // 日付が明日の場合
    if (dateOnly.getTime() === tomorrow.getTime()) {
      return `明日 ${timeStr}`;
    }

    // それ以外の場合
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ` ${timeStr}`;
  }

  // 期限切れかどうかの判定
  isOverdue(date: Timestamp | string | null | undefined): boolean {
    if (!date) return false;
    
    const now = new Date();
    if (date instanceof Timestamp) {
      return date.toDate() < now;
    } else if (typeof date === 'string') {
      return new Date(date) < now;
    }
    
    return false;
  }

  async confirmDeleteTodo(todo: Todo) {
    if (confirm('このTodoを削除してもよろしいですか？')) {
      try {
        await this.todoService.deleteTodo(todo.id!, todo.projectId, todo.issueId, todo.isArchived);
        this.todos = this.todos.filter(t => t.id !== todo.id);
      } catch (error) {
        console.error('Error deleting todo:', error);
        this.error = 'Todoの削除に失敗しました。';
      }
    }
  }
}
