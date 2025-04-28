import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Firestore } from '@angular/fire/firestore';
import { doc, getDoc, setDoc } from '@angular/fire/firestore';
import { filter, take } from 'rxjs';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';

@Component({
  selector: 'app-setting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.css']
})
export class SettingComponent implements OnInit {
  email: string = '';
  displayName: string = '';
  displayNameInput: string = '';
  message: string = '';
  isSaving: boolean = false;
  isEditing: boolean = false;
  isLoading: boolean = true;
  isChangingPassword = false;
  newPassword = '';
  newPasswordConfirm = '';
  isPasswordSaving = false;
  passwordMessage = '';
  currentPassword = '';
  isReauthenticating = false;
  isReauthenticated = false;
  reauthMessage = '';
  currentPasswordVisible = false;
  newPasswordVisible = false;
  newPasswordConfirmVisible = false;

  constructor(private authService: AuthService, private firestore: Firestore) {}

  async ngOnInit() {
    this.authService.user$
      .pipe(
        filter(user => !!user),
        take(1)
      )
      .subscribe(async user => {
        this.email = user!.email || '';
        const userDoc = doc(this.firestore, 'users', user!.uid);
        const userSnap = await getDoc(userDoc);
        this.displayName = userSnap.exists() ? userSnap.data()['displayName'] || '' : '';
        this.displayNameInput = this.displayName;
        this.isLoading = false;
      });
  }

  startEdit() {
    this.isEditing = true;
    this.displayNameInput = this.displayName;
    this.message = '';
  }

  cancelEdit() {
    this.isEditing = false;
    this.displayNameInput = this.displayName;
    this.message = '';
  }

  async saveDisplayName() {
    this.isSaving = true;
    this.message = '';
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.message = 'ユーザー情報が取得できません。';
      this.isSaving = false;
      return;
    }
    try {
      const newName = this.displayNameInput.trim() || 'no name';
      const userDoc = doc(this.firestore, 'users', user.uid);
      await setDoc(userDoc, { displayName: newName }, { merge: true });
      this.displayName = newName;
      this.message = 'ユーザー名を保存しました。';
      this.isEditing = false;
    } catch (error) {
      this.message = '保存に失敗しました。';
      console.error(error);
    } finally {
      this.isSaving = false;
    }
  }

  startPasswordChange() {
    this.isChangingPassword = true;
    this.currentPassword = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.isReauthenticated = false;
    this.isReauthenticating = false;
    this.reauthMessage = '';
    this.passwordMessage = '';
  }

  cancelPasswordChange() {
    this.isChangingPassword = false;
    this.currentPassword = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.isReauthenticated = false;
    this.isReauthenticating = false;
    this.reauthMessage = '';
    this.passwordMessage = '';
  }

  async reauthenticate() {
    this.isReauthenticating = true;
    this.reauthMessage = '';
    try {
      const user = await this.authService.getCurrentUser();
      if (!user || !user.email) {
        this.reauthMessage = '認証情報が取得できません。再度ログインしてください。';
        this.isReauthenticating = false;
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, this.currentPassword);
      await reauthenticateWithCredential(user, credential);
      this.isReauthenticated = true;
      this.reauthMessage = '';
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        this.reauthMessage = '現在のパスワードが正しくありません。';
      } else {
        this.reauthMessage = '再認証に失敗しました。';
      }
    } finally {
      this.isReauthenticating = false;
    }
  }

  async saveNewPassword() {
    if (!this.isReauthenticated) {
      this.passwordMessage = 'まず現在のパスワードで認証してください。';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      this.passwordMessage = 'パスワードは6文字以上で入力してください。';
      return;
    }
    if (this.newPassword !== this.newPasswordConfirm) {
      this.passwordMessage = 'パスワードが一致しません。';
      return;
    }
    this.isPasswordSaving = true;
    this.passwordMessage = '';
    try {
      const user = await this.authService.getCurrentUser();
      if (user) {
        await updatePassword(user, this.newPassword);
        this.passwordMessage = 'パスワードが変更されました。';
        this.isChangingPassword = false;
      } else {
        this.passwordMessage = '認証情報が見つかりません。再度ログインしてください。';
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        this.passwordMessage = '再認証が必要です。ログインし直してください。';
      } else {
        this.passwordMessage = 'パスワード変更に失敗しました。';
      }
    } finally {
      this.isPasswordSaving = false;
      this.currentPassword = '';
      this.newPassword = '';
      this.newPasswordConfirm = '';
      this.isReauthenticated = false;
    }
  }

  toggleCurrentPasswordVisible() {
    this.currentPasswordVisible = !this.currentPasswordVisible;
  }

  toggleNewPasswordVisible() {
    this.newPasswordVisible = !this.newPasswordVisible;
  }

  toggleNewPasswordConfirmVisible() {
    this.newPasswordConfirmVisible = !this.newPasswordConfirmVisible;
  }
} 