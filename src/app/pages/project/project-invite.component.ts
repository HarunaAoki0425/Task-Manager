import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, arrayUnion } from '@angular/fire/firestore';
// 認証サービスはプロジェクトの実装に合わせて調整してください
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-project-invite',
  standalone: true,
  templateUrl: './project-invite.component.html',
  styleUrls: ['./project-invite.component.css']
})
export class ProjectInviteComponent implements OnInit {
  status: 'loading' | 'error' | 'already' | 'joined' = 'loading';
  message = '';
  projectId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    const inviteId = this.route.snapshot.paramMap.get('inviteId');
    if (!this.projectId || !inviteId) {
      this.status = 'error';
      this.message = '招待情報が不正です。';
      return;
    }

    // 認証状態の確認
    const user = await this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }

    // 招待情報取得
    const inviteRef = doc(this.firestore, `projects/${this.projectId}/invites/${inviteId}`);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      this.status = 'error';
      this.message = '招待が見つかりません。';
      return;
    }

    // すでにメンバーかチェック
    const projectRef = doc(this.firestore, `projects/${this.projectId}`);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      this.status = 'error';
      this.message = 'プロジェクトが見つかりません。';
      return;
    }
    const project = projectSnap.data();
    if (project['members'] && project['members'].includes(user.uid)) {
      this.status = 'already';
      this.message = 'あなたはすでにこのプロジェクトのメンバーです。';
      return;
    }

    // 参加処理
    await updateDoc(projectRef, {
      members: arrayUnion(user.uid)
    });
    await updateDoc(inviteRef, {
      status: 'accepted'
    });

    this.status = 'joined';
    this.message = 'プロジェクトに参加しました！';
  }
} 