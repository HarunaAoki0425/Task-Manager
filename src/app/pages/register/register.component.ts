import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規登録
          </h2>
        </div>
        <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()">
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email-address" class="sr-only">メールアドレス</label>
              <input id="email-address"
                     name="email"
                     type="email"
                     [(ngModel)]="email"
                     required
                     class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                     placeholder="メールアドレス">
            </div>
            <div>
              <label for="password" class="sr-only">パスワード</label>
              <input id="password"
                     name="password"
                     type="password"
                     [(ngModel)]="password"
                     required
                     class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                     placeholder="パスワード（6文字以上）">
            </div>
          </div>

          <div>
            <button type="submit"
                    class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              登録
            </button>
          </div>

          <div class="text-center">
            <a routerLink="/login"
               class="font-medium text-indigo-600 hover:text-indigo-500">
              ログイン画面に戻る
            </a>
          </div>
        </form>

        <div *ngIf="error" class="mt-4 text-center text-sm text-red-600">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class RegisterComponent {
  email = '';
  password = '';
  error = '';

  constructor(private authService: AuthService) {}

  async onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'メールアドレスとパスワードを入力してください。';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'パスワードは6文字以上で入力してください。';
      return;
    }

    try {
      await this.authService.register(this.email, this.password);
    } catch (error: any) {
      this.error = error.message;
    }
  }
} 