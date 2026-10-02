import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Conversation, Message, User, UserSettings } from '../types/index.ts';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific database ID if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Verify Firestore connection on initial boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline check:', error.message);
    }
  }
}
testConnection();

// --- Auth Helpers ---
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;
  const user: User = {
    id: fbUser.uid,
    name: fbUser.displayName || 'Utilisateur Google',
    email: fbUser.email || '',
    avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fbUser.uid)}`,
    createdAt: new Date().toISOString(),
  };

  // Upsert user profile in Firestore
  try {
    const userRef = doc(db, 'users', fbUser.uid);
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, user);
    }
  } catch (e) {
    console.warn('Error syncing user profile to Firestore:', e);
  }

  return user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email, pass);
  return {
    id: res.user.uid,
    name: res.user.displayName || email.split('@')[0],
    email: res.user.email || email,
    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(res.user.uid)}`,
    createdAt: new Date().toISOString(),
  };
}

export async function registerWithEmail(name: string, email: string, pass: string): Promise<User> {
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  const user: User = {
    id: res.user.uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(res.user.uid)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', res.user.uid), user);
  } catch (e) {
    console.warn('Error saving new user profile in Firestore:', e);
  }

  return user;
}

export async function signInAsGuest(): Promise<User> {
  try {
    const res = await signInAnonymously(auth);
    return {
      id: res.user.uid,
      name: 'Invité',
      email: 'invite@ryxia.ai',
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(res.user.uid)}`,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    // Local fallback guest ID if anonymous auth is pending
    const guestId = `guest_${Date.now()}`;
    return {
      id: guestId,
      name: 'Invité',
      email: 'invite@ryxia.ai',
      avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${guestId}`,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// --- Firestore Persistence Helpers ---
export async function syncConversationToFirestore(conv: Conversation): Promise<void> {
  try {
    const convRef = doc(db, 'conversations', conv.id);
    await setDoc(convRef, {
      id: conv.id,
      userId: conv.userId,
      title: conv.title,
      mode: conv.mode,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore sync conversation failed:', err);
  }
}

export async function syncMessageToFirestore(msg: Message, userId: string): Promise<void> {
  try {
    const msgRef = doc(db, 'conversations', msg.conversationId, 'messages', msg.id);
    await setDoc(msgRef, {
      id: msg.id,
      conversationId: msg.conversationId,
      userId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
      model: msg.model,
    });
  } catch (err) {
    console.warn('Firestore sync message failed:', err);
  }
}

export async function fetchUserConversationsFromFirestore(userId: string): Promise<Conversation[]> {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    const list: Conversation[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Conversation);
    });
    return list;
  } catch (err) {
    console.warn('Firestore list conversations error:', err);
    return [];
  }
}

export async function fetchMessagesFromFirestore(convId: string): Promise<Message[]> {
  try {
    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    const list: Message[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Message);
    });
    return list;
  } catch (err) {
    console.warn('Firestore get messages error:', err);
    return [];
  }
}

export async function deleteConversationFromFirestore(convId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'conversations', convId));
  } catch (err) {
    console.warn('Firestore delete conversation error:', err);
  }
}

export async function syncUserSettingsToFirestore(userId: string, settings: Partial<UserSettings>): Promise<void> {
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(settingsRef, {
      userId,
      theme: settings.theme || 'dark',
      fontSize: settings.fontSize || 'md',
      enterSends: settings.enterSends ?? true,
      animations: settings.animations ?? true,
      aiProvider: settings.aiProvider || 'auto',
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore sync settings failed:', err);
  }
}
