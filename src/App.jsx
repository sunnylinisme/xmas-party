import React, { useState, useEffect, useRef, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc, deleteDoc, deleteField, increment } from 'firebase/firestore';
import { Gift, Users, ArrowRight, Zap, Skull, Play, Edit3, AlertTriangle, LogIn, Share2, Link as LinkIcon, RotateCcw, Shuffle, Star, Save, X, LogOut, Info } from 'lucide-react';

// ==========================================
// ⚠️ 你的 Firebase 設定 (已整合)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDxqdu-Gbd9ZnMCccuUSyDkZ9_dxgIwHJ0",
  authDomain: "xmas-2025-af028.firebaseapp.com",
  projectId: "xmas-2025-af028",
  storageBucket: "xmas-2025-af028.firebasestorage.app",
  messagingSenderId: "1029943918620",
  appId: "1:1029943918620:web:590f68fcfb8b40dab09fd9",
  measurementId: "G-4YY14G3EX8"
};

// 初始化 Firebase
const isConfigured = firebaseConfig.apiKey !== "請貼上你的_apiKey";
const app = isConfigured ? initializeApp(firebaseConfig) : null;
const auth = isConfigured ? getAuth(app) : null;
const db = isConfigured ? getFirestore(app) : null;

// --- 隨機規則庫 ---
const RANDOM_RULES = [
  "跟你的右手邊第二個人交換",
  "跟現場戴眼鏡的人交換（如果多個就猜拳）",
  "跟現場頭髮最長的人交換",
  "持有紅色物品的人互相交換",
  "跟正對面的人交換",
  "所有禮物往左傳一格",
  "所有禮物往右傳三格",
  "跟現場年紀最小的人交換",
  "跟主持人交換",
  "把禮物拋向空中，搶到哪個算哪個（注意安全！）",
  "跟現場穿白色衣服的人交換",
  "猜拳！贏的人可以指定跟任何人換",
  "這回合不交換，大家休息一下",
  "跟現場看起來最貴的禮物交換",
  "拿著禮物深蹲 10 下，然後跟左邊的人換"
];

// --- 評分說明邏輯 ---
const getRatingLabel = (score) => {
  // 這是顯示總分用的評語
  const avg = score;
  if (avg <= 10) return { text: "😇 天使好禮", color: "text-green-400" };
  if (avg <= 20) return { text: "🙂 還算實用", color: "text-blue-400" };
  if (avg <= 30) return { text: "😐 微妙...不好說", color: "text-yellow-400" };
  if (avg <= 40) return { text: "🤔 有點雷喔", color: "text-orange-400" };
  return { text: "☠️ 恭喜! 超~級~雷~", color: "text-red-500 font-black animate-pulse" };
};

// --- Toast 通知元件 ---
const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down w-max max-w-[90%]">
      <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-600 flex items-center gap-2">
        <Info size={18} className="text-blue-400 shrink-0" />
        <span className="font-bold text-sm md:text-base">{message}</span>
      </div>
    </div>
  );
};

// --- 獨立的雪花背景元件 ---
const SnowBackground = memo(() => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    const snowflakes = Array.from({ length: 40 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 1 + 0.5
    }));
    let animationFrameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      snowflakes.forEach(flake => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
        flake.y += flake.speed;
        if (flake.y > canvas.height) flake.y = 0;
      });
      animationFrameId = requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener('resize', setSize);
    return () => {
      window.removeEventListener('resize', setSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" />;
});

// --- UI 元件 ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 border border-white/10 text-white ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', className = "", disabled = false, size = 'lg' }) => {
  const baseStyle = "rounded-full font-bold transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2 select-none";
  const sizeStyles = {
    sm: "px-4 py-2 text-base",
    md: "px-6 py-3 text-lg",
    lg: "px-8 py-4 text-xl"
  };
  const variants = {
    primary: "bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white border border-white/20",
    secondary: "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30",
    neutral: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-red-900/50",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      {children}
    </button>
  );
};

