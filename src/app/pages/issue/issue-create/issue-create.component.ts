import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-issue-create',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './issue-create.component.html',
  styleUrls: ['./issue-create.component.css']
})
export class IssueCreateComponent {
  projectId: string | null = null;
  issueId: string | null = null;
  projectMembers: string[] = [];
  memberDetails: User[] = [];

  // フォーム入力値
  title = '';
  startDate: string | null = null;
  dueDate: string | null = null;
  assignee = '';
  priority = '';
  memo = '';
  isSaving = false;
  message = '';

  // Todo関連
  newTodo: Todo = {
    title: '',
    dueDate: null,
    assignee: '',
    completed: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  todos: Todo[] = [];

  constructor(private route: ActivatedRoute, private firestore: Firestore, private router: Router) {
    this.route.queryParamMap.subscribe(params => {
      this.projectId = params.get('projectId');
      if (this.projectId) {
        this.loadProjectMembers();
      }
    });
  }

  // プロジェクトメンバーを取得
  async loadProjectMembers() {
    if (!this.projectId) return;
    try {
      const projectRef = doc(this.firestore, `projects/${this.projectId}`);
      const projectDoc = await getDoc(projectRef);
      if (projectDoc.exists()) {
        const data = projectDoc.data();
        this.projectMembers = data['members'] || [];
        await this.loadMemberDetails();
      }
    } catch (error) {
      console.error('Error loading project members:', error);
    }
  }

  // メンバーの詳細情報を取得
  async loadMemberDetails() {
    try {
      this.memberDetails = [];
      for (const uid of this.projectMembers) {
        const userRef = doc(this.firestore, `users/${uid}`);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          this.memberDetails.push({
            uid: uid,
            displayName: userData.displayName,
            email: userData.email
          });
        }
      }
    } catch (error) {
      console.error('Error loading member details:', error);
    }
  }

  // ユーザーIDからdisplayNameを取得
  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member ? member.displayName : uid;
  }

  // Todoを追加
  async addTodo() {
    if (!this.newTodo.title.trim() || !this.newTodo.assignee || !this.projectId) {
      return;
    }

    try {
      // まだissueが作成されていない場合は、先にissueを作成
      if (!this.issueId) {
        const issuesRef = collection(this.firestore, `projects/${this.projectId}/issues`);
        const issueDoc = await addDoc(issuesRef, {
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
        this.issueId = issueDoc.id;
      }

      // Todoをサブコレクションとして保存
      const now = Timestamp.now();
      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const todoData = {
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: this.newTodo.dueDate,
        completed: false,
        createdAt: now,
        updatedAt: now
      };
      await addDoc(todosRef, todoData);

      // UIに表示するTodoリストを更新
      const todo: Todo = {
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: this.newTodo.dueDate,
        completed: false,
        createdAt: now,
        updatedAt: now
      };
      this.todos.push(todo);
      this.resetTodoForm();

    } catch (error) {
      console.error('Error adding todo:', error);
      this.message = 'Todoの保存に失敗しました。';
    }
  }

  // Todo入力フォームをリセット
  resetTodoForm() {
    const now = Timestamp.now();
    this.newTodo = {
      title: '',
      dueDate: null,
      assignee: '',
      completed: false,
      createdAt: now,
      updatedAt: now
    };
  }

  // Todoを削除
  async removeTodo(index: number) {
    // UIからTodoを削除
    this.todos.splice(index, 1);
  }

  // Todoの完了状態を切り替え
  toggleTodo(index: number) {
    this.todos[index].completed = !this.todos[index].completed;
  }

  async saveIssue() {
    if (!this.projectId) return;
    this.isSaving = true;
    this.message = '';
    try {
      if (!this.issueId) {
        // まだissueが作成されていない場合は新規作成
        const issuesRef = collection(this.firestore, `projects/${this.projectId}/issues`);
        const issueData = {
          title: this.title,
          startDate: this.startDate ? Timestamp.fromDate(new Date(this.startDate)) : null,
          dueDate: this.dueDate ? Timestamp.fromDate(new Date(this.dueDate)) : null,
          assignee: this.assignee,
          priority: this.priority,
          memo: this.memo,
          status: '未着手',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        await addDoc(issuesRef, issueData);
        this.issueId = issueData.title;
      } else {
        // 既にissueが作成されている場合は更新
        const issueRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}`);
        await updateDoc(issueRef, {
          title: this.title,
          startDate: this.startDate ? Timestamp.fromDate(new Date(this.startDate)) : null,
          dueDate: this.dueDate ? Timestamp.fromDate(new Date(this.dueDate)) : null,
          assignee: this.assignee,
          priority: this.priority,
          memo: this.memo,
          updatedAt: Timestamp.now(),
        });
      }
      this.router.navigate(['/projects', this.projectId]);
    } catch {
      this.message = '保存に失敗しました。';
    } finally {
      this.isSaving = false;
    }
  }
} 