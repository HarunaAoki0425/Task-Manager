import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Issue } from '../../../../models/project.model';
import { IssueService } from '../../../../services/issue.service';
import { AuthService } from '../../../../services/auth.service';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent implements OnInit {
  projectId: string = '';
  projectMembers: ProjectMember[] = [];
  loading = false;
  error: string | null = null;
  minDate: string;

  newIssue: Partial<Issue> = {
    title: '',
    priority: 'medium',
    status: 'not_started',
    assignedTo: '',
    dueDate: new Date(),
    solution: '',
    tags: [],
    todos: []
  };

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
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    if (this.projectId) {
      this.loadProjectMembers();
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.newIssue = {
          ...this.newIssue,
          createdBy: currentUser.uid,
          createdAt: new Date()
        };
      }
    } else {
      this.error = 'プロジェクトIDが見つかりません。';
    }
  }

  async loadProjectMembers(): Promise<void> {
    try {
      const members = await this.issueService.getProjectMembers(this.projectId);
      this.projectMembers = members || [];
    } catch (error) {
      console.error('Failed to load project members:', error);
      this.error = 'メンバー情報の読み込みに失敗しました。';
    }
  }

  addTodo(): void {
    if (!this.newIssue.todos) {
      this.newIssue.todos = [];
    }
    this.newIssue.todos.push({
      id: Date.now().toString(),
      title: '',
      completed: false,
      createdAt: new Date()
    });
  }

  removeTodo(index: number): void {
    if (this.newIssue.todos) {
      this.newIssue.todos.splice(index, 1);
    }
  }

  isFormValid(): boolean {
    return !!(
      this.newIssue.title &&
      this.newIssue.assignedTo &&
      this.newIssue.dueDate &&
      (!this.newIssue.todos || this.newIssue.todos.every(todo => todo.title.trim()))
    );
  }

  async createIssue(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    try {
      this.loading = true;
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('ユーザーが認証されていません。');
      }

      const createdIssue = await this.issueService.createIssue(
        this.projectId,
        {
          ...this.newIssue,
          createdBy: currentUser.uid,
          createdAt: new Date(),
          projectId: this.projectId
        } as Issue
      );

      await this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('Failed to create issue:', error);
      this.error = '課題の作成に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  getMemberName(uid: string): string {
    const member = this.projectMembers.find(m => m.uid === uid);
    return member?.displayName || '未割り当て';
  }
} 