import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, DocumentData } from '@angular/fire/firestore';
import { User, UserProfile } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private firestore: Firestore) {}

  async createUser(uid: string, userData: UserProfile): Promise<void> {
    const user: User = {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await setDoc(doc(this.firestore, 'users', uid), user);
    } catch (error) {
      console.error('Failed to create user in Firestore:', error);
      throw new Error('ユーザー情報の保存に失敗しました。');
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));
      if (!userDoc.exists()) {
        return null;
      }
      const data = userDoc.data() as DocumentData & {
        createdAt: { toDate(): Date };
        updatedAt: { toDate(): Date };
      };
      
      return {
        ...data,
        uid: userDoc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as User;
    } catch (error) {
      console.error('Failed to fetch user from Firestore:', error);
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(doc(this.firestore, 'users', userId), updateData);
    } catch (error) {
      console.error('Failed to update user in Firestore:', error);
      throw new Error('ユーザー情報の更新に失敗しました。');
    }
  }
} 