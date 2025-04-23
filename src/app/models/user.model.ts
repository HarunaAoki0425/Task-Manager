export interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  displayName: string;
  email: string;
} 