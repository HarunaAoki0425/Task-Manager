import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Project } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { IssueListComponent } from './issue-list/issue-list.component';
import { ProjectMember } from '../../../models/project.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, IssueListComponent],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css']
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  loading = true;
  error: string | null = null;
  creatorName: string = '';
  projectMembers: any[] = [];

  constructor(
    private projectService: ProjectService,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.loadProject(projectId);
    }
  }

  async loadProject(projectId: string): Promise<void> {
    try {
      this.project = await this.projectService.getProject(projectId);
      await this.loadProjectMembers();
      
      if (this.project?.userId) {
        const creator = await this.userService.getUser(this.project.userId);
        this.creatorName = creator?.displayName || 'Unknown';
      }
    } catch (error) {
      console.error('Failed to load project or user:', error);
      this.error = 'プロジェクトまたはユーザー情報の読み込みに失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  async loadProjectMembers(): Promise<void> {
    if (!this.project) return;
    
    try {
      const memberPromises = this.project.members.map(async (member) => {
        if (typeof member === 'string') {
          const user = await this.userService.getUser(member);
          return {
            uid: member,
            displayName: user?.displayName || 'Unknown User'
          };
        }
        return member;
      });

      this.projectMembers = await Promise.all(memberPromises);
    } catch (error) {
      console.error('Failed to load project members:', error);
    }
  }

  async editProject(): Promise<void> {
    if (this.project?.id) {
      await this.router.navigate(['/projects', this.project.id, 'edit']);
    }
  }

  async deleteProject(): Promise<void> {
    if (!this.project?.id || !confirm('このプロジェクトを削除してもよろしいですか？')) {
      return;
    }

    try {
      await this.projectService.deleteProject(this.project.id);
      await this.router.navigate(['/projects']);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  async getMemberName(uid: ProjectMember | string): Promise<string> {
    if (typeof uid === 'string') {
      const user = await this.userService.getUser(uid);
      return user?.displayName || '未設定';
    } else {
      return uid.displayName || '未設定';
    }
  }
} 