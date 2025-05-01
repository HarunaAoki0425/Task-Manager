import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent implements OnInit {
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
  isSaving = false;
  memberDetails: User[] = [];
  todos: Todo[] = [];

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

  ngOnInit() {
    // メンバー情報の初期化
    this.loadMemberDetails();
  }

  onAssigneeInteraction() {
    // 担当者入力フィールドがフォーカスされたときの処理
    // 必要に応じて実装を追加
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

  async loadMemberDetails() {
    try {
      if (!this.projectId) return;
      
      // プロジェクトのメンバーIDを取得
      const projectRef = doc(this.firestore, 'projects', this.projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (projectSnap.exists()) {
        const members = projectSnap.data()['members'] || [];
        
        // メンバーの詳細情報を取得
        const userPromises = members.map(async (uid: string) => {
          const userRef = doc(this.firestore, 'users', uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return {
              uid,
              displayName: userData['displayName'] || 'Unknown User',
              email: userData['email'] || ''
            };
          }
          return {
            uid,
            displayName: 'Unknown User',
            email: ''
          };
        });

        // すべてのユーザー情報を取得
        this.memberDetails = await Promise.all(userPromises);
        
        // displayNameでソート
        this.memberDetails.sort((a, b) => 
          a.displayName.localeCompare(b.displayName)
        );
      }
    } catch (error) {
      console.error('Error loading member details:', error);
      // エラーが発生しても最低限の表示ができるように空の配列を設定
      this.memberDetails = [];
    }
  }

  toggleTodo(index: number) {
    if (this.todos[index]) {
      this.todos[index].completed = !this.todos[index].completed;
    }
  }

  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member?.displayName || '未割り当て';
  }

  removeTodo(index: number) {
    this.todos.splice(index, 1);
  }

  async addTodo() {
    if (!this.projectId || !this.newTodo.title || !this.newTodo.assignee) {
      this.message = 'プロジェクトID、タイトル、担当者は必須です。';
      return;
    }

    try {
      // 一時的なTodoオブジェクトを作成
      const now = Timestamp.now();
      const newTodo: Todo = {
        id: `temp_${Date.now()}`, // 一時的なID
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: this.newTodo.dueDate ? Timestamp.fromDate(new Date(this.newTodo.dueDate)) : null,
        completed: false,
        completedAt: null,
        projectId: this.projectId,
        projectTitle: this.projectTitle,
        issueId: this.issueId || '', // 課題作成前は空文字列
        issueTitle: this.title,
        createdAt: now,
        updatedAt: now
      };

      // 一時的なtodosリストに追加
      this.todos.push(newTodo);

      // フォームをリセット
      this.newTodo = {
        title: '',
        assignee: '',
        dueDate: ''
      };

      this.message = '';
    } catch (error) {
      console.error('Error adding todo:', error);
      this.message = 'Todoの追加に失敗しました。';
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

      // 一時的なTodoリストをFirestoreに保存
      if (this.todos.length > 0) {
        const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
        const todoPromises = this.todos.map(async (todo) => {
          const todoData = {
            title: todo.title,
            assignee: todo.assignee,
            dueDate: todo.dueDate ? (todo.dueDate instanceof Timestamp ? todo.dueDate : Timestamp.fromDate(todo.dueDate)) : null,
            completed: false,
            completedAt: null,
            projectId: this.projectId,
            projectTitle: this.projectTitle,
            issueId: this.issueId,
            issueTitle: this.title,
            createdAt: now,
            updatedAt: now
          };
          await addDoc(todosRef, todoData);
        });

        await Promise.all(todoPromises);
      }

      this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('Error creating issue:', error);
      this.message = '課題の作成に失敗しました。';
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

  async saveIssue() {
    if (!this.projectId || !this.title) {
      this.message = '必須項目を入力してください。';
      return;
    }

    this.isSaving = true;
    try {
      await this.createIssue();
      this.isSaving = false;
    } catch (error) {
      console.error('Error saving issue:', error);
      this.message = '課題の保存に失敗しました。';
      this.isSaving = false;
    }
  }
} 