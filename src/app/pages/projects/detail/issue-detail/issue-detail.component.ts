import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Issue, Todo } from '../../../../models/project.model';
import { IssueService } from '../../../../services/issue.service';
import { UserService } from '../../../../services/user.service';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './issue-detail.component.html',
  styleUrls: ['./issue-detail.component.css']
})
export class IssueDetailComponent implements OnInit {
  issue: Issue | null = null;
  projectMembers: ProjectMember[] = [];
  loading = true;
  error: string | null = null;
  isEditMode = false;
  editingIssue: Partial<Issue> | null = null;
  minDate: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private issueService: IssueService,
    private userService: UserService
  ) {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    const issueId = this.route.snapshot.paramMap.get('issueId');
    if (issueId) {
      this.loadIssue(issueId);
    } else {
      this.error = '課題IDが見つかりません。';
      this.loading = false;
    }
  }

  async loadIssue(issueId: string): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      // 課題データの取得
      const issueData = await this.issueService.getIssue(issueId);
      if (!issueData) {
        throw new Error('課題が見つかりません。');
      }

      // プロジェクトメンバーの取得
      const members = await this.issueService.getProjectMembers(issueData.projectId);
      
      // データの設定
      this.issue = issueData;
      this.projectMembers = members || [];
      
    } catch (error) {
      console.error('Failed to load issue:', error);
      this.error = error instanceof Error ? error.message : '課題の読み込みに失敗しました。';
      this.issue = null;
    } finally {
      this.loading = false;
    }
  }

  enterEditMode(): void {
    if (this.issue) {
      this.editingIssue = { ...this.issue };
      this.isEditMode = true;
    }
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.editingIssue = null;
  }

  addTodo(): void {
    if (!this.editingIssue?.todos) {
      if (this.editingIssue) {
        this.editingIssue.todos = [];
      }
    }
    this.editingIssue?.todos?.push({
      id: Date.now().toString(),
      title: '',
      completed: false,
      createdAt: new Date()
    });
  }

  removeTodo(index: number): void {
    this.editingIssue?.todos?.splice(index, 1);
  }

  isFormValid(): boolean {
    return !!(
      this.editingIssue?.title &&
      this.editingIssue?.assignedTo &&
      this.editingIssue?.dueDate &&
      (!this.editingIssue?.todos || this.editingIssue.todos.every(todo => todo.title.trim()))
    );
  }

  async saveChanges(): Promise<void> {
    if (!this.isFormValid() || !this.editingIssue || !this.issue) {
      return;
    }

    try {
      await this.issueService.updateIssue(this.issue.id, this.editingIssue);
      await this.loadIssue(this.issue.id);
      this.isEditMode = false;
      this.editingIssue = null;
    } catch (error) {
      console.error('Failed to update issue:', error);
      this.error = '課題の更新に失敗しました。';
    }
  }

  async updateIssueStatus(newStatus: 'not_started' | 'in_progress' | 'completed'): Promise<void> {
    if (!this.issue) return;

    try {
      await this.issueService.updateIssue(this.issue.id, { status: newStatus });
      await this.loadIssue(this.issue.id);
    } catch (error) {
      console.error('Failed to update issue status:', error);
      this.error = '課題のステータス更新に失敗しました。';
    }
  }

  async deleteIssue(): Promise<void> {
    if (!this.issue || !confirm('この課題を削除してもよろしいですか？')) {
      return;
    }

    try {
      await this.issueService.deleteIssue(this.issue.id);
      await this.router.navigate(['/projects', this.issue.projectId]);
    } catch (error) {
      console.error('Failed to delete issue:', error);
      this.error = '課題の削除に失敗しました。';
    }
  }

  getMemberName(uid: string | undefined): string {
    if (!uid) return '未割り当て';
    const member = this.projectMembers.find(m => m.uid === uid);
    return member?.displayName || '未割り当て';
  }

  getStatusText(status: string | undefined | null): string {
    if (!status) return '';
    switch (status) {
      case 'not_started': return '未着手';
      case 'in_progress': return '進行中';
      case 'completed': return '完了';
      default: return status;
    }
  }

  getPriorityText(priority: string | undefined | null): string {
    if (!priority) return '';
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  }

  getTodoProgress(): number {
    if (!this.issue?.todos || this.issue.todos.length === 0) {
      return 0;
    }
    const completedCount = this.getCompletedTodos();
    return (completedCount / this.issue.todos.length) * 100;
  }

  getCompletedTodos(): number {
    if (!this.issue?.todos) {
      return 0;
    }
    return this.issue.todos.filter(todo => todo.completed).length;
  }
} 