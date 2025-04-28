import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, query, where } from '@angular/fire/firestore';
import { from, Observable, BehaviorSubject, combineLatest, map, switchMap, of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css']
})
export class ProjectListComponent {
  projects$: Observable<any[]>;
  sortedProjects$: Observable<any[]>;

  // ソート条件
  sortField$ = new BehaviorSubject<'createdAt' | 'dueDate'>('createdAt');
  sortOrder$ = new BehaviorSubject<'asc' | 'desc'>('asc');

  constructor(private firestore: Firestore, private authService: AuthService) {
    this.projects$ = this.authService.user$.pipe(
      map(user => user?.uid),
      // UIDが取得できたらクエリ実行
      // switchMapでObservableを入れ替え
      switchMap(uid => {
        if (!uid) return of([]);
        const projectsRef = collection(this.firestore, 'projects');
        const q = query(projectsRef, where('members', 'array-contains', uid));
        return from(getDocs(q).then(async snapshot => {
          const projects: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // displayName取得ロジックはそのまま
          const projectsWithDisplayName = await Promise.all(projects.map(async project => {
            if (project.createdBy) {
              const userDoc = doc(this.firestore, 'users', project.createdBy);
              const userSnap = await getDoc(userDoc);
              return {
                ...project,
                creatorName: userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name',
              };
            } else {
              return { ...project, creatorName: 'no name' };
            }
          }));
          return projectsWithDisplayName;
        }));
      })
    );

    this.sortedProjects$ = combineLatest([
      this.projects$,
      this.sortField$,
      this.sortOrder$
    ]).pipe(
      map(([projects, field, order]) => {
        return [...projects].sort((a, b) => {
          // 締切日時ソート時はnullを常に下に
          if (field === 'dueDate') {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
          }
          const aValue = a[field];
          const bValue = b[field];
          // Firestore Timestamp型やISO文字列対応
          const aTime = aValue && aValue.toDate ? aValue.toDate().getTime() : (aValue ? new Date(aValue).getTime() : 0);
          const bTime = bValue && bValue.toDate ? bValue.toDate().getTime() : (bValue ? new Date(bValue).getTime() : 0);
          return order === 'asc' ? aTime - bTime : bTime - aTime;
        });
      })
    );
  }

  setSort(field: 'createdAt' | 'dueDate') {
    if (this.sortField$.value === field) {
      // 同じフィールドなら昇順/降順をトグル
      this.sortOrder$.next(this.sortOrder$.value === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField$.next(field);
      this.sortOrder$.next('asc');
    }
  }

  formatDate(ts: any): string {
    if (!ts) return '';
    let date: Date;
    // Firestore Timestamp型の場合
    if (ts.toDate) {
      try {
        date = ts.toDate();
      } catch {
        return String(ts);
      }
    } else if (ts instanceof Date) {
      date = ts;
    } else if (typeof ts === 'number') {
      date = new Date(ts * 1000);
    } else {
      date = new Date(ts);
    }
    // YYYY/MM/DD HH:mm 形式で返す
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }
} 