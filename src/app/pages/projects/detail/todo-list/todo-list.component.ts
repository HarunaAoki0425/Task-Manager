import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../../../services/project.service';
import { Project, Todo, ProjectMember } from '../../../../models/project.model';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Router } from '@angular/router';

interface TodoWithContext extends Todo {
  projectId: string;
  issueId: string;
}

@Component({
  selector: 'app-todo-list',
  templateUrl: './todo-list.component.html',
  styleUrls: ['./todo-list.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class TodoListComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  sortedTodos: TodoWithContext[] = [];
  loading = true;
  error: string | null = null;
  private unsubscribe: (() => void) | undefined;

  constructor(
    private projectService: ProjectService,
    private auth: Auth,
    private router: Router
  ) {}

  ngOnInit() {
    // Firebase Authの監視を設定
    this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.loadTodos();
      } else {
        this.error = 'ログインが必要です。';
        this.loading = false;
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy() {
    // 監視を解除
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private async loadTodos() {
    try {
      this.loading = true;
      this.error = null;
      this.projects = await this.projectService.getProjects();
      console.log('取得したプロジェクト:', this.projects);
      
      this.extractTodosFromProjects();
      console.log('抽出したTodo:', this.sortedTodos);
      
      this.sortTodos();
      console.log('ソート後のTodo:', this.sortedTodos);
    } catch (error) {
      this.error = 'Todoの読み込みに失敗しました。';
      console.error('Error loading todos:', error);
    } finally {
      this.loading = false;
    }
  }

  private extractTodosFromProjects() {
    this.sortedTodos = this.projects.flatMap(project => {
      console.log(`プロジェクト ${project.title} の課題:`, project.issues);
      return project.issues.flatMap(issue => {
        console.log(`課題 ${issue.title} のTodo:`, issue.todos);
        return (issue.todos || []).map(todo => ({
          ...todo,
          projectId: project.id,
          issueId: issue.id
        }));
      });
    });
  }

  private sortTodos() {
    this.sortedTodos.sort((a, b) => {
      // 期限日でソート（nullは後ろに）
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  getProjectTitle(projectId: string): string {
    const project = this.projects.find(p => p.id === projectId);
    return project?.title || '不明なプロジェクト';
  }

  getIssueTitle(projectId: string, issueId: string): string {
    const project = this.projects.find(p => p.id === projectId);
    const issue = project?.issues.find(i => i.id === issueId);
    return issue?.title || '不明な課題';
  }

  getMemberName(uid: string | undefined): string {
    if (!uid) return '未割り当て';
    
    // プロジェクトからメンバー情報を探す
    for (const project of this.projects) {
      const memberId = project.members.find(m => m === uid);
      if (memberId) {
        return memberId;
      }
    }
    return uid;
  }

  formatDate(date: Date | undefined | null): string {
    if (!date) return '';
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDueDateClass(todo: Todo): string {
    if (!todo.dueDate) return 'text-gray-500';
    
    const today = new Date();
    const dueDate = new Date(todo.dueDate);
    
    // 期限切れ
    if (dueDate < today) return 'text-red-500';
    
    // 3日以内
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);
    if (dueDate <= threeDaysFromNow) return 'text-yellow-500';
    
    return 'text-green-500';
  }

  async onTodoStatusChange(todo: TodoWithContext) {
    try {
      await this.projectService.updateTodoStatus(
        todo.projectId,
        todo.issueId,
        todo.id,
        !todo.completed
      );
      todo.completed = !todo.completed;
    } catch (error) {
      this.error = 'Todoのステータス更新に失敗しました。';
      console.error('Error updating todo status:', error);
    }
  }
} 