import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { FriendService } from '../../../services/friend.service';
import { NgForm } from '@angular/forms';

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
    private friendService: FriendService
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

  async onSubmit(form: NgForm) {
    if (form.invalid || (!this.noDueDate && !this.dueDate)) return;

    try {
      this.isSubmitting = true;
      this.errorMessage = null;

      if (!this.currentUser) {
        throw new Error('ユーザーが認証されていません');
      }

      const projectsRef = collection(this.firestore, 'projects');
      await addDoc(projectsRef, {
        title: this.projectTitle,
        description: this.description,
        createdBy: this.currentUser.uid,
        members: [...this.selectedMembers.map(member => member.uid), this.currentUser.uid],
        createdAt: serverTimestamp(),
        dueDate: (this.noDueDate || !this.dueDate) ? null : this.dueDate,
        status: 'active'
      });

      this.router.navigate(['/projects']);
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      this.errorMessage = 'プロジェクトの作成中にエラーが発生しました';
    } finally {
      this.isSubmitting = false;
    }
  }
} 