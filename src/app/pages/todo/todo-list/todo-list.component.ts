import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  collectionGroup
} from '@angular/fire/firestore';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';
import { Project } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo-list.component.html',
  styleUrls: ['./todo-list.component.css']
})
export class TodoListComponent implements OnInit {
  todos: Todo[] = [];
  projects: Project[] = [];
  members: User[] = [];
  isLoading = true;
  error: string | null = null;

  // フィルター用の状態
  selectedProject = '';
  selectedMember = '';
  selectedStatus = 'incomplete';
  selectedSort = 'dueDate';

  constructor(
    private firestore: Firestore,
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    // 認証状態を確認
    const user = await this.authService.getCurrentUser();
    if (!user) {
      // 未認証の場合はログインページにリダイレクト
      this.router.navigate(['/login']);
      return;
    }

    await this.loadAllData();
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
        const issuesRef = collection(this.firestore, `projects/${project.id}/issues`);
        const issuesSnap = await getDocs(issuesRef);

        for (const issueDoc of issuesSnap.docs) {
          const todosRef = collection(this.firestore, `projects/${project.id}/issues/${issueDoc.id}/todos`);
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
            issueId: issueDoc.id,
            ...doc.data()
          } as Todo));

          allTodos.push(...todos);
        }
      }

      // メモリ上でソート
      this.todos = allTodos.sort((a, b) => {
        if (this.selectedSort === 'dueDate') {
          const dateA = a.dueDate?.toDate() || new Date(0);
          const dateB = b.dueDate?.toDate() || new Date(0);
          return dateA.getTime() - dateB.getTime();
        } else {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
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

  // ToDo完了状態の切り替え
  async toggleTodo(todo: Todo) {
    if (!todo.id || !todo.projectId || !todo.issueId) return;

    try {
      const todoRef = doc(
        this.firestore, 
        `projects/${todo.projectId}/issues/${todo.issueId}/todos/${todo.id}`
      );
      
      await updateDoc(todoRef, {
        completed: !todo.completed,
        updatedAt: Timestamp.now()
      });

      // UIの状態を更新
      todo.completed = !todo.completed;
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
  formatDate(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return '期限なし';
    const date = timestamp.toDate();
    return date.toLocaleDateString('ja-JP');
  }

  // 期限切れかどうかの判定
  isOverdue(timestamp: Timestamp | null | undefined): boolean {
    if (!timestamp) return false;
    return timestamp.toDate() < new Date();
  }
}
