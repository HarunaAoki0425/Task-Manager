import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { addDays, startOfWeek } from 'date-fns';
import { Firestore, collection, query, where, getDocs, doc, getDoc, Timestamp, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

interface Project {
  id: string;
  title: string;
  description: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Issue {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  assignees: string[];
  priority: string;
  status: string;
  color?: string;  // プロジェクトから継承した色
}

interface CalendarDay {
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean;
}

interface Todo {
  id: string;
  title: string;
  dueDate: Timestamp;
  completed: boolean;
  completedAt: Timestamp | null;
  assignee: string;
  projectId: string;
  projectTitle: string;
  issueId: string;
  issueTitle: string;
  color?: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit {
  currentDate = new Date();
  currentYear = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth() + 1; // JavaScriptの月は0から始まるので+1
  currentDay = this.currentDate.getDate();
  displayYear: number;
  displayMonth: number;
  calendarDays: CalendarDay[] = [];
  selectedDate: { year: number; month: number; day: number } | null = null;
  currentUser: User | null = null;
  userProjects: Project[] = [];
  userIssues: Issue[] = [];
  userTodos: Todo[] = [];
  selectedProjectId: string | null = null;
  contentFilter: 'all' | 'issue' | 'todo' = 'all';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.displayYear = this.currentYear;
    this.displayMonth = this.currentMonth;
    this.generateCalendar();
  }

  async fetchAllProjectTodos() {
    try {
      this.userTodos = [];
      
      // 各プロジェクトのTodoを取得
      for (const project of this.userProjects) {
        // 各プロジェクトの課題を取得
        const issuesRef = collection(this.firestore, `projects/${project.id}/issues`);
        const issuesSnapshot = await getDocs(issuesRef);

        console.log(`Fetching todos for project: ${project.title}`);

        // 各課題のTodoを取得
        for (const issueDoc of issuesSnapshot.docs) {
          const todosRef = collection(this.firestore, `projects/${project.id}/issues/${issueDoc.id}/todos`);
          const todosSnapshot = await getDocs(todosRef);
          
          const issueTodos = todosSnapshot.docs.map(doc => {
            const todoData = doc.data();
            return {
              id: doc.id,
              ...todoData,
              projectId: project.id,
              projectTitle: project.title,
              issueId: issueDoc.id,
              issueTitle: issueDoc.data()['title'],
              color: issueDoc.data()['color'] // 課題の色を継承
            };
          }) as Todo[];

          console.log(`Found ${issueTodos.length} todos for issue: ${issueDoc.data()['title']}`);
          this.userTodos.push(...issueTodos);
        }
      }

      console.log('Total todos fetched:', this.userTodos.length);
      console.log('Sample todo:', this.userTodos[0]);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  }

  async fetchUserProjects(userId: string) {
    try {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(projectsRef, 
        where('members', 'array-contains', userId)
      );
      const querySnapshot = await getDocs(q);
      
      this.userProjects = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data()['createdAt']?.toDate(),
        updatedAt: doc.data()['updatedAt']?.toDate()
      })) as Project[];
      
      await this.fetchAllProjectIssues();
      await this.fetchAllProjectTodos();  // Todoも取得
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }

  async fetchAllProjectIssues() {
    try {
      this.userIssues = [];
      
      // 各プロジェクトのissueを取得
      for (const project of this.userProjects) {
        // プロジェクトの色を取得
        const projectRef = doc(this.firestore, 'projects', project.id);
        const projectSnap = await getDoc(projectRef);
        const projectColor = projectSnap.exists() ? projectSnap.data()['color'] : null;

        const issuesRef = collection(this.firestore, `projects/${project.id}/issues`);
        const issuesSnapshot = await getDocs(issuesRef);
        
        // 各issueのデータを取得して配列に追加
        const projectIssues = issuesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            projectId: project.id,
            projectTitle: project.title,
            color: projectColor,  // プロジェクトの色を設定
            ...data
          };
        }) as Issue[];

        this.userIssues.push(...projectIssues);
      }
      
      // カレンダーを再生成して課題を表示
      this.generateCalendar();
    } catch (error) {
      console.error('Error fetching issues:', error);
    }
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const year = params.get('year');
      const month = params.get('month');
      if (year && month) {
        this.displayYear = +year;
        this.displayMonth = +month;
        this.generateCalendar();
      } else {
        this.displayYear = this.currentYear;
        this.displayMonth = this.currentMonth;
        this.generateCalendar();
      }
    });

    this.auth.onAuthStateChanged(user => {
      this.currentUser = user;
      if (!user) {
        this.router.navigate(['/login']);
      } else {
        this.fetchUserProjects(user.uid);
      }
    });
  }

  generateCalendar(): void {
    this.calendarDays = [];
    
    // 月の最初の日の曜日を取得（0: 日曜日, 6: 土曜日）
    const firstDay = new Date(this.displayYear, this.displayMonth - 1, 1).getDay();
    
    // 前月の最終日を取得
    const prevMonthLastDate = new Date(this.displayYear, this.displayMonth - 1, 0).getDate();
    
    // 現在の月の最終日を取得
    const lastDate = new Date(this.displayYear, this.displayMonth, 0).getDate();
    
    // 現在の月の最終日の曜日を取得（0: 日曜日, 6: 土曜日）
    const lastDay = new Date(this.displayYear, this.displayMonth - 1, lastDate).getDay();
    
    // 前月の日付を追加
    for (let i = firstDay - 1; i >= 0; i--) {
      this.calendarDays.push({
        date: prevMonthLastDate - i,
        fullDate: new Date(this.displayYear, this.displayMonth - 2, prevMonthLastDate - i),
        isCurrentMonth: false
      });
    }
    
    // 現在の月の日付を追加
    for (let i = 1; i <= lastDate; i++) {
      this.calendarDays.push({
        date: i,
        fullDate: new Date(this.displayYear, this.displayMonth - 1, i),
        isCurrentMonth: true
      });
    }
    
    // 次月の日付を追加（最終日が土曜日でない場合のみ）
    if (lastDay !== 6) {
      for (let i = 1; i <= 6 - lastDay; i++) {
        this.calendarDays.push({
          date: i,
          fullDate: new Date(this.displayYear, this.displayMonth, i),
          isCurrentMonth: false
        });
      }
    }
  }

  isCurrentDay(day: CalendarDay): boolean {
    return day.date === this.currentDay && 
           this.displayYear === this.currentYear && 
           this.displayMonth === this.currentMonth &&
           day.isCurrentMonth;
  }

  isSelectedDay(day: CalendarDay): boolean {
    return this.selectedDate !== null &&
           day.date === this.selectedDate.day &&
           this.displayYear === this.selectedDate.year &&
           this.displayMonth === this.selectedDate.month &&
           day.isCurrentMonth;
  }

  selectDay(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.selectedDate = {
        year: this.displayYear,
        month: this.displayMonth,
        day: day.date
      };
    }
  }

  previousMonth(): void {
    if (this.displayMonth === 1) {
      this.displayMonth = 12;
      this.displayYear--;
    } else {
      this.displayMonth--;
    }
    this.generateCalendar();
  }

  nextMonth(): void {
    if (this.displayMonth === 12) {
      this.displayMonth = 1;
      this.displayYear++;
    } else {
      this.displayMonth++;
    }
    this.generateCalendar();
  }

  goToToday(): void {
    this.displayYear = this.currentYear;
    this.displayMonth = this.currentMonth;
    this.selectedDate = {
      year: this.currentYear,
      month: this.currentMonth,
      day: this.currentDay
    };
    this.generateCalendar();
  }

  getFilteredProjects(): Project[] {
    return this.userProjects;
  }

  getFilteredIssues(): Issue[] {
    if (!this.selectedProjectId) return this.userIssues;
    return this.userIssues.filter(issue => issue.projectId === this.selectedProjectId);
  }

  getFilteredTodos(): Todo[] {
    if (!this.selectedProjectId) return this.userTodos;
    return this.userTodos.filter(todo => todo.projectId === this.selectedProjectId);
  }

  // 指定された日付に関連する課題を取得するメソッド
  getIssuesForDate(date: Date): Issue[] {
    return this.getFilteredIssues().filter(issue => {
      const startDate = issue.startDate?.toDate();
      const dueDate = issue.dueDate?.toDate();
      if (!startDate || !dueDate) return false;
      const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const compareStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const compareDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      return compareDate >= compareStartDate && compareDate <= compareDueDate;
    });
  }

  // 指定された日付のTodoを取得するメソッド
  getTodosForDate(date: Date): Todo[] {
    const todos = this.getFilteredTodos().filter(todo => {
      if (!todo.dueDate) {
        console.log('Todo without dueDate:', todo);
        return false;
      }
      if (todo.completed) return false;
      if (!this.currentUser || todo.assignee !== this.currentUser.uid) return false;
      const dueDate = todo.dueDate.toDate();
      const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const compareDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const matches = compareDate.getTime() === compareDueDate.getTime();
      if (matches) {
        console.log('Found todo for date:', date, todo);
      }
      return matches;
    });
    return todos;
  }

  async toggleTodoComplete(todo: any) {
    try {
      const newCompleted = !todo.completed;
      const todoRef = doc(this.firestore, `projects/${todo.projectId}/issues/${todo.issueId}/todos/${todo.id}`);
      await updateDoc(todoRef, {
        completed: newCompleted,
        completedAt: newCompleted ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      // ローカルの状態も更新
      todo.completed = newCompleted;
      todo.completedAt = newCompleted ? new Date() : null;
    } catch (error) {
      console.error('Error updating todo completion status:', error);
    }
  }

  goToDayView(day: CalendarDay): void {
    const y = day.fullDate.getFullYear();
    const m = (day.fullDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.fullDate.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    this.router.navigate(['/calendar/day', dateStr]);
  }

  getDayHeaderClass(day: CalendarDay): string {
    const weekday = day.fullDate.getDay();
    switch (weekday) {
      case 0: return 'weekday-sun'; // 日曜
      case 6: return 'weekday-sat'; // 土曜
      default: return 'weekday-weekday'; // 平日
    }
  }
} 