export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string | null;
} 