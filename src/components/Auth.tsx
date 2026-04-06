import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole, UserStatus } from '../types';
import { LogIn, LogOut, Coffee, Mail, Lock, UserPlus, AlertCircle } from 'lucide-react';
import { translations } from '../translations';

export default function Auth({ onUserChange, language }: { onUserChange: (user: UserProfile | null) => void, language: 'en' | 'vi' }) {
  const t = translations[language].auth;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [showRequestScreen, setShowRequestScreen] = useState(false);
  const [tempFirebaseUser, setTempFirebaseUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            if (profile.status === 'pending') {
              setPendingApproval(true);
              setShowRequestScreen(false);
              setUser(null);
              onUserChange(null);
            } else if (profile.status === 'inactive') {
              setShowRequestScreen(true);
              setTempFirebaseUser(firebaseUser);
              setPendingApproval(false);
              setUser(null);
              onUserChange(null);
            } else {
              setUser(profile);
              onUserChange(profile);
              setPendingApproval(false);
              setShowRequestScreen(false);
            }
          } else {
            // New user - show request screen first
            setShowRequestScreen(true);
            setTempFirebaseUser(firebaseUser);
            setPendingApproval(false);
            setUser(null);
            onUserChange(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
        onUserChange(null);
        setPendingApproval(false);
        setShowRequestScreen(false);
        setTempFirebaseUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [onUserChange, language]);

  const sendAccessRequest = async () => {
    if (!tempFirebaseUser) return;
    
    setLoading(true);
    const newProfile: UserProfile = {
      uid: tempFirebaseUser.uid,
      email: tempFirebaseUser.email || '',
      role: 'employee',
      displayName: tempFirebaseUser.displayName || tempFirebaseUser.email?.split('@')[0] || 'New Employee',
      status: 'pending'
    };

    // Check if it's the default admin email
    if (tempFirebaseUser.email === 'viettri0005@gmail.com') {
      newProfile.role = 'owner';
      newProfile.status = 'approved';
    }

    try {
      await setDoc(doc(db, 'users', tempFirebaseUser.uid), newProfile);
      if (newProfile.status === 'approved') {
        setUser(newProfile);
        onUserChange(newProfile);
        setShowRequestScreen(false);
      } else {
        // Return to login page after sending request
        await logout();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${tempFirebaseUser.uid}`);
    }
    setLoading(false);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      setError(language === 'en' ? 'Google login failed.' : 'Đăng nhập Google thất bại.');
    }
  };

  const loginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Convert username to email format if needed for Firebase Auth
    const emailToUse = email.includes('@') ? email : `${email}@cheeselab.local`;
    
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, emailToUse, password);
      } else {
        await signInWithEmailAndPassword(auth, emailToUse, password);
      }
    } catch (err: any) {
      console.error('Auth failed:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(language === 'en' ? 'Invalid username or password.' : 'Tên đăng nhập hoặc mật khẩu không đúng.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError(language === 'en' ? 'Username already in use.' : 'Tên đăng nhập đã được sử dụng.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(language === 'en' 
          ? 'Email/Password login is not enabled in Firebase Console. Please contact the administrator.' 
          : 'Đăng nhập bằng Email/Mật khẩu chưa được bật trong Firebase Console. Vui lòng liên hệ quản trị viên.');
      } else {
        setError(err.message);
      }
    }
  };

  const logout = () => signOut(auth);

  if (loading) return <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950 transition-colors duration-300"><Coffee className="animate-bounce text-amber-600 dark:text-amber-500 w-12 h-12" /></div>;

  if (showRequestScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 dark:bg-slate-950 p-4 transition-colors duration-300 text-center">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full transition-colors duration-300 border border-transparent dark:border-slate-800">
          <UserPlus className="w-16 h-16 text-amber-600 dark:text-amber-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-amber-900 dark:text-white mb-4 tracking-tight">
            {language === 'en' ? 'Request Access' : 'Yêu cầu truy cập'}
          </h1>
          <p className="text-amber-700 dark:text-slate-400 mb-8">
            {language === 'en' 
              ? 'Your account is not yet active in the system. Would you like to send an access request to the owner?' 
              : 'Tài khoản của bạn chưa được kích hoạt trong hệ thống. Bạn có muốn gửi yêu cầu truy cập cho chủ sở hữu không?'}
          </p>
          <div className="space-y-3">
            <button
              onClick={sendAccessRequest}
              className="w-full py-4 px-6 bg-amber-700 dark:bg-indigo-600 hover:bg-amber-800 dark:hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              {language === 'en' ? 'Send Request to Owner' : 'Gửi yêu cầu cho chủ sở hữu'}
            </button>
            <button
              onClick={logout}
              className="w-full py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold transition-all"
            >
              {language === 'en' ? 'Cancel & Sign Out' : 'Hủy & Đăng xuất'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 dark:bg-slate-950 p-4 transition-colors duration-300 text-center">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full transition-colors duration-300 border border-transparent dark:border-slate-800">
          <AlertCircle className="w-16 h-16 text-amber-600 dark:text-amber-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-amber-900 dark:text-white mb-4 tracking-tight">
            {language === 'en' ? 'Waiting for Approval' : 'Đang chờ phê duyệt'}
          </h1>
          <p className="text-amber-700 dark:text-slate-400 mb-8">
            {language === 'en' 
              ? 'Your account has been created but requires owner approval before you can access the system.' 
              : 'Tài khoản của bạn đã được tạo nhưng cần chủ sở hữu phê duyệt trước khi bạn có thể truy cập hệ thống.'}
          </p>
          <button
            onClick={logout}
            className="w-full py-3 px-6 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
          >
            {language === 'en' ? 'Sign Out' : 'Đăng xuất'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-amber-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      {!user ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center transition-colors duration-300 border border-transparent dark:border-slate-800">
          <Coffee className="w-16 h-16 text-amber-700 dark:text-amber-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-amber-900 dark:text-white mb-2 tracking-tight">Cheese Lab POS</h1>
          <p className="text-amber-700 dark:text-slate-400 mb-8">{t.signInPrompt}</p>
          
          <form onSubmit={loginWithEmail} className="space-y-4 mb-6">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={language === 'en' ? "Username or Email" : "Tên đăng nhập hoặc Email"}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-600 dark:focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-600 dark:focus:ring-indigo-500 transition-all"
              />
            </div>
            
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            
            <button
              type="submit"
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-amber-700 dark:bg-indigo-600 hover:bg-amber-800 dark:hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-amber-200 dark:hover:shadow-none"
            >
              {isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              {isRegistering 
                ? (language === 'en' ? 'Create Account' : 'Tạo tài khoản') 
                : (language === 'en' ? 'Sign In' : 'Đăng nhập')}
            </button>
          </form>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">OR</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          </div>

          <button
            onClick={loginWithGoogle}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            {t.signInButton}
          </button>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="mt-6 text-sm font-bold text-amber-700 dark:text-indigo-400 hover:underline"
          >
            {isRegistering 
              ? (language === 'en' ? 'Already have an account? Sign In' : 'Đã có tài khoản? Đăng nhập') 
              : (language === 'en' ? 'Need an account? Register' : 'Cần tài khoản? Đăng ký')}
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
