import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  searchText: string = '';
  filteredProjects: Project[] = [];
  filteredIssues: any[] = [];
  filteredTodos: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private projectService: ProjectService,
    private firestore: Firestore
  ) {}

  async logout() {
    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async onSearch() {
    const allProjects = await this.projectService.getUserProjects();
    this.filteredProjects = allProjects.filter(p =>
      p.title && p.title.toLowerCase().includes(this.searchText.toLowerCase())
    );
    // 課題も検索
    let allIssues: any[] = [];
    let allTodos: any[] = [];
    for (const project of allProjects) {
      let issuesRef;
      if (project.isArchived) {
        issuesRef = collection(this.firestore, 'archives', project.id!, 'issues');
      } else {
        issuesRef = collection(this.firestore, 'projects', project.id!, 'issues');
      }
      const issuesSnap = await getDocs(issuesRef);
      const issues = issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), projectId: project.id, isArchived: project.isArchived }));
      allIssues.push(...issues);
      // ToDoも検索
      for (const issue of issues) {
        let todosRef;
        if (project.isArchived) {
          todosRef = collection(this.firestore, 'archives', project.id!, 'issues', issue.id, 'todos');
        } else {
          todosRef = collection(this.firestore, 'projects', project.id!, 'issues', issue.id, 'todos');
        }
        const todosSnap = await getDocs(todosRef);
        allTodos.push(...todosSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), projectId: project.id, issueId: issue.id, isArchived: project.isArchived })));
      }
    }
    this.filteredIssues = allIssues.filter(issue =>
      issue.title && issue.title.toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.filteredTodos = allTodos.filter(todo =>
      todo.title && todo.title.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  closeSearchPopup() {
    this.filteredProjects = [];
    this.filteredIssues = [];
    this.filteredTodos = [];
  }

  goToProjectDetail(project: Project) {
    this.closeSearchPopup();
    if (project.isArchived) {
      this.router.navigate(['/archive', project.id]);
    } else {
      this.router.navigate(['/projects', project.id]);
    }
  }

  goToIssueDetail(issue: any) {
    this.closeSearchPopup();
    if (issue.isArchived) {
      this.router.navigate(['/archive', issue.projectId, 'issues', issue.id]);
    } else {
      this.router.navigate(['/projects', issue.projectId, 'issues', issue.id]);
    }
  }

  goToTodoParentIssue(todo: any) {
    this.closeSearchPopup();
    if (todo.isArchived) {
      this.router.navigate(['/archive', todo.projectId, 'issues', todo.issueId]);
    } else {
      this.router.navigate(['/projects', todo.projectId, 'issues', todo.issueId]);
    }
  }
} 