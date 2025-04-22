import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideFirebaseApp(() => initializeApp({"projectId":"task-manager-f7b3c","appId":"1:888120882480:web:ef29b3af6bed3e001644f5","storageBucket":"task-manager-f7b3c.firebasestorage.app","apiKey":"AIzaSyA4dkYXIplXCCGZhgj4YHeDZKGJ6OZQ4rk","authDomain":"task-manager-f7b3c.firebaseapp.com","messagingSenderId":"888120882480"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideMessaging(() => getMessaging()), provideFirebaseApp(() => initializeApp({"projectId":"task-manager-f7b3c","appId":"1:888120882480:web:ef29b3af6bed3e001644f5","storageBucket":"task-manager-f7b3c.firebasestorage.app","apiKey":"AIzaSyA4dkYXIplXCCGZhgj4YHeDZKGJ6OZQ4rk","authDomain":"task-manager-f7b3c.firebaseapp.com","messagingSenderId":"888120882480"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideMessaging(() => getMessaging())]
};
