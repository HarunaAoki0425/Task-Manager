import { Component, OnInit } from '@angular/core';
import { Issue } from '../../models/project.model';
import { IssueService } from '../../services/issue.service';
import { UserService } from '../../services/user.service';

interface EnhancedIssue extends Issue {
  assignedToName?: string;
  createdByName?: string;
}

@Component({
  selector: 'app-archive',
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.scss']
})
export class ArchiveComponent implements OnInit {
  archivedIssues: EnhancedIssue[] = [];
  error: string | null = null;
  loading = true;

  constructor(
    private issueService: IssueService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadArchivedIssues();
  }

  async loadArchivedIssues(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      const issues = await this.issueService.getArchivedIssues();
      
      // Get user details for both assigned and created by users
      const issuesWithUserDetails = await Promise.all(
        issues.map(async (issue) => {
          const enhancedIssue: EnhancedIssue = { ...issue };

          // Get assignee details
          if (issue.assignedTo) {
            const assignedUser = await this.userService.getUser(issue.assignedTo);
            enhancedIssue.assignedToName = assignedUser?.displayName || '未設定';
          } else {
            enhancedIssue.assignedToName = '未割り当て';
          }

          // Get creator details
          if (issue.createdBy) {
            const creator = await this.userService.getUser(issue.createdBy);
            enhancedIssue.createdByName = creator?.displayName || '未設定';
          } else {
            enhancedIssue.createdByName = '未設定';
          }

          return enhancedIssue;
        })
      );

      this.archivedIssues = issuesWithUserDetails;
    } catch (err) {
      console.error('アーカイブされた課題の読み込み中にエラーが発生しました:', err);
      this.error = 'アーカイブされた課題の読み込み中にエラーが発生しました。';
    } finally {
      this.loading = false;
    }
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'not_started': '未着手',
      'in_progress': '進行中',
      'completed': '完了',
      'blocked': 'ブロック中'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace('_', '-');
  }

  getPriorityText(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'low': '低',
      'medium': '中',
      'high': '高',
      'urgent': '緊急'
    };
    return priorityMap[priority] || priority;
  }

  getPriorityClass(priority: string): string {
    return priority.toLowerCase();
  }

  formatDate(date: Date | string | null): string {
    if (!date) return '日付なし';
    const d = new Date(date);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }
} 