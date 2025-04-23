import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(
    private auth: Auth,
    private router: Router
  ) {}

  async signUp() {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        this.email,
        this.password
      );
      console.log('登録成功:', userCredential.user.email);
      this.router.navigate(['/todo']);
    } catch (error: any) {
      console.error('登録失敗:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    }
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています';
      case 'auth/invalid-email':
        return '無効なメールアドレスです';
      case 'auth/operation-not-allowed':
        return 'メール/パスワードでの登録が無効になっています';
      case 'auth/weak-password':
        return 'パスワードが弱すぎます。より強力なパスワードを設定してください';
      default:
        return '登録に失敗しました。もう一度お試しください';
    }
  }
} 