
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, UserProfile, VocabWord, ChatMessage, ScheduleIntent } from './types';
import { generateDailyWords, parseReminderIntent } from './services/geminiService';
import { getTodaysWords, saveTodaysWords, subscribeEmail } from './services/firestoreService';
import { PlatformIcon } from './components/PlatformIcon';
import { WordDisplay } from './components/WordDisplay';
import { Login } from './components/Login';
import { initDB, saveProfile, getProfile, clearProfile } from './services/db';
import {
  Settings,
  Send as SendIcon,
  RefreshCw,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  LayoutDashboard,
  MessageSquare,
  Bell,
  LogOut
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'settings'>('dashboard');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => window.clearTimeout(t));
    };
  }, []);

  // Initialize or Load User from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        await initDB();
        const saved = await getProfile();
        if (saved) {
          setUser(saved);
        }
      } catch (err) {
        console.error("Failed to load user profile from DB", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSaveUser = async (u: UserProfile) => {
    try {
      await saveProfile(u);
      setUser(u);
    } catch (err) {
      console.error("Failed to save user profile", err);
    }
  };

  const handleLogout = async () => {
    try {
      await clearProfile();
      setUser(null);
      // Reset state if needed
      setChatMessages([]);
      setActiveTab('dashboard');
    } catch (err) {
      console.error("Failed to logout", err);
    }
  };

  const addBotMessage = useCallback((text: string) => {
    const botMsg: ChatMessage = {
      id: Date.now().toString() + Math.random(),
      sender: 'bot',
      text,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, botMsg]);
    // Notify user if they are not looking at the chat
    setHasNewMessage(true);
  }, []);

  // Fetch Words if needed
  const fetchNewWords = useCallback(async () => {
    if (!user || isRefreshing) return;
    setIsRefreshing(true);
    setLoading(true);
    try {
      // 1. Check if we already have today's words in Firestore
      let words = await getTodaysWords();

      if (!words || words.length === 0) {
        // 2. If not, generate them via Gemini (Only one person needs to trigger this per day)
        console.log("No words found for today, generating...");
        words = await generateDailyWords();

        // 3. Save them to Firestore
        await saveTodaysWords(words);
      }

      const updatedUser = {
        ...user,
        currentWords: words,
        lastGenerated: new Date().toISOString()
      };
      await handleSaveUser(updatedUser);

      addBotMessage(`Good morning, ${user.name}! Here are your 5 visual vocabulary words for today.`);
    } catch (error) {
      console.error(error);
      addBotMessage("Sorry, I couldn't load the daily word. Please try again.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user, isRefreshing, addBotMessage]);

  // Auto-fetch words when user is loaded and on Dashboard
  useEffect(() => {
    if (user && activeTab === 'dashboard') {
      // Check if we need to fetch new words (e.g., if currentWords is empty or from a different day)
      // Logic inside fetchNewWords handles the DB check, so we can just call it.
      // Optimally, we check if user.lastGenerated is NOT today.
      const today = new Date().toISOString().split('T')[0];
      const lastGenDate = user.lastGenerated ? user.lastGenerated.split('T')[0] : '';

      if (lastGenDate !== today || user.currentWords.length === 0) {
        fetchNewWords();
      }
    }
  }, [user, activeTab, fetchNewWords]);

  const handleSubscribe = async () => {
    if (!subEmail || !subEmail.includes('@')) return;
    setSubStatus('loading');
    const success = await subscribeEmail(subEmail);
    if (success) {
      setSubStatus('success');
      setSubEmail('');
      setTimeout(() => setSubStatus('idle'), 3000);
    } else {
      setSubStatus('error');
    }
  };

  const scheduleReminder = useCallback((delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      // In a real app, this would be a push notification.
      // Here we simulate it by adding a message to the chat.
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      getProfile().then(currentUser => {
        if (currentUser && currentUser.currentWords.length > 0) {
          const wordsList = currentUser.currentWords.map((w: VocabWord) => w.word.toUpperCase()).join(', ');
          addBotMessage(`🔔 REMINDER (${timeStr}): Time to review your words! Today's list: ${wordsList}. Head over to the Dashboard to see the full visuals.`);
        } else {
          addBotMessage(`🔔 REMINDER (${timeStr}): It's time to study, but you haven't generated any words yet! Click "Generate" on your dashboard.`);
        }
      });

      // Remove this timeout from tracking
      timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);
    }, delayMs);

    timeoutsRef.current.push(timeoutId);
  }, [addBotMessage]);

  // Handle reminder chat logic
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = inputMessage;
    setInputMessage('');

    try {
      const intent = await parseReminderIntent(currentInput);

      if (intent.action === 'remind') {
        let delayMs = 0;
        let responseText = '';

        if (intent.delayMinutes) {
          delayMs = intent.delayMinutes * 60 * 1000;
          responseText = `Got it! I'll remind you about today's words in ${intent.delayMinutes} minute${intent.delayMinutes === 1 ? '' : 's'}.`;
        } else if (intent.absoluteTime) {
          const [hours, minutes] = intent.absoluteTime.split(':').map(Number);
          const now = new Date();
          const target = new Date();
          target.setHours(hours, minutes, 0, 0);

          if (target <= now) {
            target.setDate(target.getDate() + 1);
          }

          delayMs = target.getTime() - now.getTime();
          responseText = `Perfect. I'll resend today's vocabulary at ${intent.absoluteTime}.`;
        }

        if (delayMs > 0) {
          setTimeout(() => {
            addBotMessage(responseText);
            scheduleReminder(delayMs);
          }, 600);
        } else {
          setTimeout(() => addBotMessage("I understood that as a reminder, but I couldn't determine the time. Try 'remind me in 1 minute'."), 600);
        }
      } else {
        setTimeout(() => {
          addBotMessage("I'm here to help with your vocabulary! You can ask me to remind you later if you're busy, e.g., 'remind me in 2 minutes'.");
        }, 600);
      }
    } catch (err) {
      console.error(err);
      addBotMessage("Sorry, I had trouble processing that. Could you try again?");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setHasNewMessage(false);
    }
  }, [activeTab]);

  if (loading && !user) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium">Initializing NithiBot...</p>
    </div>
  );

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-4xl mx-auto border-x border-gray-200 shadow-xl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-none">NithiBot</h1>
            <p className="text-xs text-gray-500 font-medium">Visual Vocab Bot</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchNewWords}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 text-sm font-semibold">
            <PlatformIcon platform={user.platform} size={16} />
            {user.platform} Connected
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Subscription Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 rounded-3xl text-white shadow-lg shadow-blue-200">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <Bell size={32} className="text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-bold mb-1">Get Daily Words by Email</h3>
                  <p className="text-blue-100 text-sm">Join the study group! We'll send the daily visual word straight to your inbox every morning.</p>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <div className="flex bg-white/10 p-1 rounded-2xl border border-white/20">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={subEmail}
                      onChange={(e) => setSubEmail(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-blue-200 px-4 w-full md:w-48 outline-none"
                    />
                    <button
                      onClick={handleSubscribe}
                      disabled={subStatus === 'loading' || subStatus === 'success'}
                      className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {subStatus === 'loading' ? 'Values...' : subStatus === 'success' ? 'Joined!' : 'Subscribe'}
                    </button>
                  </div>
                  {subStatus === 'error' && <p className="text-xs text-red-200 text-center">Something went wrong. Try again.</p>}
                  {subStatus === 'success' && <p className="text-xs text-green-200 text-center">Successfully subscribed!</p>}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                  <Calendar size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Daily Goal</p>
                  <p className="font-bold text-lg">5 Words</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Sync Time</p>
                  <p className="font-bold text-lg">{user.reminderTime}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <Bell size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Active Reminders</p>
                  <p className="font-bold text-lg">{timeoutsRef.current.length} Pending</p>
                </div>
              </div>
            </div>

            {/* Daily Words Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                  Today's Words
                  <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">New Batch</span>
                </h2>
                <span className="text-sm text-gray-400 font-medium">
                  {user.lastGenerated ? new Date(user.lastGenerated).toLocaleDateString() : 'No data'}
                </span>
              </div>

              {isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                </div>
              ) : user.currentWords.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {user.currentWords.map((word) => (
                    <WordDisplay key={word.id} word={word} />
                  ))}
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                    <AlertCircle size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Loading Daily Words...</h3>
                  <p className="text-gray-500 mb-8 max-w-xs mx-auto">Please wait while we fetch your daily vocabulary.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full flex flex-col bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-blue-50">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Nithibot AI</h3>
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Bot Online
                  </div>
                </div>
              </div>
              <div className="px-3 py-1 bg-white border border-gray-200 rounded-full text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                via {user.platform}
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/20"
            >
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
                    <Clock size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm italic">"Remind me in 1 minute"<br />"Remind me at 8 PM"</p>
                  </div>
                </div>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}>
                    {msg.text}
                    <div className={`text-[10px] mt-2 font-medium opacity-60 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Set a reminder... (e.g. 'remind me in 1 min')"
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none text-gray-800"
                />
                <button
                  onClick={handleSendMessage}
                  className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-90 transition-all shrink-0"
                >
                  <SendIcon size={20} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 text-center font-medium">
                Reminders will appear automatically in this chat.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-bold text-gray-800">Profile & Settings</h2>

            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-gray-100 bg-gray-50/30">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 shadow-inner">
                    <User size={40} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Display Name</label>
                    <input
                      type="text"
                      value={user.name}
                      onChange={(e) => handleSaveUser({ ...user, name: e.target.value })}
                      className="text-2xl font-bold text-gray-900 border-b border-transparent focus:border-blue-300 bg-transparent focus:ring-0 p-0 w-full transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-10">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Sync Platform</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.values(Platform).map((p) => (
                      <button
                        key={p}
                        onClick={() => handleSaveUser({ ...user, platform: p })}
                        className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all ${user.platform === p
                          ? 'bg-blue-50 border-blue-500 shadow-md scale-105'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                          }`}
                      >
                        <PlatformIcon platform={p} size={28} />
                        <span className="text-xs font-bold text-gray-700">{p}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-w-xs">
                  <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Daily Reminder Time</label>
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      type="time"
                      value={user.reminderTime}
                      onChange={(e) => handleSaveUser({ ...user, reminderTime: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 font-medium">Nithibot syncs your 5 daily words at this time.</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-blue-900">Database Optimized</h4>
                <p className="text-sm text-blue-800 leading-relaxed opacity-80">
                  Visual assets are stored in IndexedDB. Your session is safe and your browser storage is healthy.
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full bg-white border border-red-100 text-red-600 font-bold py-4 rounded-3xl hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="bg-white border-t border-gray-100 px-6 py-3 sticky bottom-0 z-10 flex justify-between items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1.5 px-4 py-1 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <LayoutDashboard size={24} className={activeTab === 'dashboard' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Dash</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`relative flex flex-col items-center gap-1.5 px-4 py-1 rounded-2xl transition-all ${activeTab === 'chat' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {hasNewMessage && (
            <span className="absolute top-0 right-3 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-bounce"></span>
          )}
          <MessageSquare size={24} className={activeTab === 'chat' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1.5 px-4 py-1 rounded-2xl transition-all ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Settings size={24} className={activeTab === 'settings' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Setup</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
