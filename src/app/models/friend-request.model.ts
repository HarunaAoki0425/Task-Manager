import { Timestamp } from '@angular/fire/firestore';

export interface FriendRequest {
  id?: string;          // Firestoreのドキュメントid
  fromUserId: string;   // 申請を送ったユーザーのID
  toUserId: string;     // 申請を受けるユーザーのID
  status: 'pending';    // ステータス（今回はpendingのみ）
  createdAt: Timestamp; // 申請日時
  fromUser?: {         // 申請を送ったユーザーの情報（表示用）
    displayName: string;
    email: string;
  };
} 