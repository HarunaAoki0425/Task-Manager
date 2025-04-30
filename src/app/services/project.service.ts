import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, Timestamp, doc, getDoc, query, where, updateDoc, deleteDoc, setDoc } from '@angular/fire/firestore';

export interface Project {
  id: string;
  name: string;
  description: string;
  dueDate: Date | any; // Timestamp or Date
  createdBy: string;
  members: string[];
  createdAt?: Date | any; // Timestamp or Date
  updatedAt?: Date | any; // Timestamp or Date
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private firestore: Firestore) {}

  async getProject(projectId: string): Promise<Project | null> {
    // まずprojectsから取得
    let projectDoc = doc(this.firestore, 'projects', projectId);
    let projectSnap = await getDoc(projectDoc);
    
    if (!projectSnap.exists()) {
      // なければarchivesから取得
      projectDoc = doc(this.firestore, 'archives', projectId);
      projectSnap = await getDoc(projectDoc);
    }
    
    if (projectSnap.exists()) {
      const data = projectSnap.data();
      return {
        id: projectId,
        name: data['name'] || '',
        description: data['description'] || '',
        dueDate: data['dueDate'],
        createdBy: data['createdBy'] || '',
        members: data['members'] || [],
        createdAt: data['createdAt'],
        updatedAt: data['updatedAt']
      } as Project;
    }
    
    return null;
  }

  async getProjectMembers(projectId: string): Promise<{ uid: string; displayName: string; email: string }[]> {
    const project = await this.getProject(projectId);
    if (!project || !Array.isArray(project.members)) {
      return [];
    }

    const members = await Promise.all(project.members.map(async (uid: string) => {
      const userDoc = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userDoc);
      return {
        uid,
        displayName: userSnap.exists() ? userSnap.data()['displayName'] || 'no name' : 'no name',
        email: userSnap.exists() ? userSnap.data()['email'] || '' : ''
      };
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