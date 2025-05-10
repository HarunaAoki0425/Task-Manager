import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { collection, getDocs, Firestore, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NotificationComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() readChanged = new EventEmitter<void>();
  user: any = null;
  notifications: any[] = [];

  get unreadCount(): number {
    return this.notifications.filter(n => n.read === false).length;
  }

  constructor(private authService: AuthService, private firestore: Firestore) {}

  async ngOnInit() {
    this.authService.user$.subscribe(async user => {
      this.user = user;
      if (user) {
        const userId = user?.uid ?? '';
        // トップレベルのnotificationsコレクションを取得
        const notifCol = collection(this.firestore, 'notifications');
        const notifSnap = await getDocs(notifCol);
        this.notifications = notifSnap.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
          .filter(notif => Array.isArray(notif.recipients) && notif.recipients.includes(userId))
          .sort((a, b) => {
            const aTime = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
          });
      } else {
        this.notifications = [];
      }
    });
  }

  async markAsRead(notif: any) {
    if (!notif.read) {
      const notifRef = doc(this.firestore, 'notifications', notif.id);
      await updateDoc(notifRef, { read: true });
      notif.read = true;
      this.readChanged.emit();
    }
  }

  async deleteNotification(notif: any) {
    if (!notif.id) return;
    const notifRef = doc(this.firestore, 'notifications', notif.id);
    await deleteDoc(notifRef);
    this.notifications = this.notifications.filter(n => n.id !== notif.id);
  }

  onClose() {
    this.close.emit();
  }
}
