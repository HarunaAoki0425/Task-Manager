import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Auth } from '@angular/fire/auth';

interface ProjectCreate {
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  dueDate: Date;
  members: string[];
  userId: string;
}

@Component({
  selector: 'app-create-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-project.component.html',
  styleUrls: ['./create-project.component.css']
})
export class CreateProjectComponent implements OnInit {
  project = {
    title: '',
    description: '',
    status: 'not_started' as const,
    dueDate: new Date(),
    members: [] as string[],
    userId: ''
  };

  isSubmitting = false;
  errorMessage = '';
  minDate: string;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private auth: Auth
  ) {
    // ユーザーIDを設定
    const user = this.auth.currentUser;
    if (user) {
      this.project.userId = user.uid;
    }

    // 最小日付を今日に設定
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
    this.project.dueDate = today;
  }

  ngOnInit(): void {
    // 初期値として今日の日付を設定
    const today = new Date();
    this.project.dueDate = today;
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting) return;

    try {
      this.isSubmitting = true;
      this.errorMessage = '';

      // 日付が文字列で来る場合に備えてDate型に変換
      if (typeof this.project.dueDate === 'string') {
        this.project.dueDate = new Date(this.project.dueDate);
      }

      await this.projectService.createProject(this.project);
      
      // 成功したら一覧画面に遷移
      this.router.navigate(['/projects']);
    } catch (error) {
      console.error('プロジェクト作成中にエラーが発生しました:', error);
      this.errorMessage = 'プロジェクトの作成に失敗しました。もう一度お試しください。';
    } finally {
      this.isSubmitting = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/projects']);
  }
} 