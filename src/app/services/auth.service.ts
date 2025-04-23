import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, updateProfile, updatePassword as updateFirebasePassword, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();
  private initialAuthCheckDone = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private userService: UserService
  ) {
    this.auth.onAuthStateChanged(user => {
      this.userSubject.next(user);
      
      // 初回の認証チェック時のみ実行
      if (!this.initialAuthCheckDone) {
        this.initialAuthCheckDone = true;
        const currentPath = window.location.pathname;
        
        // ユーザーが未認証で、かつログインまたは登録ページ以外にいる場合
        if (!user && 
            !currentPath.includes('/login') && 
            !currentPath.includes('/register')) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  async login(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      this.router.navigate(['/home']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  async register(email: string, password: string): Promise<void> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Firestoreにユーザー情報を保存
      await this.userService.createUser(user.uid, {
        email: email,
        displayName: email.split('@')[0] // 仮のdisplayName
      });
      
      this.router.navigate(['/home']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('ユーザーが見つかりません。');

    try {
      await updateProfile(user, { displayName });
      // Firestoreのユーザー情報も更新
      await this.userService.updateUser(user.uid, { displayName });
      this.userSubject.next(user);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('ユーザーが見つかりません。');

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateFirebasePassword(user, newPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('現在のパスワードが正しくありません。');
      }
      throw this.handleAuthError(error);
    }
  }

  private handleAuthError(error: any): Error {
    let message = 'An error occurred during authentication';
    if (error.code === 'auth/user-not-found') {
      message = 'User not found. Please check your email.';
    } else if (error.code === 'auth/wrong-password') {
      message = 'Invalid password. Please try again.';
    } else if (error.code === 'auth/email-already-in-use') {
      message = 'This email is already registered.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password should be at least 6 characters.';
    }
    return new Error(message);
  }
} 