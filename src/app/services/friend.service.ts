import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  getDocs,
  query,
  where,
  or
} from '@angular/fire/firestore';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  constructor(
    private firestore: Firestore
  ) {}

  /**
   * ユーザー一覧を取得する
   */
  async getUsers(): Promise<User[]> {
    const usersRef = collection(this.firestore, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data['displayName'],
        email: data['email']
      } as User;
    });
  }

  /**
   * メールアドレスまたはユーザー名でユーザーを検索する
   */
  async searchUsers(searchTerm: string): Promise<User[]> {
    if (!searchTerm.trim()) return [];

    const usersRef = collection(this.firestore, 'users');
    const searchTermLower = searchTerm.toLowerCase().trim();
    
    // Firestoreのクエリでは大文字小文字を区別する検索やLIKE検索ができないため、
    // 全ユーザーを取得して、クライアント側でフィルタリングする
    const querySnapshot = await getDocs(usersRef);
    
    return querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data['displayName'],
          email: data['email']
        } as User;
      })
      .filter(user => 
        user.email?.toLowerCase().includes(searchTermLower) ||
        user.displayName?.toLowerCase().includes(searchTermLower)
      );
  }
} 