import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
  setDoc
} from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';
import { TodoService } from '../../services/todo.service';
import { ProjectService } from '../../services/project.service';
import { Subscription } from 'rxjs';
import { Todo } from '../../models/todo.model';
import { User } from '../../models/user.model';

interface ProjectData {
  id: string;
  name?: string;
  title?: string;
  createdBy: string;
  members: string[];
  isArchived?: boolean;
  [key: string]: any;
}

interface IssueData {
  id: string;
  title: string;
  [key: string]: any;
}

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.scss']
})
export class ArchiveComponent implements OnInit, OnDestroy {
  archives: any[] = [];
  isLoading = true;
  archivedProjects: any[] = [];
  completedTodos: Todo[] = [];
  memberDetails: { [key: string]: User } = {};
  error: string | null = null;
  private authSubscription: Subscription;

  constructor(private firestore: Firestore, private auth: AuthService, private todoService: TodoService, private projectService: ProjectService) {
    this.authSubscription = this.auth.user$.subscribe(user => {
      if (user) {
        this.loadArchives();
        this.loadCompletedTodos();
      } else {
        this.archives = [];
        this.completedTodos = [];
        this.error = 'ログインが必要です';
      }
    });
  }

  ngOnInit(): void {
    this.loadCompletedTodos();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async loadArchives() {
    this.isLoading = true;
    try {
      const currentUser = this.auth.getCurrentUser();
      if (!currentUser) {
        this.error = 'ログインが必要です';
        return;
      }

      const archivesRef = collection(this.firestore, 'archives');
      const q = query(archivesRef, 
        where('members', 'array-contains', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      this.archives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.error = null;
    } catch (e) {
      console.error('Error loading archives:', e);
      this.error = 'アーカイブの読み込みに失敗しました。';
      this.archives = [];
    } finally {
      this.isLoading = false;
    }
  }

  async loadCompletedTodos(): Promise<void> {
    try {
      this.completedTodos = await this.todoService.getCompletedTodos();
    } catch (error) {
      console.error('Error loading completed todos:', error);
    }
  }

  getMemberName(uid: string): string {
    return this.memberDetails[uid]?.displayName || '未割り当て';
  }

  async restoreTodo(todo: Todo) {
    if (!todo.id || !todo.projectId || !todo.issueId) return;
    
    try {
      // 元のTodoの場所に復元
      const todoRef = doc(this.firestore, `projects/${todo.projectId}/issues/${todo.issueId}/todos/${todo.id}`);
      await setDoc(todoRef, {
        ...todo,
        completed: false,
        completedAt: null,
        updatedAt: Timestamp.now()
      });

      // UIを更新
      this.completedTodos = this.completedTodos.filter(t => t.id !== todo.id);
    } catch (e) {
      console.error('Error restoring todo:', e);
      this.error = 'Todoの復元に失敗しました。';
    }
  }

  async confirmDeleteTodo(todoId: string): Promise<void> {
    if (confirm('このToDoを削除してもよろしいですか？')) {
      try {
        await this.todoService.deleteTodo(todoId);
        this.completedTodos = this.completedTodos.filter(todo => todo.id !== todoId);
      } catch (error) {
        console.error('Error deleting todo:', error);
      }
    }
  }

  async restoreProject(projectId: string) {
    try {
      await this.projectService.restoreProject(projectId);
      // リストを更新
      await this.loadArchives();
    } catch (error) {
      console.error('Error restoring project:', error);
    }
  }

  async deleteProject(projectId: string) {
    if (!confirm('削除したらもう戻せません。本当に削除しますか？')) return;
    const archiveRef = doc(this.firestore, 'archives', projectId);
    await deleteDoc(archiveRef);
    await this.loadArchives();
  }

  formatDate(timestamp: Timestamp | null): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const y = date.getFullYear();
    const m = ('00' + (date.getMonth() + 1)).slice(-2);
    const d = ('00' + date.getDate()).slice(-2);
    const h = ('00' + date.getHours()).slice(-2);
    const min = ('00' + date.getMinutes()).slice(-2);
    return `${y}/${m}/${d} ${h}:${min}`;
  }
} 