import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'header-component',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  notificationCount = 0;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.notificationService.unreadCount$.subscribe(count => {
      this.notificationCount = count;
    });
  }

  async signOut() {
    await this.authService.logout();
  }
} 