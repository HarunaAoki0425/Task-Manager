import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
  getDoc
} from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { TodoService } from '../../../services/todo.service';
import { ProjectService } from '../../../services/project.service';
import { Subscription } from 'rxjs';
import { Todo } from '../../../models/todo.model';
import { User } from '../../../models/user.model';

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

  constructor(private firestore: Firestore, private auth: AuthService, private todoService: TodoService, private projectService: ProjectService, private router: Router) {
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
      const safeTodo = {
        ...todo,
        issueTitle: todo.issueTitle || '', // undefinedを防ぐ
        completed: false,
        completedAt: null,
        updatedAt: Timestamp.now()
      };
      await setDoc(todoRef, safeTodo);

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
      // 1. プロジェクト本体を復元
      const archiveProjectRef = doc(this.firestore, 'archives', projectId);
      const archiveProjectSnap = await getDoc(archiveProjectRef);
      if (!archiveProjectSnap.exists()) {
        alert('アーカイブプロジェクトが見つかりません');
        return;
      }
      const projectData = archiveProjectSnap.data();
      await setDoc(doc(this.firestore, 'projects', projectId), projectData);

      // 2. commentsとrepliesを復元
      const commentsRef = collection(this.firestore, 'archives', projectId, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      const batch = writeBatch(this.firestore);

      for (const commentDoc of commentsSnap.docs) {
        const commentData = commentDoc.data();
        const commentId = commentDoc.id;
        const restoreCommentRef = doc(this.firestore, 'projects', projectId, 'comments', commentId);
        batch.set(restoreCommentRef, commentData);

        const repliesRef = collection(this.firestore, 'archives', projectId, 'comments', commentId, 'replies');
        const repliesSnap = await getDocs(repliesRef);
        for (const replyDoc of repliesSnap.docs) {
          const replyData = replyDoc.data();
          const replyId = replyDoc.id;
          const restoreReplyRef = doc(this.firestore, 'projects', projectId, 'comments', commentId, 'replies', replyId);
          batch.set(restoreReplyRef, replyData);
          batch.delete(replyDoc.ref);
        }
        batch.delete(commentDoc.ref);
      }

      // 3. issuesとtodosを復元
      const issuesRef = collection(this.firestore, 'archives', projectId, 'issues');
      const issuesSnap = await getDocs(issuesRef);

      for (const issueDoc of issuesSnap.docs) {
        const issueData = issueDoc.data();
        const issueId = issueDoc.id;
        const restoreIssueRef = doc(this.firestore, 'projects', projectId, 'issues', issueId);
        batch.set(restoreIssueRef, issueData);

        // todos取得
        const todosRef = collection(this.firestore, 'archives', projectId, 'issues', issueId, 'todos');
        const todosSnap = await getDocs(todosRef);
        for (const todoDoc of todosSnap.docs) {
          const todoData = todoDoc.data();
          const todoId = todoDoc.id;
          const restoreTodoRef = doc(this.firestore, 'projects', projectId, 'issues', issueId, 'todos', todoId);
          batch.set(restoreTodoRef, todoData);
          batch.delete(todoDoc.ref);
        }
        batch.delete(issueDoc.ref);
      }

      await batch.commit();

      // 復元後にarchives/{projectId}本体も削除
      await deleteDoc(doc(this.firestore, 'archives', projectId));

      await this.loadArchives();
      alert('プロジェクト・コメント・リプライ・課題・ToDoの復元が完了しました');
    } catch (error) {
      console.error('Error restoring project:', error);
      alert('復元に失敗しました');
    }
  }

  async deleteProject(projectId: string) {
    if (!confirm('削除したらもう戻せません。本当に削除しますか？')) return;

    try {
      // 1. commentsとrepliesを削除
      const commentsRef = collection(this.firestore, 'archives', projectId, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      const batch = writeBatch(this.firestore);

      for (const commentDoc of commentsSnap.docs) {
        const commentId = commentDoc.id;
        // replies削除
        const repliesRef = collection(this.firestore, 'archives', projectId, 'comments', commentId, 'replies');
        const repliesSnap = await getDocs(repliesRef);
        for (const replyDoc of repliesSnap.docs) {
          batch.delete(replyDoc.ref);
        }
        batch.delete(commentDoc.ref);
      }

      // 2. issuesとtodosを削除
      const issuesRef = collection(this.firestore, 'archives', projectId, 'issues');
      const issuesSnap = await getDocs(issuesRef);

      for (const issueDoc of issuesSnap.docs) {
        const issueId = issueDoc.id;
        // todos削除
        const todosRef = collection(this.firestore, 'archives', projectId, 'issues', issueId, 'todos');
        const todosSnap = await getDocs(todosRef);
        for (const todoDoc of todosSnap.docs) {
          batch.delete(todoDoc.ref);
        }
        batch.delete(issueDoc.ref);
      }

      await batch.commit();

      // 3. archives本体を削除
      await deleteDoc(doc(this.firestore, 'archives', projectId));

      await this.loadArchives();
      alert('アーカイブプロジェクト・課題・ToDo・コメント・リプライの完全削除が完了しました');
    } catch (error) {
      let errorMessage = '';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
      console.error('Error deleting archive project and subcollections:', error, errorMessage);
      alert('削除に失敗しました: ' + errorMessage);
    }
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

  goToArchiveDetail(projectId: string) {
    this.router.navigate(['/archives', projectId]);
  }
} 