// プロジェクト招待情報の型
export interface ProjectInvite {
  id?: string;
  email: string;
  invitedAt: any; // Timestamp型
  inviterUid: string;
  status: 'pending' | 'accepted' | 'declined';
}

import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, Timestamp } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private firestore: Firestore) {}

  // プロジェクトの招待を追加
  async addProjectInvite(projectId: string, email: string, inviterUid: string): Promise<void> {
    const invitesRef = collection(this.firestore, `projects/${projectId}/invites`);
    await addDoc(invitesRef, {
      email,
      invitedAt: Timestamp.now(),
      inviterUid,
      status: 'pending',
    });
  }

  // プロジェクトの招待一覧を取得
  async getProjectInvites(projectId: string): Promise<ProjectInvite[]> {
    const invitesRef = collection(this.firestore, `projects/${projectId}/invites`);
    const snap = await getDocs(invitesRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectInvite));
  }
} 