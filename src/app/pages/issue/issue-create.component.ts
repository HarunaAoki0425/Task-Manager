import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent {
  projectId: string | null = null;

  // フォーム入力値
  title = '';
  startDate: string | null = null;
  dueDate: string | null = null;
  assignee = '';
  priority = '';
  memo = '';
  isSaving = false;
  message = '';

  constructor(private route: ActivatedRoute, private firestore: Firestore, private router: Router) {
    this.route.queryParamMap.subscribe(params => {
      this.projectId = params.get('projectId');
    });
  }

  async saveIssue() {
    if (!this.projectId) return;
    this.isSaving = true;
    this.message = '';
    try {
      const issuesRef = collection(this.firestore, `projects/${this.projectId}/issues`);
      await addDoc(issuesRef, {
        title: this.title,
        startDate: this.startDate ? Timestamp.fromDate(new Date(this.startDate)) : null,
        dueDate: this.dueDate ? Timestamp.fromDate(new Date(this.dueDate)) : null,
        assignee: this.assignee,
        priority: this.priority,
        memo: this.memo,
        status: '未着手',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      this.router.navigate(['/project', this.projectId]);
    } catch {
      this.message = '保存に失敗しました。';
    } finally {
      this.isSaving = false;
    }
  }
} 