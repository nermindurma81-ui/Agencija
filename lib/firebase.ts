import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
};

const envConfig: Partial<FirebaseConfig> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
};

let jsonConfig: Partial<FirebaseConfig> = {};
try {
  jsonConfig = require('../firebase-applet-config.json');
} catch {
  jsonConfig = {};
}

const mergedConfig: Partial<FirebaseConfig> = {
  ...jsonConfig,
  ...Object.fromEntries(Object.entries(envConfig).filter(([, value]) => value)),
};

function hasRequiredFirebaseConfig(config: Partial<FirebaseConfig>): config is FirebaseConfig {
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  return requiredFields.every((field) => {
    const value = config[field];
    return typeof value === 'string' && value.trim().length > 0 && value !== 'placeholder';
  });
}

export const firebaseEnabled = hasRequiredFirebaseConfig(mergedConfig);
const fallbackConfig: FirebaseConfig = {
  apiKey: 'placeholder',
  authDomain: 'placeholder.firebaseapp.com',
  projectId: 'placeholder',
  storageBucket: 'placeholder.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:placeholder',
  firestoreDatabaseId: '(default)',
};
const activeConfig = firebaseEnabled ? mergedConfig : fallbackConfig;

if (!firebaseEnabled) {
  console.warn('Firebase disabled: missing NEXT_PUBLIC_FIREBASE_* configuration.');
}

const app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
export const db = getFirestore(app, activeConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
