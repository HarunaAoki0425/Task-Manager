import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Issue, Todo, ProjectMember } from '../../../../models/project.model';
import { IssueService } from '../../../../services/issue.service';
import { ProjectService } from '../../../../services/project.service';
import { TodoCreateComponent } from '../todo-create/todo-create.component';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule, TodoCreateComponent],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent implements OnInit {
  projectId: string = '';
  minDate: string;
  projectMembers: ProjectMember[] = [];
  errorMessage: string | null = null;
  isSubmitting = false;

  newIssue: Issue = {
    id: '',
    projectId: '',
    title: '',
    description: '',
    solution: '',
    status: 'not_started',
    priority: 'medium',
    assignedTo: '',
    dueDate: new Date(),
    tags: [],
    todos: [],
    createdBy: '',
    createdAt: new Date(),
    comment: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private issueService: IssueService,
    private projectService: ProjectService,
    private auth: Auth
  ) {
    // 今日の日付を最小値として設定
    const today = new Date();
    this.minDate = today.toISOString().slice(0, 16);
  }

  async ngOnInit() {
    this.projectId = this.route.snapshot.params['projectId'];
    this.newIssue.projectId = this.projectId;

    // 現在のユーザー情報を設定
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      this.newIssue.createdBy = currentUser.uid;
      this.newIssue.assignedTo = currentUser.uid;
    }

    // プロジェクトメンバー情報を取得
    try {
      const project = await this.projectService.getProject(this.projectId);
      if (project && project.members) {
        const memberPromises = project.members.map(async (memberId: string) => {
          const member = await this.projectService.getProjectMember(memberId);
          if (member) {
            return member;
          }
          return {
            uid: memberId,
            displayName: 'Unknown User',
            email: '',
            photoURL: null
          } as ProjectMember;
        });
        this.projectMembers = await Promise.all(memberPromises);
      }
    } catch (error) {
      console.error('プロジェクトメンバーの取得に失敗しました:', error);
    }
  }

  isFormValid(): boolean {
    const title = this.newIssue.title.trim() !== '';
    const dueDate = this.newIssue.dueDate ? true : false;
    const assignedTo = this.newIssue.assignedTo ? true : false;
    
    console.log('Form validation:', {
      title: this.newIssue.title,
      titleValid: title,
      dueDate: this.newIssue.dueDate,
      dueDateValid: dueDate,
      assignedTo: this.newIssue.assignedTo,
      assignedToValid: assignedTo
    });
    
    return title && dueDate && assignedTo;
  }

  async createIssue() {
    if (this.isSubmitting) return;

    try {
      this.isSubmitting = true;
      this.errorMessage = null;

      // 送信用のデータを作成
      const issueData: Partial<Issue> = {
        title: this.newIssue.title,
        description: this.newIssue.solution || '', // solution を description として使用
        solution: this.newIssue.solution || '',
        status: 'not_started',
        priority: this.newIssue.priority,
        assignedTo: this.newIssue.assignedTo,
        dueDate: new Date(this.newIssue.dueDate),
        tags: [],
        todos: this.newIssue.todos || [],
        createdBy: this.auth.currentUser?.uid || '',
        createdAt: new Date(),
        comment: ''
      };

      console.log('Submitting issue data:', issueData);
      await this.issueService.createIssue(this.projectId, issueData);
      
      // プロジェクト詳細画面に遷移（絶対パスを使用）
      this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('課題の作成に失敗しました:', error);
      this.errorMessage = error instanceof Error ? error.message : '課題の作成に失敗しました';
    } finally {
      this.isSubmitting = false;
    }
  }
} 