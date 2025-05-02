import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, User } from '@angular/fire/auth';
import { addDays, startOfWeek } from 'date-fns';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

interface Project {
  id: string;
  title: string;
  description: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CalendarDay {
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
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

  constructor(
    private router: Router,
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.displayYear = this.currentYear;
    this.displayMonth = this.currentMonth;
    this.generateCalendar();
  }

  async fetchUserProjects(userId: string) {
    try {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(projectsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      this.userProjects = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data()['createdAt']?.toDate(),
        updatedAt: doc.data()['updatedAt']?.toDate()
      })) as Project[];
      
      console.log('Fetched projects:', this.userProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }

  ngOnInit() {
    // 認証状態の監視を開始
    this.auth.onAuthStateChanged(user => {
      this.currentUser = user;
      if (!user) {
        // 未認証の場合はログイン画面にリダイレクト
        this.router.navigate(['/login']);
      } else {
        // ユーザーが認証されている場合、プロジェクトを取得
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
        fullDate: new Date(this.displayYear, this.displayMonth - 1, prevMonthLastDate - i),
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
} 