import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthService } from './services/auth.service';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ProjectService } from './services/project.service';
import { TodoService } from './services/todo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatListModule,
    MatIconModule,
    RouterModule
  ],
  providers: [AuthService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
  private pollIntervalId: any = null;
  private lastUserId: string | null = null;

  constructor(private auth: Auth, private authService: AuthService, private projectService: ProjectService, private todoService: TodoService) {
    this.authService.user$.subscribe(user => {
      if (user) {
        if (this.lastUserId !== user.uid && this.pollIntervalId) {
          clearInterval(this.pollIntervalId);
          this.pollIntervalId = null;
        }
        this.lastUserId = user.uid;

        this.projectService.getTodayIssuesForUser();
        this.todoService.getTodosAssignedToMe();

        if (!this.pollIntervalId) {
          this.pollIntervalId = setInterval(() => {
            this.projectService.getTodayIssuesForUser();
            this.todoService.getTodosAssignedToMe();
          }, 5 * 60 * 1000);
        }
      } else {
        if (this.pollIntervalId) {
          clearInterval(this.pollIntervalId);
          this.pollIntervalId = null;
        }
        this.lastUserId = null;
      }
    });
  }

  ngOnDestroy() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
  }
}
