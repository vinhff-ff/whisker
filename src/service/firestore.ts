import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  type DocumentData,
  type WithFieldValue,
} from 'firebase/firestore'
import { db } from './firebase'

export async function getDocument<T = DocumentData>(
  collectionName: string,
  id: string,
) {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as T) }
}

export async function getCollection<T = DocumentData>(collectionName: string) {
  const snap = await getDocs(collection(db, collectionName))
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as T) }))
}

export async function setDocument<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: WithFieldValue<T>,
  merge = true,
) {
  await setDoc(doc(db, collectionName, id), data, { merge })
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: DocumentData,
) {
  await updateDoc(doc(db, collectionName, id), data)
}

export async function deleteDocument(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id))
}

/** User profile helpers */
export async function getUserProfile(uid: string) {
  return getDocument('users', uid)
}

export async function saveUserProfile(uid: string, data: DocumentData) {
  return setDocument('users', uid, {
    ...data,
    updatedAt: Date.now(),
  })
}

/** Test result helpers */
export async function saveTestResult(
  uid: string,
  testId: string,
  result: DocumentData,
) {
  return setDocument(`users/${uid}/results`, testId, {
    ...result,
    createdAt: Date.now(),
  })
}

export async function getTestResult(uid: string, testId: string) {
  return getDocument(`users/${uid}/results`, testId)
}
