import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  showCreateModal = false;
  newProject: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
    title: '',
    description: '',
    status: 'not_started' as const,
    dueDate: new Date(),
    members: [], // ProjectServiceで自動的に設定される
    userId: ''  // ProjectServiceで自動的に設定される
  };
  isLoading = false;
  errorMessage = '';

  constructor(private projectService: ProjectService) {}

  ngOnInit() {
    this.loadProjects();
  }

  async loadProjects() {
    try {
      this.isLoading = true;
      this.projects = await this.projectService.getProjects();
      console.log('Loaded projects:', JSON.stringify(this.projects, null, 2));
    } catch (error) {
      console.error('プロジェクトの読み込みに失敗しました:', error);
      this.errorMessage = 'プロジェクトの読み込みに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  async createProject() {
    try {
      await this.projectService.createProject(this.newProject);
      this.showCreateModal = false;
      this.newProject = {
        title: '',
        description: '',
        status: 'not_started' as const,
        dueDate: new Date(),
        members: [], // ProjectServiceで自動的に設定される
        userId: ''  // ProjectServiceで自動的に設定される
      };
      await this.loadProjects();
    } catch (error) {
      console.error('プロジェクトの作成に失敗しました:', error);
    }
  }
} 