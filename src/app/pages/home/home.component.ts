import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private firestore: Firestore,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      const userRef = doc(this.firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && (userSnap.data()['displayName'] === null || userSnap.data()['displayName'] === undefined)) {
        if (window.confirm('ユーザー名を設定してください。')) {
          this.router.navigate(['/setting']);
        }
      }
    }
  }
} 