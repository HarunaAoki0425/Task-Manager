import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from '../../../models/todo.model';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent {
  projectId: string | null = null;
  issueId: string | null = null;
  title = '';
  startDate = '';
  dueDate = '';
  assignee = '';
  priority = 'medium';
  memo = '';
  message = '';
  projectTitle = '';

  newTodo = {
    title: '',
    assignee: '',
    dueDate: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {
    this.route.paramMap.subscribe(params => {
      this.projectId = params.get('projectId');
      if (this.projectId) {
        this.loadProjectTitle();
      }
    });
  }

  async loadProjectTitle() {
    if (!this.projectId) return;
    try {
      const projectRef = doc(this.firestore, 'projects', this.projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        this.projectTitle = projectSnap.data()['title'] || '';
      }
    } catch (error) {
      console.error('Error loading project title:', error);
    }
  }

  async createIssue() {
    if (!this.projectId || !this.title) {
      this.message = '必須項目を入力してください。';
      return;
    }

    try {
      const now = Timestamp.now();
      const issueData = {
        title: this.title,
        startDate: this.startDate ? Timestamp.fromDate(new Date(this.startDate)) : null,
        dueDate: this.dueDate ? Timestamp.fromDate(new Date(this.dueDate)) : null,
        assignee: this.assignee,
        priority: this.priority,
        memo: this.memo,
        status: '未着手',
        createdAt: now,
        updatedAt: now
      };

      const issuesRef = collection(this.firestore, `projects/${this.projectId}/issues`);
      const issueDocRef = await addDoc(issuesRef, issueData);
      this.issueId = issueDocRef.id;

      if (this.newTodo.title && this.newTodo.assignee) {
        await this.addTodo();
      }

      this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('Error creating issue:', error);
      this.message = '課題の作成に失敗しました。';
    }
  }

  async addTodo() {
    if (!this.projectId || !this.issueId || !this.newTodo.title || !this.newTodo.assignee) return;

    try {
      const now = Timestamp.now();
      const todoData: Omit<Todo, 'id'> = {
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: this.newTodo.dueDate ? Timestamp.fromDate(new Date(this.newTodo.dueDate)) : null,
        completed: false,
        completedAt: null,
        projectId: this.projectId,
        projectTitle: this.projectTitle,
        issueId: this.issueId,
        issueTitle: this.title,
        createdAt: now,
        updatedAt: now
      };

      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      await addDoc(todosRef, todoData);

      // フォームをリセット
      this.newTodo = {
        title: '',
        assignee: '',
        dueDate: ''
      };
    } catch (error) {
      console.error('Error adding todo:', error);
      this.message = 'Todoの追加に失敗しました。';
    }
  }

  formatDate(ts: Timestamp | string | null | undefined): string {
    if (!ts) return '';
    
    let date: Date;
    if (typeof ts === 'string') {
      date = new Date(ts);
    } else if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else {
      return '';
    }

    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }
} 