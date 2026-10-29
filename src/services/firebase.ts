import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserLibraryEntry } from '../types/media';
import { sanitizeLibraryPayload } from '../utils/trackingLogic';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as required by firebase-integration-rpc
export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function subscribeToUserLibrary(
  userId: string,
  onUpdate: (entries: Record<string, UserLibraryEntry>) => void
): () => void {
  const path = `users/${userId}/library`;
  const q = query(collection(db, path), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, UserLibraryEntry> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAtIso =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
              ? data.createdAt
              : new Date().toISOString();
        const updatedAtIso =
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === 'string'
              ? data.updatedAt
              : new Date().toISOString();

        map[data.mediaId] = {
          mediaId: String(data.mediaId),
          userId: String(data.userId),
          category: data.category,
          title: String(data.title || ''),
          posterUrl: String(data.posterUrl || ''),
          status: data.status,
          isFavorite: Boolean(data.isFavorite),
          inWatchlist: Boolean(data.inWatchlist),
          personalRating:
            typeof data.personalRating === 'number' && data.personalRating > 0
              ? data.personalRating
              : undefined,
          watchedDate: data.watchedDate ? String(data.watchedDate) : undefined,
          rewatchDates: Array.isArray(data.rewatchDates) ? data.rewatchDates.map(String) : [],
          watchedEpisodes: Array.isArray(data.watchedEpisodes)
            ? data.watchedEpisodes.map(String)
            : [],
          lastWatchedEpisode: data.lastWatchedEpisode ? String(data.lastWatchedEpisode) : undefined,
          totalEpisodesCount:
            typeof data.totalEpisodesCount === 'number' ? data.totalEpisodesCount : undefined,
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
        };
      });
      onUpdate(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveLibraryEntryToCloud(
  userId: string,
  entry: UserLibraryEntry,
  isExistingInCloud: boolean
): Promise<void> {
  const sanitized = sanitizeLibraryPayload(entry, userId);
  const path = `users/${userId}/library/${sanitized.mediaId}`;
  const docRef = doc(db, 'users', userId, 'library', sanitized.mediaId);

  const payload: Record<string, unknown> = {
    mediaId: sanitized.mediaId,
    userId: sanitized.userId,
    category: sanitized.category,
    title: sanitized.title,
    posterUrl: sanitized.posterUrl || '',
    status: sanitized.status,
    isFavorite: sanitized.isFavorite,
    inWatchlist: sanitized.inWatchlist,
    personalRating: typeof sanitized.personalRating === 'number' ? sanitized.personalRating : 0,
    watchedDate: sanitized.watchedDate || '',
    rewatchDates: sanitized.rewatchDates,
    watchedEpisodes: sanitized.watchedEpisodes,
    lastWatchedEpisode: sanitized.lastWatchedEpisode || '',
    totalEpisodesCount:
      typeof sanitized.totalEpisodesCount === 'number' ? sanitized.totalEpisodesCount : 0,
    updatedAt: serverTimestamp(),
  };

  if (!isExistingInCloud) {
    payload.createdAt = serverTimestamp();
  }

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(
      error,
      isExistingInCloud ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteLibraryEntryFromCloud(
  userId: string,
  mediaId: string
): Promise<void> {
  const path = `users/${userId}/library/${mediaId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'library', mediaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
