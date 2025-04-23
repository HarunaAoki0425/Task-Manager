import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Issue } from '../../../../models/project.model';
import { IssueService } from '../../../../services/issue.service';
import { UserService } from '../../../../services/user.service';
import { FilterByStatusPipe } from '../../../../shared/pipes/filter-by-status.pipe';

interface ProjectMember {
  uid: string;
  displayName: string;
}

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FilterByStatusPipe],
  templateUrl: './issue-list.component.html',
  styleUrls: ['./issue-list.component.css']
})
export class IssueListComponent implements OnInit {
  @Input() projectId!: string;
  issues: Issue[] = [];
  projectMembers: ProjectMember[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private issueService: IssueService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadIssues();
    this.loadProjectMembers();
  }

  async loadProjectMembers(): Promise<void> {
    try {
      const members = await this.issueService.getProjectMembers(this.projectId);
      this.projectMembers = members;
    } catch (error) {
      console.error('Failed to load project members:', error);
      this.error = 'メンバー情報の読み込みに失敗しました。';
    }
  }

  async loadIssues(): Promise<void> {
    try {
      this.loading = true;
      this.issues = await this.issueService.getIssuesByProject(this.projectId);
      this.error = null;
    } catch (error) {
      console.error('Failed to load issues:', error);
      this.error = '課題の読み込みに失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  async updateIssueStatus(issue: Issue, newStatus: 'not_started' | 'in_progress' | 'completed'): Promise<void> {
    try {
      await this.issueService.updateIssue(issue.id, { status: newStatus });
      await this.loadIssues();
    } catch (error) {
      console.error('Failed to update issue status:', error);
      this.error = '課題のステータス更新に失敗しました。';
    }
  }

  async deleteIssue(issueId: string): Promise<void> {
    if (!confirm('この課題を削除してもよろしいですか？')) {
      return;
    }

    try {
      await this.issueService.deleteIssue(issueId);
      await this.loadIssues();
    } catch (error) {
      console.error('Failed to delete issue:', error);
      this.error = '課題の削除に失敗しました。';
    }
  }

  getMemberName(assignedTo: string | undefined): string {
    if (!assignedTo) return '未割り当て';
    const member = this.projectMembers.find(m => m.uid === assignedTo);
    return member?.displayName || '未割り当て';
  }
} 