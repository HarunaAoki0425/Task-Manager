import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, getDocs, Timestamp, doc, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

interface Issue {
  id: string;
  issueTitle: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  createdAt: Timestamp;
  priority?: string;
  status?: string;
  assignees?: string[];
  projectColor?: string;
  projectId?: string;
  // 必要に応じて他のフィールドも追加
}

interface Todo {
  id: string;
  todoTitle: string;
  todoDueDate: Timestamp;
  completed: boolean;
  completedAt?: Timestamp | null;
  projectColor?: string;
  projectId?: string;
  issueId?: string;
  assignee: string;
  // 必要に応じて他のフィールドも追加
}

@Component({
  selector: 'app-calendar-day',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-day.component.html',
  styleUrls: ['./calendar-day.component.css']
})
export class CalendarDayComponent implements OnInit {
  selectedDate: string | null = null;
  selectedDateObj: Date | null = null;
  issues: Issue[] = [];
  todos: Todo[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private firestore: Firestore, private router: Router, private auth: Auth) {}

  ngOnInit() {
    this.selectedDate = this.route.snapshot.paramMap.get('date');
    if (this.selectedDate) {
      const [year, month, day] = this.selectedDate.split('-').map(Number);
      this.selectedDateObj = new Date(year, month - 1, day);
      this.fetchIssuesAndTodos();
    } else {
      this.isLoading = false;
    }
  }

  async fetchIssuesAndTodos() {
    if (!this.selectedDateObj) return;
    this.isLoading = true;
    try {
      // 日付の0:00:00と23:59:59を作成
      const startOfDay = new Date(this.selectedDateObj.getFullYear(), this.selectedDateObj.getMonth(), this.selectedDateObj.getDate(), 0, 0, 0);
      const endOfDay = new Date(this.selectedDateObj.getFullYear(), this.selectedDateObj.getMonth(), this.selectedDateObj.getDate(), 23, 59, 59);
      const tsStart = Timestamp.fromDate(startOfDay);
      const tsEnd = Timestamp.fromDate(endOfDay);

      // 現在のユーザーIDを取得
      const userId = this.auth.currentUser?.uid;
      if (!userId) {
        this.isLoading = false;
        this.error = 'ユーザー情報が取得できませんでした。';
        return;
      }

      // 自分がメンバーのプロジェクトのみ取得
      const projectsRef = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsRef, where('members', 'array-contains', userId));
      const projectsSnapshot = await getDocs(projectsQuery);
      let allIssues: Issue[] = [];
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectColor = projectDoc.data()['color'] || '#e3f2fd';
        const issuesCol = collection(this.firestore, `projects/${projectId}/issues`);
        const q = query(issuesCol,
          where('startDate', '<=', tsEnd),
          where('dueDate', '>=', tsStart)
        );
        const issuesSnapshot = await getDocs(q);
        allIssues.push(...issuesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          projectColor,
          projectId
        }) as Issue));
      }
      this.issues = allIssues.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

      // ToDo: dueDate == selectedDate
      let allTodos: Todo[] = [];
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectColor = projectDoc.data()['color'] || '#e3f2fd';
        const issuesCol = collection(this.firestore, `projects/${projectId}/issues`);
        const issuesSnapshot = await getDocs(issuesCol);
        for (const issueDoc of issuesSnapshot.docs) {
          const todosCol = collection(this.firestore, `projects/${projectId}/issues/${issueDoc.id}/todos`);
          const q = query(todosCol, where('todoDueDate', '>=', tsStart), where('todoDueDate', '<=', tsEnd));
          const todosSnapshot = await getDocs(q);
          allTodos.push(...todosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            projectColor,
            projectId,
            issueId: issueDoc.id
          }) as Todo));
        }
      }
      this.todos = allTodos.filter(todo => todo.assignee === userId);
      this.isLoading = false;
    } catch (error) {
      console.error('Firestore取得エラー:', error);
      this.error = 'データの取得に失敗しました。';
      this.isLoading = false;
    }
  }

  get incompleteTodos(): Todo[] {
    return this.todos
      .filter(t => !t.completed)
      .sort((a, b) => a.todoDueDate.toDate().getTime() - b.todoDueDate.toDate().getTime());
  }

  async toggleTodoComplete(todo: Todo) {
    if (!todo.id) return;
    try {
      // プロジェクトIDとissueIDを取得（ToDoに含まれていない場合は拡張が必要）
      const projectId = (todo as any).projectId;
      const issueId = (todo as any).issueId;
      if (!projectId || !issueId) return;
      const todoRef = doc(this.firestore, `projects/${projectId}/issues/${issueId}/todos/${todo.id}`);
      const newCompleted = !todo.completed;
      await updateDoc(todoRef, {
        completed: newCompleted,
        completedAt: newCompleted ? Timestamp.now() : null,
        updatedAt: Timestamp.now()
      });
      todo.completed = newCompleted;
      todo.completedAt = newCompleted ? Timestamp.now() : null;
    } catch (error) {
      console.error('ToDo完了状態の更新エラー:', error);
    }
  }

  goToIssueDetail(issue: Issue) {
    // issueにprojectIdが含まれていない場合は取得方法を調整してください
    const projectId = (issue as any).projectId;
    if (projectId && issue.id) {
      this.router.navigate(['/projects', projectId, 'issues', issue.id]);
    }
  }

  goToCalendar() {
    this.router.navigate(['/calendar']);
  }
}
