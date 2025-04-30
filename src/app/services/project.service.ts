import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, Timestamp, doc, getDoc, query, where, updateDoc, deleteDoc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Project } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  async getUserProjects(): Promise<Project[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const projectsRef = collection(this.firestore, 'projects');
    const q = query(
      projectsRef,
      where('members', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data()['title'] || doc.data()['name'] || '',
      description: doc.data()['description'] || '',
      members: doc.data()['members'] || [],
      createdBy: doc.data()['createdBy'] || '',
      dueDate: doc.data()['dueDate'],
      createdAt: doc.data()['createdAt'] || Timestamp.now(),
      updatedAt: doc.data()['updatedAt'] || Timestamp.now()
    } as Project));
  }

  async getProject(projectId: string): Promise<Project | null> {
    let projectDoc = doc(this.firestore, 'projects', projectId);
    let projectSnap = await getDoc(projectDoc);
    
    if (!projectSnap.exists()) {
      projectDoc = doc(this.firestore, 'archives', projectId);
      projectSnap = await getDoc(projectDoc);
    }
    
    if (projectSnap.exists()) {
      const data = projectSnap.data();
      return {
        id: projectId,
        title: data['title'] || data['name'] || '',
        description: data['description'] || '',
        members: data['members'] || [],
        createdBy: data['createdBy'] || '',
        dueDate: data['dueDate'],
        createdAt: data['createdAt'] || Timestamp.now(),
        updatedAt: data['updatedAt'] || Timestamp.now()
      } as Project;
    }
    
    return null;
  }

  async getProjectMembers(projectId: string): Promise<{ uid: string; displayName: string; email: string }[]> {
    console.log('Getting project details for:', projectId);
    const project = await this.getProject(projectId);
    if (!project || !Array.isArray(project.members)) {
      console.log('No project found or no members array:', project);
      return [];
    }

    console.log('Project members array:', project.members);
    const members = await Promise.all(project.members.map(async (uid: string) => {
      const userDoc = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userDoc);
      const result = {
        uid,
        displayName: userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name',
        email: userSnap.exists() ? userSnap.data()['email'] || '' : ''
      };
      console.log('Loaded member details:', result);
      return result;
    }));

    return members;
  }

  async addProjectMember(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data();
    const members = Array.isArray(project['members']) ? project['members'] : [];
    
    if (!members.includes(userId)) {
      members.push(userId);
      await updateDoc(projectRef, { members });
    }
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const projectRef = doc(this.firestore, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data();
    const members = Array.isArray(project['members']) ? project['members'] : [];
    const updatedMembers = members.filter((id: string) => id !== userId);
    
    await updateDoc(projectRef, { members: updatedMembers });
  }
} 