import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.css']
})
export class FriendsComponent {
  searchTerm: string = '';
  searchResults: User[] = [];

  constructor(private firestore: Firestore) {}

  async searchUsers() {
    if (!this.searchTerm.trim()) return;

    try {
      const q = query(
        collection(this.firestore, 'users'),
        where('email', '==', this.searchTerm.trim())
      );

      const querySnapshot = await getDocs(q);
      this.searchResults = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      
    } catch (error) {
      console.error('ユーザー検索エラー:', error);
    }
  }
}
