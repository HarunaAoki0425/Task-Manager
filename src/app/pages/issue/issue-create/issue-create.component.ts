import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, Timestamp, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';
import { Auth } from '@angular/fire/auth';

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
  assignees: string[] = [];
  priority = 'medium';
  memo = '';
  message = '';
  projectTitle = '';
  isSaving = false;
  memberDetails: User[] = [];
  todos: Todo[] = [];

  newTodo = {
    todoTitle: '',
    assignee: '',
    todoDueDate: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private auth: Auth
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
    if (!this.projectId || !this.newTodo.todoTitle || !this.newTodo.assignee || !this.newTodo.todoDueDate) {
      this.message = 'タイトル、締切日時、担当者は必須です。';
      return;
    }

    try {
      // プロジェクトの色を取得
      const projectRef = doc(this.firestore, 'projects', this.projectId);
      const projectSnap = await getDoc(projectRef);
      const projectColor = projectSnap.exists() ? projectSnap.data()['color'] : null;

      // 一時的なTodoオブジェクトを作成
      const now = Timestamp.now();
      const newTodo: Todo = {
        id: `temp_${Date.now()}`, // 一時的なID
        todoTitle: this.newTodo.todoTitle,
        assignee: this.newTodo.assignee,
        todoDueDate: Timestamp.fromDate(new Date(this.newTodo.todoDueDate)), // 必須項目なのでnullチェック不要
        completed: false,
        completedAt: null,
        projectId: this.projectId,
        projectTitle: this.projectTitle,
        issueId: this.issueId || '', // 課題作成前は空文字列
        issueTitle: this.title,
        createdAt: now,
        updatedAt: now,
        color: projectColor // プロジェクトの色を設定
      };

      // 一時的なtodosリストに追加
      this.todos.push(newTodo);

      // フォームをリセット
      this.newTodo = {
        todoTitle: '',
        assignee: '',
        todoDueDate: ''
      };

      this.message = '';
    } catch (error) {
      console.error('Error adding todo:', error);
      this.message = 'Todoの追加に失敗しました。';
    }
  }

  async createIssue() {
    if (!this.projectId || !this.title || !this.startDate || !this.dueDate) {
      this.message = 'タイトル、開始日、期限日は必須項目です。';
      return;
    }
    if (this.dueDate < this.startDate) {
      this.message = '期限日は開始日以降の日付を選択してください。';
      return;
    }

    try {
      // プロジェクトの色を取得
      const projectRef = doc(this.firestore, 'projects', this.projectId);
      const projectSnap = await getDoc(projectRef);
      const projectColor = projectSnap.exists() ? projectSnap.data()['color'] : null;

      const now = Timestamp.now();
      let projectMembers: string[] = [];
      if (projectSnap.exists()) {
        projectMembers = projectSnap.data()['members'] || [];
      }
      const currentUserId = this.auth.currentUser?.uid || '';
      const issueData = {
        issueTitle: this.title,
        startDate: Timestamp.fromDate(new Date(this.startDate)),
        dueDate: Timestamp.fromDate(new Date(this.dueDate)),
        assignees: this.assignees.length > 0 ? this.assignees : ['unassigned'],
        priority: this.priority,
        memo: this.memo,
        status: '未着手',
        createdAt: now,
        updatedAt: now,
        color: projectColor,
        members: projectMembers,
        createdBy: currentUserId
      };

      const issuesRef = collection(this.firestore, `projects/${this.projectId}/issues`);
      const issueDocRef = await addDoc(issuesRef, issueData);
      this.issueId = issueDocRef.id;

      // recipients: 担当者から課題作成者（currentUserId）を除外
      const recipients = this.assignees.filter(uid => uid !== currentUserId);
      if (recipients.length > 0) {
        const notificationsRef = collection(this.firestore, 'notifications');
        for (const recipient of recipients) {
          await addDoc(notificationsRef, {
            projectId: this.projectId,
            issueId: issueDocRef.id,
            issueTitle: this.title,
            createdAt: now,
            read: false,
            recipients: [recipient],
            message: `課題「${this.title}」の担当者に選ばれました。`
          });
        }
      }

      // 一時的なTodoリストをFirestoreに保存
      if (this.todos.length > 0) {
        console.log('保存前のToDoリスト:', this.todos);
        const saveTodoPromises = this.todos.map(todo => {
          // idフィールドを除外
          const { id, ...todoWithoutId } = todo;
          const todoData = {
            ...todoWithoutId,
            issueId: issueDocRef.id,
            issueTitle: this.title,
            assignee: todo.assignee || 'unassigned',
            color: projectColor,
            todoDueDate: todo.todoDueDate instanceof Timestamp
              ? todo.todoDueDate
              : Timestamp.fromDate(new Date(todo.todoDueDate as any))
          };
          const todosRef = collection(this.firestore, `projects/${this.projectId}/issues/${issueDocRef.id}/todos`);
          return addDoc(todosRef, todoData);
        });

        await Promise.all(saveTodoPromises);

        // Todoごとに通知を作成
        for (const todo of this.todos) {
          const assignee = todo.assignee;
          if (assignee && assignee !== currentUserId && assignee !== 'unassigned') {
            const notificationsRef = collection(this.firestore, 'notifications');
            await addDoc(notificationsRef, {
              projectId: this.projectId,
              issueId: issueDocRef.id,
              issueTitle: this.title,
              createdAt: now,
              read: false,
              recipients: [assignee],
              message: `課題「${this.title}」のToDo「${todo.todoTitle}」の担当者に選ばれました。`
            });
          }
        }
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
    if (!this.projectId || !this.title || !this.startDate || !this.dueDate) {
      this.message = 'タイトル、開始日、期限日は必須項目です。';
      return;
    }

    this.isSaving = true;
    try {
      await this.createIssue();
      this.router.navigate(['/projects', this.projectId]);
    } catch (error) {
      console.error('Error saving issue:', error);
      this.message = '課題の保存中にエラーが発生しました。';
    } finally {
      this.isSaving = false;
    }
  }

  toggleAssignee(uid: string) {
    const index = this.assignees.indexOf(uid);
    if (index === -1) {
      this.assignees.push(uid);
    } else {
      this.assignees.splice(index, 1);
    }
  }

  isAssigneeSelected(uid: string): boolean {
    return this.assignees.includes(uid);
  }

  onBack() {
    if (confirm('課題は保存されませんが、戻ってもよろしいですか？')) {
      if (this.projectId) {
        this.router.navigate(['/projects', this.projectId]);
      } else {
        this.router.navigate(['/projects']);
      }
    }
  }
} 