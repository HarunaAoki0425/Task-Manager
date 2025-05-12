import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { FriendService } from '../../../services/friend.service';
import { NgForm } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.css']
})
export class ProjectCreateComponent {
  projectTitle: string = '';
  description: string = '';
  dueDate: string = '';
  noDueDate: boolean = false;
  isSubmitting: boolean = false;
  errorMessage: string | null = null;
  
  // プロジェクトカラー関連
  projectColors = [
    { name: 'ブルー', value: '#2196F3' },
    { name: 'グリーン', value: '#4CAF50' },
    { name: 'レッド', value: '#F44336' },
    { name: 'パープル', value: '#9C27B0' },
    { name: 'オレンジ', value: '#FF9800' },
    { name: 'ティール', value: '#009688' },
    { name: 'ピンク', value: '#E91E63' },
    { name: 'インディゴ', value: '#3F51B5' }
  ];
  selectedColor: string = this.projectColors[0].value;
  customColor: string = '#000000';
  isColorPickerVisible: boolean = false;
  
  // メンバー検索関連
  searchTerm: string = '';
  isSearching: boolean = false;
  searchResults: User[] = [];
  selectedMembers: User[] = [];
  currentUser: User | null = null;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private router: Router,
    private friendService: FriendService,
    private projectService: ProjectService
  ) {
    // 初期化時に現在のユーザー情報を取得
    this.authService.user$.subscribe(user => {
      if (user) {
        this.currentUser = user;
      }
    });
  }

  async searchUsers() {
    if (!this.searchTerm.trim() || !this.currentUser) return;

    try {
      this.isSearching = true;
      const results = await this.friendService.searchUsers(this.searchTerm);
      
      // 現在のユーザーを除外
      this.searchResults = results.filter(user => user.uid !== this.currentUser?.uid);
      
      if (this.searchResults.length === 0) {
        this.errorMessage = 'ユーザーが見つかりませんでした';
      } else {
        this.errorMessage = null;
      }
    } catch (error) {
      console.error('ユーザー検索エラー:', error);
      this.errorMessage = 'ユーザーの検索中にエラーが発生しました';
    } finally {
      this.isSearching = false;
    }
  }

  selectUser(user: User) {
    if (!this.selectedMembers.some(member => member.uid === user.uid)) {
      this.selectedMembers.push(user);
    }
    this.searchTerm = '';
    this.searchResults = [];
    this.errorMessage = null;
  }

  removeMember(user: User) {
    this.selectedMembers = this.selectedMembers.filter(member => member.uid !== user.uid);
  }

  selectProjectColor(color: string) {
    if (color === 'custom') {
      this.isColorPickerVisible = true;
    } else {
      this.selectedColor = color;
      this.isColorPickerVisible = false;
    }
  }

  onColorPickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.customColor = input.value;
    this.selectedColor = 'custom';
  }

  closeColorPicker() {
    this.isColorPickerVisible = false;
  }

  async onSubmit(form: NgForm) {
    if (form.invalid || (!this.noDueDate && !this.dueDate)) return;

    try {
      this.isSubmitting = true;
      this.errorMessage = null;

      if (!this.currentUser) {
        throw new Error('ユーザーが認証されていません');
      }

      const projectsRef = collection(this.firestore, 'projects');
      const docRef = await addDoc(projectsRef, {
        title: this.projectTitle,
        description: this.description,
        createdBy: this.currentUser.uid,
        members: [...this.selectedMembers.map(member => member.uid), this.currentUser.uid],
        createdAt: serverTimestamp(),
        dueDate: (this.noDueDate || !this.dueDate) ? null : this.dueDate,
        status: 'active',
        color: this.selectedColor === 'custom' ? this.customColor : this.selectedColor
      });

      // notificationsコレクションにも保存
      const notificationsRef = collection(this.firestore, 'notifications');
      const allMembers = [...this.selectedMembers.map(member => member.uid), this.currentUser!.uid];
      const recipients = allMembers.filter(uid => uid !== this.currentUser!.uid);
      if (recipients.length > 0) {
        for (const recipient of recipients) {
          await addDoc(notificationsRef, {
            createdAt: serverTimestamp(),
            recipients: [recipient],
            projectId: docRef.id,
            title: this.projectTitle,
            message: '新しいプロジェクトのメンバーに追加されました。',
            read: false
          });
        }
      }

      this.router.navigate(['/projects']);
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      this.errorMessage = 'プロジェクトの作成中にエラーが発生しました';
    } finally {
      this.isSubmitting = false;
    }
  }

  goToProjectList() {
    // いずれかの入力欄が埋まっていたら警告
    const hasInput = this.projectTitle.trim() || this.description.trim() || this.dueDate || this.selectedMembers.length > 0;
    if (hasInput) {
      const confirmed = window.confirm('プロジェクトは保存されませんが、戻りますか？');
      if (!confirmed) return;
    }
    this.router.navigate(['/projects']);
  }
} 