// --- 子元件：投票卡片 (重構：隱藏總分版) ---
const VotingItem = ({ receiverUid, receiverName, roomData, vote, submitGiftDescription, currentUserId }) => {
  const giverUid = roomData.resultMapping[receiverUid];
  const giverName = roomData.participants[giverUid] || "未知";
  const details = roomData.matchDetails[receiverUid] || { giftName: '', ratings: {} };

  // 取得評分資料 (但不加總顯示，只顯示自己的)
  const ratings = details.ratings || {};

  // 我的評分 (如果還沒評過，預設 1 分)
  const myRating = ratings[currentUserId] || 1;

  const [tempGiftName, setTempGiftName] = useState(details.giftName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (details.giftName && !tempGiftName) {
      setTempGiftName(details.giftName);
    }
  }, [details.giftName]);

  const handleSave = async () => {
    setIsSaving(true);
    await submitGiftDescription(receiverUid, tempGiftName);
    setIsSaving(false);
  };

  return (
    <Card className="p-5 mb-4 border border-white/5">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div className="text-lg text-slate-300">
          🎁 <span className="font-bold text-white text-xl">{giverName}</span> 送給 {receiverName}
        </div>
        {/* 隱藏總分顯示，改為問號 */}
        <div className="flex flex-col items-end">
          <span className="text-5xl font-black text-slate-500 animate-pulse">?</span>
          <span className="text-xs text-slate-500 uppercase tracking-widest">等待開票</span>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <input
          type="text"
          className="flex-1 bg-slate-950/50 border-b-2 border-slate-600 p-3 text-lg outline-none focus:border-purple-500 text-white placeholder-slate-600 transition-colors rounded-t-lg"
          placeholder="輸入禮物內容..."
          value={tempGiftName}
          onChange={(e) => setTempGiftName(e.target.value)}
        />
        <button
          onClick={handleSave}
          className="bg-slate-700 hover:bg-purple-600 text-white px-4 rounded-lg flex items-center gap-1 transition-colors"
          disabled={isSaving}
        >
          <Save size={20} />
        </button>
      </div>

      {/* 個人評分區 (這個才是重點) */}
      <div className="bg-slate-950/40 p-3 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400 flex items-center gap-1"><Star size={14} className="text-yellow-500" /> 你的評分</span>
          <span className="text-2xl font-bold text-yellow-400">{myRating} <span className="text-sm font-normal text-slate-500">分</span></span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => vote(receiverUid, -1)} className="flex-1 h-12 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600 text-2xl font-bold active:scale-95">-</button>
          <button onClick={() => vote(receiverUid, 1)} className="flex-1 h-12 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-500 active:scale-95 transition-transform shadow-lg shadow-red-900/50 text-2xl font-bold">+</button>
        </div>
      </div>
    </Card>
  );
};

