import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MessageSquare, Send, X, Bot, User, Coffee, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Product, Order } from '../types';
import { translations } from '../translations';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function Chat({ user, products, orders, language }: { user: UserProfile, products: Product[], orders: Order[], language: 'en' | 'vi' }) {
  const t = translations[language].chat;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: language === 'en' 
      ? `Hello ${user.displayName}! I'm your BrewMaster assistant. How can I help you manage the shop today?`
      : `Xin chào ${user.displayName}! Tôi là trợ lý BrewMaster của bạn. Tôi có thể giúp gì cho bạn trong việc quản lý cửa hàng hôm nay?` 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const systemInstruction = `
        You are a helpful assistant for a coffee shop called "BrewMaster".
        The current user is ${user.displayName} and their role is ${user.role}.
        The current language is ${language === 'en' ? 'English' : 'Vietnamese'}. Please respond in this language.
        
        Current Menu: ${products.map(p => `${p.name} ($${p.price})`).join(', ')}
        Recent Orders: ${orders.slice(0, 10).map(o => `Table ${o.tableNumber}: ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')} ($${o.totalAmount})`).join(' | ')}
        
        If the user is an owner, provide insights on sales and management.
        If the user is a barista, provide help with recipes or order prioritization.
        If the user is an employee, help with POS operations or customer service.
        Keep responses concise and professional.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages.concat({ role: 'user', text: userMsg }).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text || (language === 'en' ? "I'm sorry, I couldn't process that." : "Tôi xin lỗi, tôi không thể xử lý yêu cầu đó.");
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: language === 'en' ? "Sorry, I'm having trouble connecting right now." : "Xin lỗi, tôi đang gặp sự cố kết nối ngay lúc này." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 z-40 group"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-100 dark:border-slate-800 transition-colors duration-300"
          >
            <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl"><Bot className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-bold">BrewMaster AI</h3>
                  <p className="text-xs text-indigo-100">{t.online}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 transition-colors duration-300">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  }`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm rounded-tl-none border border-slate-100 dark:border-slate-700'
                  }`}>
                    <div className="markdown-body prose prose-sm prose-indigo dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm flex items-center justify-center">
                    <Coffee className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-indigo-200 dark:bg-indigo-700 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t.placeholder}
                  className="flex-1 bg-transparent border-none outline-none px-2 text-sm text-slate-800 dark:text-slate-200"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
