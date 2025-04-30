import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.css']
})
export class ProjectCreateComponent {
  projectName = '';
  description = '';
  dueDate = '';
  noDueDate = false;
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit(form: any) {
    if (form.invalid) return;
    this.isSubmitting = true;
    this.errorMessage = '';
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.errorMessage = 'ユーザー情報が取得できません。ログインし直してください。';
        this.isSubmitting = false;
        return;
      }
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await setDoc(userDocRef, { displayName: 'no name', email: user.email || '' });
      }
      const projectData = {
        name: this.projectName,
        description: this.description,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
        dueDate: (this.noDueDate || !this.dueDate) ? null : this.dueDate,
      };
      await addDoc(collection(this.firestore, 'projects'), projectData);
      this.router.navigate(['/projects']);
    } catch (error) {
      this.errorMessage = 'プロジェクトの作成に失敗しました。';
      console.error(error);
    } finally {
      this.isSubmitting = false;
    }
  }
} 