import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';

@Component({
  selector: 'app-project-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-edit.component.html',
  styleUrls: ['./project-edit.component.css']
})
export class ProjectEditComponent implements OnInit {
  project: Project | null = null;
  loading = true;
  saving = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.loadProject();
  }

  private async loadProject() {
    try {
      const projectId = this.route.snapshot.paramMap.get('id');
      if (!projectId) {
        this.error = 'プロジェクトIDが指定されていません。';
        return;
      }

      this.project = await this.projectService.getProject(projectId);
      if (!this.project) {
        this.error = 'プロジェクトが見つかりませんでした。';
      }
    } catch (error) {
      console.error('プロジェクトの読み込みに失敗しました:', error);
      this.error = 'プロジェクトの読み込みに失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    if (!this.project?.id) return;

    try {
      this.saving = true;
      await this.projectService.updateProject(this.project.id, {
        title: this.project.title,
        description: this.project.description
      });
      this.router.navigate(['/projects', this.project.id]);
    } catch (error) {
      console.error('プロジェクトの更新に失敗しました:', error);
      this.error = 'プロジェクトの更新に失敗しました。';
    } finally {
      this.saving = false;
    }
  }

  cancel() {
    if (this.project?.id) {
      this.router.navigate(['/projects', this.project.id]);
    } else {
      this.router.navigate(['/projects']);
    }
  }
} 