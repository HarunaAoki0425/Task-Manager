import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.css']
})
export class ArchiveComponent {
  archives: any[] = [];
  isLoading = true;

  constructor(private firestore: Firestore) {
    this.loadArchives();
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

  async restoreProject(projectId: string) {
    const archiveRef = doc(this.firestore, 'archives', projectId);
    const archiveSnap = await getDoc(archiveRef);
    if (!archiveSnap.exists()) return;
    const data = archiveSnap.data();
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