// --- 主程式 ---
const App = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // Toast state

  // 本地輸入狀態
  const [myRuleInput, setMyRuleInput] = useState('');
  const [myGiftGiver, setMyGiftGiver] = useState('');

  const showToast = (msg) => {
    setToast(msg);
  };

  if (!isConfigured) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white p-10 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold mb-4 text-red-500">尚未設定 Firebase</h1>
          <p className="text-slate-400">請設定環境變數 (.env) 或手動填入 Config。</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) { console.error(e); }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) { console.error(error); }
      }
    };
    if (auth) {
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !isInRoom) {
      const savedRoomId = localStorage.getItem('xmas_last_room_id');
      if (savedRoomId) setRoomId(savedRoomId);
    }
  }, [user]);

  // 監聽房間 + 自動流程邏輯
  useEffect(() => {
    if (!user || !roomId || !db) return;
    const roomRef = doc(db, 'xmas_rooms', `room_${roomId}`);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);

        // 檢查是否加入
        if (data.participants && data.participants[user.uid]) {
          setIsInRoom(true);
          setUserName(data.participants[user.uid]);

          // 還原規則輸入
          if (data.phase === 'rule-entry') {
            const myRule = data.rules.find(r => r.uid === user.uid);
            if (myRule && myRule.text) setMyRuleInput(myRule.text);
          }
        }

        // --- 自動流程 (由房主觸發) ---
        if (data.hostId === user.uid) {
          const participantCount = Object.keys(data.participants).length;

          // 1. 自動進入遊戲：所有人規則都寫了
          if (data.phase === 'rule-entry' && participantCount > 1) {
            const finishedRules = data.rules.filter(r => r.text && r.text.trim() !== "").length;
            if (finishedRules === participantCount) {
              // 自動進下一關
              nextPhase('game-playing', data);
            }
          }

          // 2. 自動進入投票：所有人回報完畢
          if (data.phase === 'result-entry' && participantCount > 1) {
            const reportedCount = Object.keys(data.resultMapping || {}).length;
            if (reportedCount === participantCount) {
              nextPhase('voting', data);
            }
          }
        }

      } else {
        setRoomData(null);
      }
    });
    return () => unsubscribe();
  }, [user, roomId]);

  // --- 動作函式 ---

  const handleLogout = async () => {
    if (confirm("確定要重置身份嗎？")) {
      localStorage.removeItem('xmas_last_room_id');
      await signOut(auth);
      window.location.reload();
    }
  };

  const leaveRoom = async () => {
    if (!confirm("確定要離開房間嗎？")) return;

    const roomRef = doc(db, 'xmas_rooms', `room_${roomId}`);
    const newParticipants = { ...roomData.participants };
    delete newParticipants[user.uid];

    // 檢查是否為最後一人
    if (Object.keys(newParticipants).length === 0) {
      // 清除房間
      await deleteDoc(roomRef);
      showToast("房間已清除 👋");
    } else {
      // 更新名單，如果是房主離開，轉移權限
      let updates = { participants: newParticipants };
      if (roomData.hostId === user.uid) {
        updates.hostId = Object.keys(newParticipants)[0]; // 轉給下一個人
      }
      await updateDoc(roomRef, updates);
    }

    localStorage.removeItem('xmas_last_room_id');
    window.location.reload();
  }

  const joinRoom = async () => {
    const safeRoomId = roomId.toString().trim();
    const safeUserName = userName.trim();
    if (!safeRoomId || !safeUserName) {
      showToast("請輸入完整的房間代碼和名字");
      return;
    }

    setRoomId(safeRoomId);
    setUserName(safeUserName);

    const roomRef = doc(db, 'xmas_rooms', `room_${safeRoomId}`);
    try {
      const docSnap = await getDoc(roomRef);
      if (!docSnap.exists()) {
        await setDoc(roomRef, {
          hostId: user.uid,
          phase: 'entry',
          participants: { [user.uid]: safeUserName },
          rules: [],
          currentRuleIndex: 0,
          resultMapping: {},
          matchDetails: {},
          punishment: "尚未抽出",
          createdAt: new Date().toISOString()
        });
      } else {
        const currentData = docSnap.data();
        if (currentData.phase !== 'entry' && !currentData.participants[user.uid]) {
          showToast("遊戲已經開始，無法中途加入！");
          return;
        }
        await updateDoc(roomRef, { [`participants.${user.uid}`]: safeUserName });
      }
      localStorage.setItem('xmas_last_room_id', safeRoomId);
      setIsInRoom(true);
    } catch (e) {
      showToast("加入失敗，請檢查網路");
    }
  };

  const copyInvite = () => {
    const inviteText = `🎄 交換禮物派對！\n連結：${window.location.href}\n代碼：${roomId}`;
    const textArea = document.createElement("textarea");
    textArea.value = inviteText;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("✅ 邀請已複製！");
    } catch (err) {
      alert(`請複製：\n\n${inviteText}`);
    }
    document.body.removeChild(textArea);
  };

  const updateRoom = async (updates) => {
    if (!roomId) return;
    const roomRef = doc(db, 'xmas_rooms', `room_${roomId}`);
    await updateDoc(roomRef, updates);
  };

  const pickRandomRule = () => {
    const random = RANDOM_RULES[Math.floor(Math.random() * RANDOM_RULES.length)];
    setMyRuleInput(random);
  };

  // 修改 nextPhase 以支援傳入 data (用於自動流程)
  const nextPhase = async (nextPhaseName, currentData = roomData) => {
    if (!currentData) return;
    let updates = { phase: nextPhaseName };

    if (nextPhaseName === 'rule-entry' && currentData.phase === 'entry') {
      const pIds = Object.keys(currentData.participants);
      const initialRules = pIds.map(uid => ({
        uid,
        authorName: currentData.participants[uid],
        text: ""
      }));
      updates.rules = initialRules;
    }

    if (nextPhaseName === 'game-playing' && currentData.phase === 'rule-entry') {
      const shuffled = [...currentData.rules];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      updates.rules = shuffled;
      updates.currentRuleIndex = 0;
    }

    if (nextPhaseName === 'result-entry') {
      updates.resultMapping = {};
    }

    if (nextPhaseName === 'voting') {
      const details = {};
      Object.keys(currentData.participants).forEach(uid => {
        // 初始化評分物件 ratings: {}
        details[uid] = { giftName: '', ratings: {} };
      });
      updates.matchDetails = details;
    }

    await updateRoom(updates);
  };

  const submitRule = async () => {
    if (!myRuleInput.trim()) return;
    const myIndex = roomData.rules.findIndex(r => r.uid === user.uid);
    if (myIndex === -1) return;
    const newRules = [...roomData.rules];
    newRules[myIndex].text = myRuleInput;
    await updateRoom({ rules: newRules });
    showToast("規則已送出！等待其他人...");
  };

  const nextRule = async () => {
    if (roomData.currentRuleIndex < roomData.rules.length - 1) {
      await updateRoom({ currentRuleIndex: increment(1) });
    } else {
      nextPhase('result-entry');
    }
  };

  const submitResult = async () => {
    if (!myGiftGiver) return;
    await updateRoom({ [`resultMapping.${user.uid}`]: myGiftGiver });
    showToast("已回報！等待全員完成...");
  };

  const submitGiftDescription = async (targetUid, text) => {
    await updateRoom({ [`matchDetails.${targetUid}.giftName`]: text });
    showToast("儲存成功");
  };

  // 個人評分邏輯
  const vote = async (targetUid, delta) => {
    const currentDetails = roomData.matchDetails[targetUid] || {};
    const currentRatings = currentDetails.ratings || {};

    // 取得我原本的分數，預設 1
    const myCurrentScore = currentRatings[user.uid] || 1;
    let newScore = myCurrentScore + delta;

    // 限制 1~10 分
    newScore = Math.max(1, Math.min(10, newScore));

    // 更新 Firestore 中我的那一筆分數
    await updateRoom({ [`matchDetails.${targetUid}.ratings.${user.uid}`]: newScore });
  };

  const drawPunishment = async () => {
    const punishments = [
      "屁股寫字：寫「我是雷包」", "喝特調飲料（苦瓜+可樂）", "戴著聖誕帽直到派對結束",
      "模仿貼圖動作讓大家拍照", "向現場每一個人大喊「聖誕快樂」並擁抱", "請全場喝飲料",
      "用臉衝破保鮮膜", "清唱一首聖誕歌（副歌）"
    ];
    const picked = punishments[Math.floor(Math.random() * punishments.length)];
    await updateRoom({ punishment: picked });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">載入中...</div>;

  // 1. 登入/大廳頁面
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex items-center justify-center relative overflow-hidden">
        <SnowBackground />
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        <Card className="w-full max-w-md z-10 text-center border-t-4 border-t-purple-500">
          <div className="flex justify-center mb-6">
            <div className="p-5 bg-purple-500/20 rounded-full">
              <Gift size={64} className="text-purple-300" />
            </div>
          </div>
          <h1 className="text-4xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
            2025 交換禮物
          </h1>
          <p className="text-slate-400 mb-10 text-base uppercase tracking-widest">Party Online</p>

          <div className="space-y-6">
            <div className="text-left">
              <label className="text-sm font-bold text-slate-400 ml-1 mb-2 block">你的名字</label>
              <input
                type="text"
                className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:border-purple-500 outline-none text-white placeholder-slate-500 transition-all focus:bg-slate-800 text-lg"
                placeholder="例：派對小天才"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
            </div>
            <div className="text-left">
              <label className="text-sm font-bold text-slate-400 ml-1 mb-2 block">房間代碼</label>
              <input
                type="number"
                className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:border-purple-500 outline-none text-white placeholder-slate-500 transition-all focus:bg-slate-800 text-lg"
                placeholder="例：8888"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
              />
            </div>
            <Button onClick={joinRoom} size="lg" className="w-full mt-6 shadow-purple-900/50 text-xl py-5">
              <LogIn size={24} /> 進入房間
            </Button>

            <div className="pt-8 border-t border-white/5">
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 mx-auto text-sm text-slate-500 hover:text-slate-300 transition-colors">
                <RotateCcw size={14} /> 重置身份 (測試用)
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. 遊戲房間內
  if (!roomData) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">讀取房間資料中...</div>;

  const isHost = user.uid === roomData.hostId;
  const participantList = Object.entries(roomData.participants).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 font-sans text-white relative pb-20">
      <SnowBackground />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* 頂部資訊列 */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 shadow-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-purple-500/30">Room {roomId}</div>
            <span className="font-bold truncate max-w-[140px] text-slate-200 text-lg">{userName}</span>
          </div>
          <div className="text-sm text-slate-400 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full">
            <Users size={16} /> {participantList.length}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {participantList.map(([uid, name]) => (
            <span key={uid} className={`shrink-0 px-4 py-1.5 rounded-full text-sm border flex items-center gap-1 transition-all ${uid === user.uid ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              {uid === roomData.hostId && <span className="text-yellow-400">👑</span>}
              {name}
            </span>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-3xl mx-auto p-4 flex flex-col gap-8 mt-4">

        {roomData.phase === 'entry' && (
          <div className="animate-fade-in space-y-8">
            <Card className="text-center py-16 border-t-4 border-t-emerald-500">
              <h2 className="text-3xl font-bold mb-3">準備開始</h2>
              <p className="text-slate-400 text-lg mb-10">Waiting for players...</p>

              <div className="flex flex-wrap gap-3 justify-center mb-10">
                {participantList.map(([uid, name]) => (
                  <span key={uid} className="bg-slate-800 text-slate-200 px-5 py-3 rounded-2xl text-lg font-bold border border-slate-700">
                    {name}
                  </span>
                ))}
              </div>

              <div className="mb-8">
                <Button onClick={copyInvite} variant="secondary" className="w-full bg-emerald-600/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/40 py-4">
                  <Share2 size={22} /> 複製邀請連結
                </Button>
              </div>

              {isHost ? (
                <Button onClick={() => nextPhase('rule-entry')} size="lg" className="w-full shadow-emerald-900/50 text-2xl py-6">
                  開始設定規則 <ArrowRight />
                </Button>
              ) : (
                <p className="text-slate-500 animate-pulse text-base">等待房主開始遊戲...</p>
              )}
            </Card>
          </div>
        )}

        {/* --- 階段 2: 撰寫規則 --- */}
        {roomData.phase === 'rule-entry' && (
          <div className="animate-fade-in space-y-8">
            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Edit3 className="text-purple-400" size={28} /> 你的交換指令
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">發揮創意，讓場面混亂起來！</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-purple-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[160px]"
                  placeholder="例：跟左手邊第三個人交換..."
                  value={myRuleInput}
                  onChange={e => setMyRuleInput(e.target.value)}
                  disabled={roomData.rules.find(r => r.uid === user.uid)?.text !== ""}
                />
              </div>

              <div className="flex justify-end mb-8">
                <button onClick={pickRandomRule} disabled={roomData.rules.find(r => r.uid === user.uid)?.text !== ""} className="text-sm text-purple-300 flex items-center gap-2 hover:text-white transition-colors bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/20">
                  <Shuffle size={16} /> 隨機靈感
                </button>
              </div>

              <Button onClick={submitRule} className="w-full text-xl py-5" disabled={!myRuleInput}>
                {roomData.rules.find(r => r.uid === user.uid)?.text !== "" ? "已送出等待中..." : "送出指令"}
              </Button>
            </Card>

            <div className="text-center text-slate-500 text-sm">
              完成進度： {roomData.rules.filter(r => r.text).length} / {participantList.length}
            </div>
          </div>
        )}

        {/* --- 階段 3: 遊戲進行 --- */}
        {roomData.phase === 'game-playing' && (
          <div className="animate-fade-in py-10 flex flex-col items-center">
            <div className="text-slate-400 mb-8 text-center w-full">
              <div className="flex justify-between text-sm mb-3 px-3">
                <span>Round {roomData.currentRuleIndex + 1}</span>
                <span>Total {roomData.rules.length}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${((roomData.currentRuleIndex + 1) / roomData.rules.length) * 100}%` }}></div>
              </div>
            </div>

            <Card className="w-full text-center py-20 transform transition-all duration-500 hover:scale-[1.02] border-t-4 border-t-purple-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <div className="mb-8">
                <span className="bg-slate-800 text-slate-300 px-5 py-2 rounded-full text-sm font-bold border border-slate-700">
                  由 {roomData.rules[roomData.currentRuleIndex].authorName} 指定
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg px-4">
                {roomData.rules[roomData.currentRuleIndex].text || "（這人太懶，沒寫規則，這回合休息）"}
              </h2>
            </Card>

            {isHost && (
              <div className="mt-10 w-full">
                <Button onClick={nextRule} size="lg" className="w-full text-2xl py-6">
                  {roomData.currentRuleIndex < roomData.rules.length - 1 ? "下一條指令 ➔" : "遊戲結束，進入結算 🏁"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* --- 階段 4: 結果回報 --- */}
        {roomData.phase === 'result-entry' && (
          <div className="animate-fade-in space-y-8">
            <Card className="border-t-4 border-t-blue-500 py-10">
              <h2 className="text-2xl font-bold text-center mb-8">🎁 你最後拿到了誰的禮物？</h2>
              <div className="space-y-6">
                <select
                  className="w-full p-5 bg-slate-800 border border-slate-600 rounded-2xl text-xl text-white focus:border-blue-500 outline-none appearance-none"
                  value={myGiftGiver}
                  onChange={e => setMyGiftGiver(e.target.value)}
                >
                  <option value="">請選擇...</option>
                  {participantList.map(([uid, name]) => (
                    <option key={uid} value={uid}>{name} 的禮物</option>
                  ))}
                </select>
                <Button onClick={submitResult} className="w-full bg-blue-600 border-blue-400 hover:bg-blue-500 text-xl py-5">確認送出</Button>
              </div>
            </Card>

            <div className="text-center">
              <h3 className="text-sm text-slate-500 mb-3">已回報玩家</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.keys(roomData.resultMapping).map(uid => (
                  <span key={uid} className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1.5 rounded-full border border-blue-500/30">
                    {roomData.participants[uid]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 階段 5: 投票審判 (使用新的子元件) --- */}
        {roomData.phase === 'voting' && (
          <div className="animate-fade-in space-y-6 pb-20">
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-2xl flex gap-4 items-start mb-6">
              <AlertTriangle className="text-yellow-500 shrink-0 mt-1" size={24} />
              <div>
                <h2 className="text-lg font-bold text-yellow-500">審判時刻</h2>
                <p className="text-sm text-yellow-200/70 mt-1">請幫大家輸入禮物內容，並按下 + 按鈕給予雷指數評分！</p>
              </div>
            </div>

            {participantList.map(([receiverUid, receiverName]) => (
              <VotingItem
                key={receiverUid}
                receiverUid={receiverUid}
                receiverName={receiverName}
                roomData={roomData}
                vote={vote}
                submitGiftDescription={submitGiftDescription}
                currentUserId={user.uid}
              />
            ))}

            {isHost && (
              <div className="fixed bottom-6 left-0 w-full px-4 z-50 flex justify-center">
                <Button variant="danger" className="w-full max-w-2xl shadow-2xl border-t border-red-400 text-2xl py-6" onClick={() => nextPhase('result')}>☠️ 結算懲罰 ☠️</Button>
              </div>
            )}
          </div>
        )}

        {/* --- 階段 6: 最終結果 --- */}
        {roomData.phase === 'result' && (
          <div className="animate-fade-in space-y-8 pb-20">
            <div className="text-center mb-10">
              <h2 className="text-5xl font-black text-yellow-400 drop-shadow-xl mb-3 flex items-center justify-center gap-3">
                <Star fill="currentColor" size={40} /> 雷王誕生 <Star fill="currentColor" size={40} />
              </h2>
              <p className="text-slate-400 text-lg">恭喜以下得主獲得大家的怨念</p>
            </div>

            {participantList.map(([uid]) => {
              const details = roomData.matchDetails[uid] || { ratings: {} };
              const totalScore = Object.values(details.ratings || {}).reduce((a, b) => a + b, 0);
              return {
                uid,
                ...details,
                totalScore,
                giverName: roomData.participants[roomData.resultMapping[uid]]
              };
            }).sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map((item, idx) => (
              <div key={item.uid} className={`relative rounded-3xl p-6 shadow-xl flex items-center gap-5 border ${idx === 0 ? 'bg-gradient-to-r from-yellow-900/80 to-slate-900 border-yellow-500 transform scale-105 z-10' : 'bg-slate-800/80 border-slate-700'}`}>
                {idx === 0 && <div className="absolute -top-4 -right-3 text-5xl animate-bounce">👑</div>}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0 ${idx === 0 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : idx === 1 ? 'bg-slate-500' : 'bg-amber-700'}`}>#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-2xl truncate mb-1">{item.giverName}</div>
                  <div className="text-base text-slate-400 truncate">{item.giftName || "神秘禮物"}</div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-red-500">{item.totalScore}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Points</div>
                </div>
              </div>
            ))}

            <Card className="bg-red-950/50 border-red-900/50 text-center mt-10 backdrop-blur-sm py-10">
              <h3 className="text-2xl font-bold text-red-400 mb-6 flex justify-center items-center gap-3"><Skull size={28} /> 懲罰內容</h3>
              <div className="text-3xl md:text-4xl font-black text-white mb-8 px-6 leading-tight bg-black/20 py-6 rounded-2xl border border-white/5">
                {roomData.punishment}
              </div>
              {isHost && (<Button variant="neutral" size="lg" onClick={drawPunishment} className="mx-auto bg-slate-800 text-slate-300 border-slate-700"><Zap size={20} /> 換一個懲罰</Button>)}
            </Card>

            <div className="text-center mt-12">
              <Button variant="secondary" onClick={leaveRoom} className="bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white px-10">
                <LogOut size={20} /> 離開房間
              </Button>
            </div>
          </div>
        )}

      </main>

      {/* 動畫樣式 */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-20px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; } 
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;