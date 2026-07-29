import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { auth } from './firebase'
import {
  getRtdbUserProfile,
  isUsernameTaken,
  saveRtdbUserProfile,
  toStoredUser,
  updateRtdbUserProfile,
  type UserProfile,
} from './rtdb'
import {
  clearUserStorage,
  saveUserToStorage,
} from './storage'

export type AuthUser = User

/** Convert username or email to Firebase email */
export function toAuthEmail(account: string) {
  const value = account.trim().toLowerCase()
  if (value.includes('@')) return value
  return `${value}@whisker.app`
}

export function mapAuthError(code?: string, fallback = 'Có lỗi xảy ra.') {
  switch (code) {
    case 'auth/invalid-email':
      return 'Tài khoản không hợp lệ.'
    case 'auth/user-disabled':
      return 'Tài khoản đã bị khóa.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Sai tài khoản hoặc mật khẩu.'
    case 'auth/email-already-in-use':
      return 'Tài khoản đã tồn tại.'
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu (tối thiểu 6 ký tự).'
    case 'auth/too-many-requests':
      return 'Thử quá nhiều lần. Vui lòng đợi rồi thử lại.'
    case 'auth/network-request-failed':
      return 'Lỗi mạng. Kiểm tra kết nối rồi thử lại.'
    default:
      return fallback
  }
}

function persistFromProfile(profile: UserProfile) {
  saveUserToStorage(toStoredUser(profile))
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string,
) {
  const username = (displayName || email.split('@')[0]).trim()
  const taken = await isUsernameTaken(username)
  if (taken) {
    const err = new Error('USERNAME_TAKEN') as Error & { code?: string }
    err.code = 'USERNAME_TAKEN'
    throw err
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password)

  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }

  const profile: UserProfile = {
    uid: credential.user.uid,
    email: credential.user.email || email,
    displayName: displayName || credential.user.displayName || username,
    username: username.toLowerCase(),
    hasCompletedTest: false,
    level: null,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  }

  await saveRtdbUserProfile(profile)
  persistFromProfile(profile)

  return credential.user
}

export async function registerWithUsername(
  username: string,
  password: string,
) {
  const email = toAuthEmail(username)
  return registerWithEmail(email, password, username.trim())
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await updateRtdbUserProfile(credential.user.uid, {
    lastLoginAt: Date.now(),
  })

  let profile = await getRtdbUserProfile(credential.user.uid)
  if (!profile) {
    const username =
      credential.user.displayName ||
      credential.user.email?.split('@')[0] ||
      'thamhiem'
    profile = {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: username,
      username: username.toLowerCase(),
      hasCompletedTest: false,
      level: null,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    }
    await saveRtdbUserProfile(profile)
  }

  persistFromProfile(profile)
  return credential.user
}

export async function loginWithUsername(username: string, password: string) {
  return loginWithEmail(toAuthEmail(username), password)
}

export async function logout() {
  await signOut(auth)
  clearUserStorage()
}

export function subscribeAuth(callback: (user: AuthUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearUserStorage()
      callback(null)
      return
    }

    let profile = await getRtdbUserProfile(user.uid)
    if (!profile) {
      const username =
        user.displayName || user.email?.split('@')[0] || 'thamhiem'
      profile = {
        uid: user.uid,
        email: user.email || '',
        displayName: username,
        username: username.toLowerCase(),
        hasCompletedTest: false,
        level: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      }
      await saveRtdbUserProfile(profile)
    }

    persistFromProfile(profile)
    callback(user)
  })
}

export function getCurrentUser() {
  return auth.currentUser
}

export async function getCurrentUserProfile() {
  const user = auth.currentUser
  if (!user) return null
  return getRtdbUserProfile(user.uid)
}
