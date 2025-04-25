import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Auth } from '@angular/fire/auth';

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

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit(): Promise<void> {
    try {
      this.errorMessage = '';
      await this.authService.login(this.email, this.password);
      console.log('Login successful');
      await this.router.navigate(['/home']);
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
}
