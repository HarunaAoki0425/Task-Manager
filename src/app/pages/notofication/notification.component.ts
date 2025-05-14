import { Component, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { collection, getDocs, Firestore, doc, updateDoc, deleteDoc, getDoc, onSnapshot, QuerySnapshot, DocumentData } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() readChanged = new EventEmitter<void>();
  user: any = null;
  notifications: any[] = [];
  private notifUnsubscribe: (() => void) | null = null;
  loading = true;

  get unreadCount(): number {
    return this.notifications.filter(n => n.read === false).length;
  }

  constructor(private authService: AuthService, private firestore: Firestore) {}

  async ngOnInit() {
    this.loading = true;
    this.authService.user$.subscribe(user => {
      this.user = user;
      if (this.notifUnsubscribe) {
        this.notifUnsubscribe();
        this.notifUnsubscribe = null;
      }
      if (user) {
        const userId = user?.uid ?? '';
        // 通知コレクションをリアルタイム購読
        const notifCol = collection(this.firestore, 'notifications');
        this.notifUnsubscribe = onSnapshot(notifCol, (notifSnap: QuerySnapshot<DocumentData>) => {
          this.notifications = notifSnap.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
            .filter(notif => Array.isArray(notif.recipients) && notif.recipients.includes(userId))
            .filter(notif => !notif.hidden)
            .sort((a, b) => {
              const aTime = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
              const bTime = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
              return bTime - aTime;
            });
          this.loading = false;
        });
      } else {
        this.notifications = [];
        this.loading = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.notifUnsubscribe) {
      this.notifUnsubscribe();
    }
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
    // Firestoreからは削除せず、画面上から非表示にするだけ
    this.notifications = this.notifications.filter(n => n.id !== notif.id);
  }

  onClose() {
    this.close.emit();
  }

  // 既存通知のprojectIdを一括修正するバッチ処理
  async batchFixProjectIdForNotifications() {
    const notifCol = collection(this.firestore, 'notifications');
    const notifSnap = await getDocs(notifCol);
    for (const notifDoc of notifSnap.docs) {
      const notif = notifDoc.data() as any;
      if (!notif.projectId && notif.issueId) {
        // issueIdから親プロジェクトを探す
        // プロジェクト一覧を取得
        const projectsCol = collection(this.firestore, 'projects');
        const projectsSnap = await getDocs(projectsCol);
        let foundProjectId = null;
        for (const projectDoc of projectsSnap.docs) {
          const issuesCol = collection(this.firestore, `projects/${projectDoc.id}/issues`);
          const issueDoc = await getDoc(doc(this.firestore, `projects/${projectDoc.id}/issues/${notif.issueId}`));
          if (issueDoc.exists()) {
            foundProjectId = projectDoc.id;
            break;
          }
        }
        if (foundProjectId) {
          // projectIdを通知に追加
          const notifRef = doc(this.firestore, 'notifications', notifDoc.id);
          await updateDoc(notifRef, { projectId: foundProjectId });
        }
      }
    }
  }

  async hideNotification(notif: any) {
    if (!notif.id) return;
    const notifRef = doc(this.firestore, 'notifications', notif.id);
    await updateDoc(notifRef, { hidden: true });
    notif.hidden = true;
  }
}
