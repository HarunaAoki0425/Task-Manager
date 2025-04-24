import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Issue, Todo } from '../../../../models/project.model';
import { IssueService } from '../../../../services/issue.service';
import { UserService } from '../../../../services/user.service';
import { TodoCreateComponent } from '../todo-create/todo-create.component';
import { TodoDetailComponent } from '../todo-detail/todo-detail.component';
import { AuthService } from '../../../../services/auth.service';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-issue-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TodoCreateComponent,
    TodoDetailComponent
  ],
  templateUrl: './issue-detail.component.html',
  styleUrls: ['./issue-detail.component.css']
})
export class IssueDetailComponent implements OnInit {
  issue: Issue | null = null;
  editingIssue: Issue | null = null;
  isEditMode = false;
  loading = false;
  error: string | null = null;
  projectId: string = '';
  projectMembers: ProjectMember[] = [];
  minDate: string;
  isAddingComment = false;
  newComment = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private issueService: IssueService,
    private authService: AuthService
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
      this.issue = {
        ...issueData,
        comment: issueData.comment || '',
        todos: issueData.todos || []
      };
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
      this.editingIssue = {
        ...this.issue,
        dueDate: new Date(this.issue.dueDate),
        todos: [...this.issue.todos],
        comment: this.issue.comment || ''
      };
      this.isEditMode = true;
    }
  }

  cancelEdit(): void {
    this.isEditMode = false;
    if (this.issue) {
      this.editingIssue = { ...this.issue };
    }
  }

  isFormValid(): boolean {
    return !!(
      this.editingIssue?.title &&
      this.editingIssue.assignedTo &&
      this.editingIssue.dueDate &&
      (!this.editingIssue.todos || this.editingIssue.todos.every(todo => todo.title.trim()))
    );
  }

  async saveChanges() {
    if (!this.isFormValid() || !this.editingIssue || !this.issue) return;

    try {
      const updatedIssue = {
        ...this.editingIssue,
        dueDate: new Date(this.editingIssue.dueDate),
        comment: this.editingIssue.comment || '',
        todos: this.editingIssue.todos || []
      };

      await this.issueService.updateIssue(this.issue.id, updatedIssue);
      
      // 更新後の課題を再取得
      await this.loadIssue(this.issue.id);
      this.isEditMode = false;
      this.editingIssue = null;
    } catch (error) {
      console.error('課題の更新に失敗しました:', error);
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

  async addComment() {
    if (!this.issue || !this.newComment.trim()) return;

    try {
      const updatedIssue = {
        ...this.issue,
        id: this.issue.id,
        projectId: this.issue.projectId,
        title: this.issue.title,
        solution: this.issue.solution,
        status: this.issue.status,
        priority: this.issue.priority,
        assignedTo: this.issue.assignedTo,
        dueDate: this.issue.dueDate,
        tags: this.issue.tags,
        todos: this.issue.todos,
        createdBy: this.issue.createdBy,
        createdAt: this.issue.createdAt,
        comment: this.newComment.trim()
      };

      await this.issueService.updateIssue(this.issue.id, updatedIssue);
      
      // 更新後の課題を再取得
      await this.loadIssue(this.issue.id);
      this.isAddingComment = false;
      this.newComment = '';
    } catch (error) {
      console.error('コメントの追加に失敗しました:', error);
      this.error = 'コメントの追加に失敗しました。';
    }
  }

  cancelAddComment() {
    this.isAddingComment = false;
    this.newComment = '';
  }
} 