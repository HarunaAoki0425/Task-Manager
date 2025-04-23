import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit as limitTo } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Notification {
  id: string;
  userId: string;
  type: 'deadline' | 'status_change' | 'member_added' | 'issue_created';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedId?: string; // プロジェクトまたは課題のID
  link?: string; // 通知をクリックした時の遷移先
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private unreadCount = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCount.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {
    this.initializeUnreadCount();
  }

  private async initializeUnreadCount() {
    const user = this.auth.currentUser;
    if (!user) return;

    const unreadNotifications = await this.getUnreadNotifications();
    this.unreadCount.next(unreadNotifications.length);
  }

  // 通知の作成
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> {
    const notificationData = {
      ...notification,
      createdAt: new Date(),
      read: false
    };

    await addDoc(collection(this.firestore, 'notifications'), notificationData);
    this.updateUnreadCount();
  }

  // 期限通知の作成
  async createDeadlineNotification(userId: string, title: string, dueDate: Date, itemId: string, itemType: 'issue' | 'task'): Promise<void> {
    const message = `${title}の期限が${dueDate.toLocaleDateString()}に設定されています。`;
    const link = itemType === 'issue' ? `/issues/${itemId}` : `/tasks/${itemId}`;

    await this.createNotification({
      userId,
      type: 'deadline',
      title: '期限通知',
      message,
      relatedId: itemId,
      link
    });
  }

  // ステータス変更通知の作成
  async createStatusChangeNotification(userId: string, title: string, newStatus: string, itemId: string, itemType: 'issue' | 'task'): Promise<void> {
    const message = `${title}のステータスが「${newStatus}」に変更されました。`;
    const link = itemType === 'issue' ? `/issues/${itemId}` : `/tasks/${itemId}`;

    await this.createNotification({
      userId,
      type: 'status_change',
      title: 'ステータス変更',
      message,
      relatedId: itemId,
      link
    });
  }

  // メンバー追加通知の作成
  async createMemberAddedNotification(userId: string, projectName: string, projectId: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'member_added',
      title: 'プロジェクトへの招待',
      message: `${projectName}にメンバーとして追加されました。`,
      relatedId: projectId,
      link: `/projects/${projectId}`
    });
  }

  // 未読の通知を取得
  private async getUnreadNotifications(): Promise<Notification[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notification));
  }

  // 最新の通知を取得
  async getRecentNotifications(limit: number = 5): Promise<Notification[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limitTo(limit)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notification));
  }

  // 通知を既読にする
  async markAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(this.firestore, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
    this.updateUnreadCount();
  }

  // すべての通知を既読にする
  async markAllAsRead(): Promise<void> {
    const unreadNotifications = await this.getUnreadNotifications();
    const updatePromises = unreadNotifications.map(notification =>
      this.markAsRead(notification.id)
    );
    await Promise.all(updatePromises);
  }

  // 未読カウントの更新
  private async updateUnreadCount(): Promise<void> {
    const unreadNotifications = await this.getUnreadNotifications();
    this.unreadCount.next(unreadNotifications.length);
  }
} 