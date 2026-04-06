import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { LogIn, LogOut, Coffee } from 'lucide-react';
import { translations } from '../translations';

export default function Auth({ onUserChange, language }: { onUserChange: (user: UserProfile | null) => void, language: 'en' | 'vi' }) {
  const t = translations[language].auth;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUser(profile);
            onUserChange(profile);
          } else {
            // Default to employee for new users
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'employee',
              displayName: firebaseUser.displayName || 'New Employee',
            };
            // Check if it's the default admin email
            if (firebaseUser.email === 'viettri0005@gmail.com') {
              newProfile.role = 'owner';
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setUser(newProfile);
            onUserChange(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
        onUserChange(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [onUserChange]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = () => signOut(auth);

  if (loading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950 transition-colors duration-300"><Coffee className="animate-bounce text-amber-600 dark:text-amber-500 w-12 h-12" /></div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      {!user ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center transition-colors duration-300 border border-transparent dark:border-slate-800">
          <Coffee className="w-16 h-16 text-amber-700 dark:text-amber-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-amber-900 dark:text-white mb-2 tracking-tight">BrewMaster POS</h1>
          <p className="text-amber-700 dark:text-slate-400 mb-8">{t.signInPrompt}</p>
          <button
            onClick={login}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-amber-700 dark:bg-indigo-600 hover:bg-amber-800 dark:hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-amber-200 dark:hover:shadow-none"
          >
            <LogIn className="w-5 h-5" />
            {t.signInButton}
          </button>
        </div>
      ) : (
        <div className="fixed top-4 right-4 flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-full shadow-md border border-transparent dark:border-slate-800 transition-colors duration-300">
          <span className="text-sm font-bold px-3 py-1 bg-amber-100 dark:bg-indigo-900/50 text-amber-800 dark:text-indigo-300 rounded-full uppercase tracking-wider">
            {user.role}
          </span>
          <span className="text-amber-900 dark:text-white font-bold hidden sm:inline">{user.displayName}</span>
          <button
            onClick={logout}
            className="p-2 text-amber-700 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
