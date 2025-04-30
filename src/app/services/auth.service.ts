import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  constructor(
    private auth: Auth,
    private router: Router,
    private firestore: Firestore
  ) {
    // 認証状態の監視
    user(this.auth).subscribe(user => {
      this.userSubject.next(user);
    });
  }

  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      // ユーザードキュメントの存在確認
      const userRef = doc(this.firestore, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);
      
      // ユーザードキュメントが存在しない場合は作成
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: result.user.email,
          uid: result.user.uid,
          displayName: null
        });
      }

      this.router.navigate(['/home']);
      return result;
    } catch (error) {
      console.error('ログインエラー:', error);
      throw error;
    }
  }

  async signup(email: string, password: string) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Firestoreにユーザー情報を保存
      const userRef = doc(this.firestore, 'users', result.user.uid);
      await setDoc(userRef, {
        email: email,
        uid: result.user.uid,
        displayName: null
      });

      this.router.navigate(['/home']);
      return result;
    } catch (error) {
      console.error('サインアップエラー:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }
} 