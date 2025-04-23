const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Firebase Admin SDKの初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const firestore = admin.firestore();

async function migrateUsers() {
  try {
    // 全ユーザーを取得
    const listUsersResult = await auth.listUsers();
    console.log(`${listUsersResult.users.length} 人のユーザーを移行します...`);

    for (const userRecord of listUsersResult.users) {
      try {
        // Firestoreにユーザーデータを作成
        const userData = {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || userRecord.email.split('@')[0] || 'Unknown User',
          createdAt: admin.firestore.Timestamp.fromDate(new Date(userRecord.metadata.creationTime)),
          updatedAt: admin.firestore.Timestamp.fromDate(new Date())
        };

        await firestore.doc(`users/${userRecord.uid}`).set(userData);
        console.log(`✅ ユーザー ${userRecord.email} のデータを移行しました`);
      } catch (error) {
        console.error(`❌ ユーザー ${userRecord.email} の移行に失敗:`, error);
      }
    }

    console.log('移行が完了しました！');
    process.exit(0);
  } catch (error) {
    console.error('移行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトの実行
migrateUsers(); 