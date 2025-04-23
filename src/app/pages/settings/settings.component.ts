import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  userEmail = '';
  displayName = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  successMessage = '';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadUserData();
  }

  async loadUserData() {
    const user = await this.authService.getCurrentUser();
    if (user) {
      this.userEmail = user.email || '';
      this.displayName = user.displayName || 'no name';
    }
  }

  async updateDisplayName() {
    try {
      await this.authService.updateDisplayName(this.displayName);
      this.successMessage = 'ユーザー名を更新しました。';
      this.error = '';
    } catch (error: any) {
      this.error = error.message;
      this.successMessage = '';
    }
  }

  async updatePassword() {
    this.error = '';
    this.successMessage = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.error = 'すべての項目を入力してください。';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = '新しいパスワードが一致しません。';
      return;
    }

    if (this.newPassword.length < 6) {
      this.error = '新しいパスワードは6文字以上で入力してください。';
      return;
    }

    try {
      await this.authService.updatePassword(this.currentPassword, this.newPassword);
      this.successMessage = 'パスワードを更新しました。';
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (error: any) {
      this.error = error.message;
    }
  }
} 