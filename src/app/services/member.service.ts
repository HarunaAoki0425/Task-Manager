import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  // メールアドレスからユーザーを検索
  async searchUserByEmail(email: string): Promise<UserProfile | null> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const userDoc = querySnapshot.docs[0];
    return {
      uid: userDoc.id,
      ...userDoc.data()
    } as UserProfile;
  }

  // プロジェクトにメンバーを追加
  async addMemberToProject(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    await updateDoc(projectRef, {
      members: arrayUnion(userId)
    });
  }

  // プロジェクトからメンバーを削除
  async removeMemberFromProject(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    await updateDoc(projectRef, {
      members: arrayRemove(userId)
    });
  }

  // プロジェクトのメンバー一覧を取得
  async getProjectMembers(memberIds: string[]): Promise<UserProfile[]> {
    const members: UserProfile[] = [];
    
    for (const memberId of memberIds) {
      const userDoc = await getDocs(
        query(collection(this.firestore, 'users'), where('uid', '==', memberId))
      );
      
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        members.push({
          uid: memberId,
          ...userData
        } as UserProfile);
      }
    }
    
    return members;
  }
} 