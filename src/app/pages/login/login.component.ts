import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [AuthService],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  showRegisterPopup: boolean = false;
  registerEmail: string = '';
  registerPassword: string = '';
  registerPasswordConfirm: string = '';
  showRegisterPassword: boolean = false;
  showRegisterPasswordConfirm: boolean = false;
  registerErrorMessage: string = '';
  registerSending: boolean = false;
  registerSuccessMessage: string = '';
  showPassword: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private auth: Auth
  ) {
    // ログイン後リロードの無限ループ防止
    if (localStorage.getItem('reloadedAfterLogin')) {
      localStorage.removeItem('reloadedAfterLogin');
    }
  }

  async onSubmit(): Promise<void> {
    try {
      this.errorMessage = '';
      await this.authService.login(this.email, this.password);
      // Firestoreのユーザードキュメントを取得し、displayNameがnullならアラート
      const user = this.auth.currentUser;
      if (user) {
        const userRef = doc(this.authService['firestore'], 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && (userSnap.data()['displayName'] === null || userSnap.data()['displayName'] === undefined)) {
          alert('⚙からユーザー名を設定してください。');
        }
      }
      await this.router.navigate(['/home']);
      if (!localStorage.getItem('reloadedAfterLogin')) {
        localStorage.setItem('reloadedAfterLogin', 'true');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      // エラーメッセージを日本語で表示
      switch (error.code) {
        case 'auth/invalid-email':
          this.errorMessage = 'メールアドレスの形式が正しくありません。';
          break;
        case 'auth/user-disabled':
          this.errorMessage = 'このアカウントは無効になっています。';
          break;
        case 'auth/user-not-found':
          this.errorMessage = 'アカウントが見つかりません。';
          break;
        case 'auth/wrong-password':
          this.errorMessage = 'パスワードが間違っています。';
          break;
        default:
          this.errorMessage = 'ログインに失敗しました。';
      }
    }
  }

  async onRegister() {
    this.registerErrorMessage = '';
    if (!this.registerEmail || !this.registerPassword || !this.registerPasswordConfirm || this.registerPassword !== this.registerPasswordConfirm) return;
    this.registerSending = true;
    try {
      await createUserWithEmailAndPassword(this.auth, this.registerEmail, this.registerPassword);
      this.showRegisterPopup = false;
      this.registerEmail = '';
      this.registerPassword = '';
      this.registerPasswordConfirm = '';
      this.registerSuccessMessage = '登録が成功しました。ログインしてください。';
      // ログイン画面の入力とエラーメッセージもリセット
      this.email = '';
      this.password = '';
      this.errorMessage = '';
    } catch (e: any) {
      // Firebaseエラーコードを日本語に変換
      switch (e.code) {
        case 'auth/email-already-in-use':
          this.registerErrorMessage = 'このメールアドレスは既に使用されています。';
          break;
        case 'auth/invalid-email':
          this.registerErrorMessage = 'メールアドレスの形式が正しくありません。';
          break;
        case 'auth/operation-not-allowed':
          this.registerErrorMessage = 'この操作は許可されていません。';
          break;
        case 'auth/weak-password':
          this.registerErrorMessage = 'パスワードは6文字以上にしてください。';
          break;
        default:
          this.registerErrorMessage = '登録に失敗しました。';
      }
    } finally {
      this.registerSending = false;
    }
  }

  resetRegisterForm() {
    this.registerEmail = '';
    this.registerPassword = '';
    this.registerPasswordConfirm = '';
    this.registerErrorMessage = '';
    this.registerSending = false;
    this.showRegisterPassword = false;
    this.showRegisterPasswordConfirm = false;
  }
}
