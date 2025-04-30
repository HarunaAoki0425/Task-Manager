import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  Firestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  DocumentData,
  QueryDocumentSnapshot
} from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Todo } from '../../models/todo.model';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule],
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.css']
})
export class ArchiveComponent {
  archives: any[] = [];
  isLoading = true;
  archivedProjects: any[] = [];
  completedTodos: any[] = [];

  constructor(private firestore: Firestore) {
    this.loadArchives();
    this.loadCompletedTodos();
  }

  async loadArchives() {
    this.isLoading = true;
    try {
      const archivesRef = collection(this.firestore, 'archives');
      const snapshot = await getDocs(archivesRef);
      this.archives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      this.archives = [];
    } finally {
      this.isLoading = false;
    }
  }

  async loadCompletedTodos() {
    try {
      const todosRef = collection(this.firestore, 'todos');
      const q = query(todosRef, where('completed', '==', true));
      const snapshot = await getDocs(q);
      
      // 各Todoに対してプロジェクトとイシューの情報を取得
      const todos = await Promise.all(
        snapshot.docs.map(async (docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
          const todoData = { id: docSnapshot.id, ...docSnapshot.data() } as Todo & DocumentData;
          
          // プロジェクト情報を取得
          const projectRef = doc(this.firestore, 'projects', todoData.projectId);
          const projectSnap = await getDoc(projectRef);
          const projectData = projectSnap.data() as DocumentData | undefined;
          
          // イシュー情報を取得
          const issueRef = doc(this.firestore, 'projects', todoData.projectId, 'issues', todoData.issueId);
          const issueSnap = await getDoc(issueRef);
          const issueData = issueSnap.data() as DocumentData | undefined;
          
          return {
            ...todoData,
            projectTitle: projectData?.['name'] || '',
            issueTitle: issueData?.['title'] || ''
          };
        })
      );
      
      this.completedTodos = todos;
    } catch (e) {
      console.error('Error loading completed todos:', e);
      this.completedTodos = [];
    }
  }

  async restoreTodo(todo: any) {
    try {
      const todoRef = doc(this.firestore, 'todos', todo.id);
      await setDoc(todoRef, {
        ...todo,
        completed: false,
        completedAt: null
      });
      await this.loadCompletedTodos();
    } catch (e) {
      console.error('Error restoring todo:', e);
    }
  }

  async deleteTodo(todoId: string) {
    if (!confirm('このToDoを完全に削除してもよろしいですか？')) return;
    try {
      const todoRef = doc(this.firestore, 'todos', todoId);
      await deleteDoc(todoRef);
      await this.loadCompletedTodos();
    } catch (e) {
      console.error('Error deleting todo:', e);
    }
  }

  async restoreProject(projectId: string) {
    const archiveRef = doc(this.firestore, 'archives', projectId);
    const archiveSnap = await getDoc(archiveRef);
    if (!archiveSnap.exists()) return;
    const data = archiveSnap.data() as DocumentData;
    // deletedAtを除外してprojectsに復元
    const { deletedAt, ...restoreData } = data;
    const projectRef = doc(this.firestore, 'projects', projectId);
    await setDoc(projectRef, restoreData);
    await deleteDoc(archiveRef);
    await this.loadArchives();
  }

  async deleteProject(projectId: string) {
    if (!confirm('削除したらもう戻せません。本当に削除しますか？')) return;
    const archiveRef = doc(this.firestore, 'archives', projectId);
    await deleteDoc(archiveRef);
    await this.loadArchives();
  }

  formatDate(ts: any): string {
    if (!ts) return '';
    let date: Date;
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
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}`;
  }
} 