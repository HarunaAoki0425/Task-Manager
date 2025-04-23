import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css']
})
export class NotificationBellComponent implements OnInit {
  notifications: Notification[] = [];
  showNotifications = false;
  unreadCount = 0;
  hasUnread = false;

  constructor(private notificationService: NotificationService) {
    this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
      this.hasUnread = count > 0;
    });
  }

  ngOnInit() {
    this.loadNotifications();
  }

  async loadNotifications() {
    this.notifications = await this.notificationService.getRecentNotifications();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  async markAsRead(notification: Notification) {
    if (!notification.read) {
      await this.notificationService.markAsRead(notification.id);
      notification.read = true;
    }
  }

  async markAllAsRead() {
    await this.notificationService.markAllAsRead();
    this.notifications.forEach(notification => notification.read = true);
  }
} 