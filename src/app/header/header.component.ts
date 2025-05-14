import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { Firestore, collection, getDocs, onSnapshot, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { NotificationComponent } from '../pages/notofication/notification.component';

// Utility functions for normalization (outside the class)
function toHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );
}
function normalize(str: string): string {
  if (!str) return '';
  return toHalfWidth(str).toLowerCase();
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NotificationComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnDestroy {
  searchText: string = '';
  filteredProjects: Project[] = [];
  filteredIssues: any[] = [];
  filteredTodos: any[] = [];
  showNotificationPopup = false;
  searchExecuted: boolean = false;

  notifications: any[] = [];
  unreadCount: number = 0;

  private notifUnsubscribe: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private projectService: ProjectService,
    private firestore: Firestore
  ) {
    this.subscribeToNotifications();
  }

  subscribeToNotifications() {
    this.authService.user$.subscribe(user => {
      if (this.notifUnsubscribe) {
        this.notifUnsubscribe();
        this.notifUnsubscribe = null;
      }
      if (user) {
        const userId = user.uid;
        const notifCol = collection(this.firestore, 'notifications');
        this.notifUnsubscribe = onSnapshot(notifCol, (notifSnap: QuerySnapshot<DocumentData>) => {
          this.notifications = notifSnap.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
            .filter(notif => Array.isArray(notif.recipients) && notif.recipients.includes(userId));
          this.unreadCount = this.notifications.filter(n => n.read === false).length;
        });
      } else {
        this.notifications = [];
        this.unreadCount = 0;
      }
    });
  }

  ngOnDestroy() {
    if (this.notifUnsubscribe) {
      this.notifUnsubscribe();
    }
  }

  async logout() {
    if (!confirm('ログアウトしますか？')) {
      return;
    }
    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async onSearch() {
    this.searchExecuted = true;
    if (!this.searchText.trim()) {
      this.filteredProjects = [];
      this.filteredIssues = [];
      this.filteredTodos = [];
      return;
    }
    const allProjects = await this.projectService.getUserProjects();
    this.filteredProjects = allProjects.filter(p =>
      p.title && normalize(p.title).includes(normalize(this.searchText))
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
    this.filteredIssues = allIssues.filter(issue => {
      const t = issue.title || issue.issueTitle;
      return t && normalize(t).includes(normalize(this.searchText));
    });
    this.filteredTodos = allTodos.filter(todo => {
      const t = todo.title || todo.todoTitle;
      return t && normalize(t).includes(normalize(this.searchText));
    });
  }

  closeSearchPopup() {
    this.filteredProjects = [];
    this.filteredIssues = [];
    this.filteredTodos = [];
    this.searchExecuted = false;
    this.searchText = '';
  }

  goToProjectDetail(project: Project) {
    this.closeSearchPopup();
    this.searchText = '';
    if (project.isArchived) {
      this.router.navigate(['/archive', project.id]);
    } else {
      this.router.navigate(['/projects', project.id]);
    }
  }

  goToIssueDetail(issue: any) {
    this.closeSearchPopup();
    this.searchText = '';
    if (issue.isArchived) {
      this.router.navigate(['/archive', issue.projectId, 'issues', issue.id]);
    } else {
      this.router.navigate(['/projects', issue.projectId, 'issues', issue.id]);
    }
  }

  goToTodoParentIssue(todo: any) {
    this.closeSearchPopup();
    this.searchText = '';
    if (todo.isArchived) {
      this.router.navigate(['/archive', todo.projectId, 'issues', todo.issueId]);
    } else {
      this.router.navigate(['/projects', todo.projectId, 'issues', todo.issueId]);
    }
  }

  toggleNotificationPopup() {
    this.showNotificationPopup = true;
  }

} 