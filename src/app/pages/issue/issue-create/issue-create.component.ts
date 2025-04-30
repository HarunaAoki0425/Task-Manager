import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';
import { ProjectService } from '../../../services/project.service';

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
    projectId: '',
    projectTitle: '',
    issueId: '',
    issueTitle: '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  todos: Todo[] = [];

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private projectService: ProjectService
  ) {
    this.route.paramMap.subscribe(params => {
      this.projectId = params.get('projectId');
      console.log('Constructor - Retrieved projectId:', this.projectId);
      if (this.projectId) {
        this.loadProjectMembers();
      } else {
        console.error('No projectId found in route parameters');
      }
    });
  }

  async onAssigneeInteraction() {
    console.log('Assignee field interacted');
    console.log('Current projectId:', this.projectId);
    console.log('Current memberDetails:', this.memberDetails);
    await this.loadProjectMembers();
    console.log('Updated memberDetails:', this.memberDetails);
  }

  // プロジェクトメンバーを取得
  async loadProjectMembers() {
    console.log('loadProjectMembers called');
    if (!this.projectId) {
      console.log('No projectId available');
      return;
    }
    try {
      console.log('Fetching members for project:', this.projectId);
      this.memberDetails = await this.projectService.getProjectMembers(this.projectId);
      console.log('Fetched members:', this.memberDetails);
    } catch (error) {
      console.error('Error loading project members:', error);
    }
  }

  // ユーザーIDからdisplayNameを取得
  getMemberDisplayName(uid: string): string {
    const member = this.memberDetails.find(m => m.uid === uid);
    return member ? member.displayName : uid;
  }

  // Todo入力フォームをリセット
  resetTodoForm() {
    const now = Timestamp.now();
    this.newTodo = {
      title: '',
      dueDate: null,
      assignee: '',
      completed: false,
      projectId: this.projectId || '',
      projectTitle: '',  // プロジェクトのタイトルは後で設定
      issueId: this.issueId || '',
      issueTitle: this.title,  // 現在の課題のタイトル
      createdAt: now,
      updatedAt: now
    };
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
        const issueDocRef = await addDoc(issuesRef, issueData);
        this.issueId = issueDocRef.id;
      }

      // プロジェクト情報を取得
      const projectRef = doc(this.firestore, `projects/${this.projectId}`);
      const projectSnap = await getDoc(projectRef);
      const projectTitle = projectSnap.exists() ? projectSnap.data()['title'] || '' : '';

      // Todoをサブコレクションとして保存
      const now = Timestamp.now();
      const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
      const todoData: Omit<Todo, 'id'> = {
        title: this.newTodo.title,
        assignee: this.newTodo.assignee,
        dueDate: typeof this.newTodo.dueDate === 'string' ? Timestamp.fromDate(new Date(this.newTodo.dueDate)) : this.newTodo.dueDate,
        completed: false,
        projectId: this.projectId,
        projectTitle: projectTitle,
        issueId: this.issueId,
        issueTitle: this.title,
        createdAt: now,
        updatedAt: now
      };

      // FirestoreにTodoを保存
      const todoDocRef = await addDoc(todosRef, todoData);

      // UIに表示するTodoリストを更新
      const todo: Todo = {
        id: todoDocRef.id,
        ...todoData
      };
      this.todos.push(todo);
      this.resetTodoForm();

    } catch (error) {
      console.error('Error adding todo:', error);
      this.message = 'Todoの保存に失敗しました。';
    }
  }

  // Todoを削除
  async removeTodo(index: number) {
    if (!this.projectId || !this.issueId || !this.todos[index].id) return;

    try {
      // FirestoreからTodoを削除
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${this.todos[index].id}`);
      await deleteDoc(todoRef);

      // UIからTodoを削除
      this.todos.splice(index, 1);
    } catch (error) {
      console.error('Error removing todo:', error);
      this.message = 'Todoの削除に失敗しました。';
    }
  }

  // Todoの完了状態を切り替え
  async toggleTodo(index: number) {
    if (!this.projectId || !this.issueId || !this.todos[index].id) return;

    try {
      const todo = this.todos[index];
      const newCompletedState = !todo.completed;
      
      // Firestoreのデータを更新
      const todoRef = doc(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos/${todo.id}`);
      await updateDoc(todoRef, {
        completed: newCompletedState,
        updatedAt: Timestamp.now()
      });

      // UIの状態を更新
      todo.completed = newCompletedState;
    } catch (error) {
      console.error('Error toggling todo:', error);
      this.message = 'Todoの状態更新に失敗しました。';
    }
  }

  async saveIssue() {
    if (!this.projectId) return;
    this.isSaving = true;
    this.message = '';
    try {
      // issueが未作成の場合のみ作成（todoの追加時に既に作成されている可能性がある）
      if (!this.issueId) {
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
        const issueDocRef = await addDoc(issuesRef, issueData);
        this.issueId = issueDocRef.id;

        // todoコレクションを作成（空のドキュメントを追加して削除することでコレクションを作成）
        const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${this.issueId}/todos`);
        const tempTodoRef = await addDoc(todosRef, {
          title: 'temp',
          createdAt: Timestamp.now()
        });
        await deleteDoc(tempTodoRef);

      } else {
        // issueが既に存在する場合は更新
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

      // 保存完了後、プロジェクト詳細画面に戻る
      this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('Error saving issue:', error);
      this.message = '保存に失敗しました。';
    } finally {
      this.isSaving = false;
    }
  }
} 