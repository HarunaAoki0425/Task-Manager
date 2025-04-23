import { initializeApp } from 'firebase/app';
import { getAuth, listUsers } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';

// Firebaseの初期化
const app = initializeApp(environment.firebase);
const auth = getAuth(app);
const firestore = getFirestore(app);

async function migrateUsers() {
  try {
    // 既存のユーザーを取得
    const listUsersResult = await listUsers(auth);
    
    console.log(`${listUsersResult.users.length} 人のユーザーを移行します...`);

    for (const userRecord of listUsersResult.users) {
      try {
        // Firestoreにユーザーデータを作成
        const userData = {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Unknown User',
          createdAt: new Date(userRecord.metadata.creationTime),
          updatedAt: new Date()
        };

        await setDoc(doc(firestore, 'users', userRecord.uid), userData);
        console.log(`✅ ユーザー ${userRecord.email} のデータを移行しました`);
      } catch (error) {
        console.error(`❌ ユーザー ${userRecord.email} の移行に失敗:`, error);
      }
    }

    console.log('移行が完了しました！');
  } catch (error) {
    console.error('移行中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
migrateUsers(); 