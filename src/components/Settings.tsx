import { Settings as SettingsIcon, Globe, Moon, Sun } from 'lucide-react';
import { UserProfile } from '../types';
import { translations } from '../translations';

interface SettingsProps {
  user: UserProfile;
  language: 'en' | 'vi';
  setLanguage: (lang: 'en' | 'vi') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function Settings({ user, language, setLanguage, theme, setTheme }: SettingsProps) {
  const t = translations[language].settings;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-2xl">
          <SettingsIcon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400">{language === 'en' ? 'Manage your application preferences' : 'Quản lý tùy chọn ứng dụng của bạn'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Language Selection */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 transition-colors duration-300">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold">
            <Globe className="w-5 h-5" />
            <h2>{t.language}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold ${
                language === 'en' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.english}
            </button>
            <button
              onClick={() => setLanguage('vi')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold ${
                language === 'vi' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.vietnamese}
            </button>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 transition-colors duration-300">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold">
            {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <h2>{t.theme}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${
                theme === 'light' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Sun className="w-6 h-6" />
              {t.light}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${
                theme === 'dark' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Moon className="w-6 h-6" />
              {t.dark}
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 md:col-span-2 transition-colors duration-300">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.profile}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{language === 'en' ? 'Display Name' : 'Tên hiển thị'}</p>
              <p className="font-bold text-slate-900 dark:text-white">{user.displayName}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t.email}</p>
              <p className="font-bold text-slate-900 dark:text-white">{user.email}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t.role}</p>
              <p className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
