import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc, deleteDoc, deleteField, increment } from 'firebase/firestore';
import { Gift, Users, ArrowRight, Zap, Skull, Play, Edit3, AlertTriangle, LogIn, Share2, Link as LinkIcon, RotateCcw, Shuffle, Star, Save, X, LogOut, Info, CheckCircle, Clock, Bomb, Hash, Lightbulb, Ticket, Trees, Snowflake } from 'lucide-react';

// ==========================================
// ⚠️ 你的 Firebase 設定
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

// --- 嚴格統一排序函式 ---
const strictSort = (list) => {
  return [...list].sort((a, b) => (a > b ? 1 : -1));
};

// --- 隨機規則庫 ---
const RANDOM_RULES = [
  "所有人將禮物傳給「號碼 +1」的人 (循環)",
  "所有人將禮物傳給「號碼 -1」的人 (循環)",
  "所有人將禮物傳給「號碼 +2」的人 (循環)",
  "號碼是「單數」的人，起立向右移動兩個位置",
  "號碼是「雙數」的人，跟你的右手邊交換禮物",
  "號碼 1 號指定兩個人互換禮物",
  "號碼最大的跟號碼最小的互換禮物",
  "所有人按照號碼順序排成一圈，然後同時往右傳",
  "號碼是 3 的倍數的人，跟主持人交換",
  "所有人將禮物傳給「號碼 -2」的人 (循環)",
  "拿著禮物跟「號碼 +3」的人交換 (循環)",
  "跟你的右手邊第二個人交換"
];

// --- 隨機懲罰庫 ---
const RANDOM_PUNISHMENTS = [
  "屁股寫字：寫「我是雷包」",
  "喝特調飲料（苦瓜+可樂+醬油）",
  "戴著聖誕帽直到派對結束",
  "模仿貼圖動作讓大家拍照",
  "向現場每一個人大喊「聖誕快樂」並擁抱",
  "請全場喝飲料",
  "用臉衝破保鮮膜",
  "清唱一首聖誕歌（副歌）",
  "伏地挺身 20 下",
  "去隔壁桌/路人說「我是聖誕老公公」"
];

// --- 評分說明邏輯 ---
const getRatingLabel = (score) => {
  if (score <= 10) return { text: "😇 天使好禮", color: "text-emerald-400" };
  if (score <= 20) return { text: "🙂 還算實用", color: "text-blue-300" };
  if (score <= 30) return { text: "😐 微妙...不好說", color: "text-amber-400" };
  if (score <= 40) return { text: "🤔 有點雷喔", color: "text-orange-400" };
  return { text: "☠️ 恭喜! 超~級~雷~", color: "text-rose-500 font-black animate-pulse" };
};

// --- Toast 通知元件 ---
const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down w-max max-w-[90%] pointer-events-none">
      <div className="bg-slate-800/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.3)] border border-amber-500/30 flex items-center gap-2">
        <Info size={18} className="text-amber-400 shrink-0" />
        <span className="font-bold text-sm md:text-base tracking-wide">{message}</span>
      </div>
    </div>
  );
};

// --- 新版：數位抽獎看板 (Slot Machine Box) ---
const PunishmentSlotMachine = ({ text, isSpinning, hasResult }) => {
  return (
    <div className="w-full max-w-sm mx-auto my-4 relative">
      {/* 外框裝飾 */}
      <div className={`absolute -inset-1 rounded-2xl blur opacity-75 transition-all duration-300 ${isSpinning ? 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 animate-pulse' : hasResult ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-slate-700'}`}></div>

      <div className="relative bg-slate-900 rounded-xl border-2 border-slate-700 p-8 min-h-[200px] flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden">
        {/* 背景網格線效果 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

        {/* 上方標題 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">
          <Ticket size={12} /> Punishment
        </div>

        {/* 核心文字顯示區 */}
        <div className={`relative z-10 font-black text-2xl md:text-3xl leading-snug transition-all duration-100 ${isSpinning ? 'text-slate-300 blur-[0.5px] scale-95' : hasResult ? 'text-yellow-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'text-slate-500'}`}>
          {text}
        </div>

        {/* 裝飾線條 */}
        {isSpinning && <div className="absolute inset-0 w-full h-1 bg-white/20 animate-scan"></div>}
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
    const snowflakes = Array.from({ length: 50 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 1 + 0.5
    }));
    let animationFrameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 250, 240, 0.2)';
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
  <div className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-xl p-6 md:p-8 border border-white/10 text-white ${className}`}>
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
    primary: "bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white border border-white/10 shadow-rose-900/30",
    secondary: "bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-600 hover:to-green-500 text-white border border-white/10",
    neutral: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
    danger: "bg-red-800 hover:bg-red-700 text-white shadow-red-900/50",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      {children}
    </button>
  );
};

// --- 子元件：倒數計時器 ---
const CountdownDisplay = ({ onFinish }) => {
  const [count, setCount] = useState(10);

  useEffect(() => {
    if (count <= 0) {
      onFinish();
      return;
    }
    const timer = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="text-center animate-pulse">
        <div className="text-amber-400 text-4xl mb-4 font-bold flex items-center justify-center gap-2">
          <Star className="text-amber-400" fill="currentColor" /> 即將揭曉 <Star className="text-amber-400" fill="currentColor" />
        </div>
        <div className="text-[15rem] font-black text-white leading-none drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">{count}</div>
      </div>
    </div>
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
  const [toast, setToast] = useState(null);

  // 本地輸入狀態
  const [myRuleInput, setMyRuleInput] = useState('');
  const [myPunishmentInput, setMyPunishmentInput] = useState('');
  const [myGiftDescription, setMyGiftDescription] = useState('');
  const [myVotes, setMyVotes] = useState({}); // { targetUid: score }

  // 抽獎文字跳動狀態
  const [randomText, setRandomText] = useState("🎲 準備抽出...");

  // 鎖定動畫狀態
  const hasTriggeredAnimation = useRef(false);

  // 我的號碼
  const myNumber = roomData?.participantNumbers?.[user?.uid];

  const showToast = (msg) => {
    setToast(msg);
  };

  // 🔒 確保懲罰池一致 (雖然現在沒輪盤了，但文字跳動還是用這個池)
  const punishmentPool = useMemo(() => {
    const punishments = roomData?.punishments ? Object.values(roomData.punishments) : [];
    const pool = punishments.length === 0 ? [...RANDOM_PUNISHMENTS] : punishments;
    return strictSort(pool);
  }, [roomData?.punishments]);

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
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("登入失敗:", error);
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

        if (data.participants && data.participants[user.uid]) {
          setIsInRoom(true);
          setUserName(data.participants[user.uid]);

          if (data.phase === 'gift-entry') {
            const myGift = data.gifts ? data.gifts[user.uid] : '';
            if (myGift) setMyGiftDescription(myGift);
          }
          if (data.phase === 'rule-entry') {
            const myRule = data.rules.find(r => r.uid === user.uid);
            if (myRule && myRule.text) setMyRuleInput(myRule.text);
          }
          if (data.phase === 'punishment-entry') {
            const myP = data.punishments ? data.punishments[user.uid] : '';
            if (myP) setMyPunishmentInput(myP);
          }
        }

        // 處理抽獎動畫文字 (Client side)
        if (data.isSpinning && !hasTriggeredAnimation.current) {
          hasTriggeredAnimation.current = true;

          let index = 0;
          const interval = setInterval(() => {
            let pool = data.punishments ? Object.values(data.punishments) : RANDOM_PUNISHMENTS;
            pool = strictSort(pool);
            setRandomText(pool[index % pool.length]);
            index++;
          }, 80);

          // 保險機制
          const timeout = setTimeout(() => {
            clearInterval(interval);
          }, 10000);

          window.spinInterval = interval;
          return () => {
            clearInterval(interval);
            clearTimeout(timeout);
          }
        }

        // 停止轉動
        if (data.finalPunishment && !data.isSpinning) {
          if (window.spinInterval) clearInterval(window.spinInterval);
          hasTriggeredAnimation.current = false;
        } else if (data.isSpinning === false && !data.finalPunishment) {
          hasTriggeredAnimation.current = false;
          setRandomText("🎲 準備抽出...");
        }

        // --- 自動流程 ---
        if (data.hostId === user.uid) {
          const participantCount = Object.keys(data.participants).length;

          if (data.phase === 'gift-entry' && participantCount > 1) {
            const finishedGifts = Object.keys(data.gifts || {}).length;
            if (finishedGifts === participantCount) nextPhase('rule-entry', data);
          }

          if (data.phase === 'rule-entry' && participantCount > 1) {
            const finishedRules = data.rules.filter(r => r.text && r.text.trim() !== "").length;
            if (finishedRules === participantCount) nextPhase('punishment-entry', data);
          }

          if (data.phase === 'punishment-entry' && participantCount > 1) {
            const finishedPunishments = Object.keys(data.punishments || {}).length;
            if (finishedPunishments === participantCount) nextPhase('game-playing', data);
          }

          if (data.phase === 'voting' && participantCount > 1) {
            const votedCount = Object.keys(data.votingStatus || {}).length;
            if (votedCount === participantCount) nextPhase('countdown', data);
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
    const currentDoc = await getDoc(roomRef);
    if (!currentDoc.exists()) {
      localStorage.removeItem('xmas_last_room_id');
      window.location.reload();
      return;
    }

    const currentData = currentDoc.data();
    const newParticipants = { ...currentData.participants };
    delete newParticipants[user.uid];

    if (Object.keys(newParticipants).length === 0) {
      await deleteDoc(roomRef);
      showToast("房間已清除 👋");
    } else {
      let updates = { participants: newParticipants };
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
          participantNumbers: {},
          gifts: {},
          rules: [],
          punishments: {},
          currentRuleIndex: 0,
          votingStatus: {},
          ratings: {},
          finalResults: null,
          finalPunishment: null,
          isSpinning: false,
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
      showToast("複製失敗，請手動複製");
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

  const pickRandomPunishmentInput = () => {
    const random = RANDOM_PUNISHMENTS[Math.floor(Math.random() * RANDOM_PUNISHMENTS.length)];
    setMyPunishmentInput(random);
  };

  const nextPhase = async (nextPhaseName, currentData = roomData) => {
    if (!currentData) return;
    let updates = { phase: nextPhaseName };

    if (nextPhaseName === 'gift-entry' && currentData.phase === 'entry') {
      const pIds = Object.keys(currentData.participants);
      const count = pIds.length;
      const numbers = Array.from({ length: count }, (_, i) => i + 1);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      const assignedNumbers = {};
      pIds.forEach((uid, index) => {
        assignedNumbers[uid] = numbers[index];
      });
      updates.participantNumbers = assignedNumbers;
    }

    if (nextPhaseName === 'rule-entry') {
      const pIds = Object.keys(currentData.participants);
      const initialRules = pIds.map(uid => ({
        uid,
        authorName: currentData.participants[uid],
        text: ""
      }));
      updates.rules = initialRules;
    }

    if (nextPhaseName === 'game-playing') {
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
        details[uid] = { giftName: '', ratings: {} };
      });
      updates.matchDetails = details;
    }

    if (nextPhaseName === 'result') {
      const results = Object.keys(currentData.participants).map(uid => {
        const userRatings = currentData.ratings ? currentData.ratings[uid] : {};
        const totalScore = Object.values(userRatings || {}).reduce((a, b) => a + b, 0);
        return {
          uid,
          name: currentData.participants[uid],
          giftName: currentData.gifts ? currentData.gifts[uid] : "神秘禮物",
          totalScore
        };
      });
      updates.finalResults = results;
    }

    await updateRoom(updates);
  };

  const submitGift = async () => {
    if (!myGiftDescription.trim()) return;
    await updateRoom({ [`gifts.${user.uid}`]: myGiftDescription });
    showToast("禮物已登錄！等待其他人...");
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

  const submitPunishmentInput = async () => {
    if (!myPunishmentInput.trim()) return;
    await updateRoom({ [`punishments.${user.uid}`]: myPunishmentInput });
    showToast("惡作劇已送出！嘿嘿嘿...");
  };

  const nextRule = async () => {
    if (roomData.currentRuleIndex < roomData.rules.length - 1) {
      await updateRoom({ currentRuleIndex: increment(1) });
    } else {
      nextPhase('voting');
    }
  };

  const handleVoteChange = (targetUid, score) => {
    setMyVotes(prev => ({
      ...prev,
      [targetUid]: score
    }));
  };

  const submitVotes = async () => {
    const updates = { [`votingStatus.${user.uid}`]: true };
    Object.keys(roomData.participants).forEach(targetUid => {
      if (targetUid === user.uid) return;
      const score = myVotes[targetUid] || 1;
      updates[`ratings.${targetUid}.${user.uid}`] = score;
    });
    await updateRoom(updates);
    showToast("評分已送出！等待開票...");
  };

  // 抽獎邏輯 (主持人執行)
  const spinPunishment = async () => {
    try {
      await updateRoom({ isSpinning: true, finalPunishment: null });

      setTimeout(async () => {
        let pool = Object.values(roomData.punishments || {});
        if (pool.length === 0) pool = RANDOM_PUNISHMENTS;
        pool = strictSort(pool);

        const final = pool[Math.floor(Math.random() * pool.length)];

        await updateRoom({
          finalPunishment: final,
          isSpinning: false
        });
      }, 3000);
    } catch (e) {
      showToast("抽獎發生錯誤，請重試");
      await updateRoom({ isSpinning: false });
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">載入中...</div>;

  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 p-6 flex items-center justify-center relative overflow-hidden">
        <SnowBackground />
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        <Card className="w-full max-w-md z-10 text-center border-t-4 border-t-amber-500">
          <div className="flex justify-center mb-6">
            <div className="p-5 bg-rose-600/20 rounded-full border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
              <Gift size={64} className="text-rose-400" />
            </div>
          </div>
          <h1 className="text-4xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-500 drop-shadow-sm">
            2025 交換禮物
          </h1>
          <div className="flex items-center justify-center gap-2 mb-10">
            <Trees className="text-emerald-500" size={18} />
            <p className="text-slate-400 text-base uppercase tracking-widest">Midnight Party</p>
            <Snowflake className="text-sky-300" size={18} />
          </div>

          <div className="space-y-6">
            <div className="text-left">
              <label className="text-sm font-bold text-amber-500/80 ml-1 mb-2 block">你的名字 / Nickname</label>
              <input
                type="text"
                className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:border-amber-500 outline-none text-white placeholder-slate-500 transition-all focus:bg-slate-800 text-lg"
                placeholder="例：派對小天才"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
            </div>
            <div className="text-left">
              <label className="text-sm font-bold text-amber-500/80 ml-1 mb-2 block">房間代碼 / Room ID</label>
              <input
                type="number"
                className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:border-amber-500 outline-none text-white placeholder-slate-500 transition-all focus:bg-slate-800 text-lg"
                placeholder="例：8888"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
              />
            </div>
            <Button onClick={joinRoom} size="lg" className="w-full mt-6 text-xl py-5 shadow-[0_4px_14px_0_rgba(225,29,72,0.39)]">
              <LogIn size={24} /> 進入房間
            </Button>

            <div className="pt-8 border-t border-white/5">
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 mx-auto text-sm text-slate-500 hover:text-slate-300 transition-colors">
                <RotateCcw size={14} /> 重置身份
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!roomData) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">讀取房間資料中...</div>;

  const isHost = user.uid === roomData.hostId;
  const participantList = Object.entries(roomData.participants).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 font-sans text-white relative pb-20 overflow-hidden">
      <SnowBackground />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* 10秒倒數遮罩 */}
      {roomData.phase === 'countdown' && (
        <CountdownDisplay onFinish={() => isHost && nextPhase('result')} />
      )}

      {/* 頂部資訊列 (現在全頁面顯示) */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 shadow-lg px-4 py-3">
        <div className="flex justify-between items-center gap-3">
          {/* 左邊：房間資訊與個人資訊 */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-rose-600/90 text-white px-3 py-1 rounded text-xs font-bold shadow-lg shadow-rose-900/20 shrink-0 tracking-wider">Room {roomId}</div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate max-w-[120px] text-amber-50 text-sm leading-tight mb-0.5">{userName}</span>
              {myNumber && <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1"><Hash size={8} /> 你的號碼: {myNumber}</span>}
            </div>
          </div>

          {/* 中間：人數 */}
          <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/50 px-3 py-1 rounded-full shrink-0 border border-white/5">
            <Users size={12} className="text-emerald-400" /> {participantList.length}
          </div>

          {/* 右邊：離開按鈕 */}
          <button
            onClick={leaveRoom}
            className="shrink-0 bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/5 p-2 rounded-lg transition-colors"
            title="離開房間"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className={`relative z-10 max-w-3xl mx-auto p-4 flex flex-col gap-8 ${roomData.phase === 'punishment-reveal' ? 'h-screen p-0 m-0 max-w-none' : 'mt-6'}`}>

        {/* --- 階段 1: 等待大廳 (Entry) --- */}
        {roomData.phase === 'entry' && (
          <div className="animate-fade-in space-y-8">
            <Card className="text-center py-16 border-t-4 border-t-emerald-500">
              <div className="flex justify-center mb-4">
                <Trees className="text-emerald-500 animate-pulse" size={48} />
              </div>
              <h2 className="text-3xl font-bold mb-3 text-amber-50">準備開始</h2>
              <p className="text-slate-400 text-lg mb-10">等待主持人開始遊戲...</p>

              <div className="flex flex-wrap gap-3 justify-center mb-10">
                {participantList.map(([uid, name]) => (
                  <span key={uid} className="bg-slate-800/80 text-slate-200 px-5 py-2 rounded-xl text-lg font-bold border border-slate-700 shadow-sm">
                    {name}
                  </span>
                ))}
              </div>

              <div className="mb-8">
                <Button onClick={copyInvite} variant="secondary" className="w-full py-4 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Share2 size={22} /> 複製邀請連結
                </Button>
              </div>

              {isHost ? (
                <Button onClick={() => nextPhase('gift-entry')} size="lg" className="w-full text-2xl py-6 shadow-[0_0_20px_rgba(225,29,72,0.4)]" disabled={participantList.length < 2}>
                  下一步：登錄禮物 <ArrowRight />
                </Button>
              ) : (
                <p className="text-slate-500 animate-pulse text-base">等待主持人開始遊戲...</p>
              )}
            </Card>
          </div>
        )}

        {/* --- 階段 1.5: 禮物登錄 (Gift Entry) --- */}
        {roomData.phase === 'gift-entry' && (
          <div className="animate-fade-in space-y-8">
            {/* 顯示我的號碼卡片 */}
            {myNumber && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl text-center shadow-[0_0_30px_rgba(245,158,11,0.1)] animate-fade-in-up">
                <p className="text-amber-200 text-sm mb-1 uppercase tracking-widest">Your Number</p>
                <div className="text-6xl font-black text-amber-400 flex items-center justify-center gap-2 drop-shadow-md">
                  <Hash size={40} className="opacity-50" /> {myNumber}
                </div>
                <p className="text-xs text-amber-200/50 mt-3">請記住你的代號，等一下交換會用到！</p>
              </div>
            )}

            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Gift className="text-rose-400" size={28} /> 你的禮物是？
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">請簡單描述你帶來的禮物（其他人暫時看不到）</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-rose-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[120px]"
                  placeholder="例：一個很重的馬克杯..."
                  value={myGiftDescription}
                  onChange={e => setMyGiftDescription(e.target.value)}
                  disabled={roomData.gifts && roomData.gifts[user.uid]}
                />
              </div>

              <Button onClick={submitGift} className="w-full text-xl py-5" disabled={!myGiftDescription}>
                {roomData.gifts && roomData.gifts[user.uid] ? "已登錄，等待其他人..." : "確認登錄"}
              </Button>
            </Card>

            <div className="text-center text-slate-500 text-sm">
              完成進度： {Object.keys(roomData.gifts || {}).length} / {participantList.length}
            </div>
          </div>
        )}

        {/* --- 階段 2: 撰寫規則 --- */}
        {roomData.phase === 'rule-entry' && (
          <div className="animate-fade-in space-y-8">
            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Edit3 className="text-amber-400" size={28} /> 你的交換指令
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">發揮創意，讓場面混亂起來！</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-amber-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[160px]"
                  placeholder="例：所有人往右傳給 +1 號..."
                  value={myRuleInput}
                  onChange={e => setMyRuleInput(e.target.value)}
                  disabled={roomData.rules.find(r => r.uid === user.uid)?.text !== ""}
                />
              </div>

              <div className="flex justify-end mb-8">
                <button onClick={pickRandomRule} disabled={roomData.rules.find(r => r.uid === user.uid)?.text !== ""} className="text-sm text-amber-300 flex items-center gap-2 hover:text-white transition-colors bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20">
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

        {/* --- 階段 2.5: 撰寫懲罰 (Punishment Entry) --- */}
        {roomData.phase === 'punishment-entry' && (
          <div className="animate-fade-in space-y-8">
            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Bomb className="text-rose-500" size={28} /> 你的懲罰點子
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">請提供一個「懲罰」，最後大家一起抽！</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-rose-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[160px]"
                  placeholder="例：用屁股寫字..."
                  value={myPunishmentInput}
                  onChange={e => setMyPunishmentInput(e.target.value)}
                  disabled={roomData.punishments && roomData.punishments[user.uid]}
                />
              </div>

              <div className="flex justify-end mb-8">
                <button onClick={pickRandomPunishmentInput} disabled={roomData.punishments && roomData.punishments[user.uid]} className="text-sm text-rose-300 flex items-center gap-2 hover:text-white transition-colors bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">
                  <Shuffle size={16} /> 隨機懲罰靈感
                </button>
              </div>

              <Button onClick={submitPunishmentInput} className="w-full text-xl py-5 bg-rose-600 hover:bg-rose-500 shadow-rose-900/50 border-none" disabled={!myPunishmentInput}>
                {roomData.punishments && roomData.punishments[user.uid] ? "已送出等待中..." : "送出懲罰"}
              </Button>
            </Card>

            <div className="text-center text-slate-500 text-sm">
              完成進度： {Object.keys(roomData.punishments || {}).length} / {participantList.length}
            </div>
          </div>
        )}

        {/* --- 階段 3: 遊戲進行 --- */}
        {roomData.phase === 'game-playing' && (
          <div className="animate-fade-in py-10 flex flex-col items-center">
            <div className="text-slate-400 mb-8 text-center w-full px-4">
              <div className="flex justify-between text-sm mb-3 px-1 font-bold tracking-widest uppercase">
                <span>Round {roomData.currentRuleIndex + 1}</span>
                <span>Total {roomData.rules.length}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" style={{ width: `${((roomData.currentRuleIndex + 1) / roomData.rules.length) * 100}%` }}></div>
              </div>
            </div>

            <Card className="w-full text-center py-20 transform transition-all duration-500 hover:scale-[1.02] border-t-4 border-t-amber-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <div className="mb-8">
                <span className="bg-slate-800 text-amber-200 px-5 py-2 rounded-full text-sm font-bold border border-amber-500/20 shadow-sm">
                  由 {roomData.rules[roomData.currentRuleIndex].authorName} 指定
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg px-4">
                {roomData.rules[roomData.currentRuleIndex].text || "（這人太懶，沒寫規則，這回合休息）"}
              </h2>
            </Card>

            {isHost && (
              <div className="mt-10 w-full">
                <Button onClick={nextRule} size="lg" className="w-full text-2xl py-6 shadow-[0_0_25px_rgba(225,29,72,0.4)]">
                  {roomData.currentRuleIndex < roomData.rules.length - 1 ? "下一條指令 ➔" : "遊戲結束，進入投票 🏁"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* --- 階段 5: 投票審判 --- */}
        {roomData.phase === 'voting' && (
          <div className="animate-fade-in space-y-6 pb-24">
            {/* 狀態提示 */}
            {roomData.votingStatus && roomData.votingStatus[user.uid] ? (
              <Card className="text-center py-12 border-t-4 border-t-emerald-500">
                <CheckCircle size={64} className="text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-white">評分已送出</h2>
                <p className="text-slate-400">等待其他人完成...</p>
                <div className="mt-6 text-sm text-slate-500 bg-slate-800/50 inline-block px-4 py-1 rounded-full">
                  進度：{Object.keys(roomData.votingStatus || {}).length} / {participantList.length}
                </div>
              </Card>
            ) : (
              <>
                <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex gap-4 items-start mb-6">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24} />
                  <div>
                    <h2 className="text-lg font-bold text-amber-500">審判時刻</h2>
                    <p className="text-sm text-amber-200/70 mt-1">請依序對大家的禮物評分！<br />分數越高 = 越雷 (10分=爛透了)</p>
                  </div>
                </div>

                {participantList.map(([targetUid, targetName]) => {
                  if (targetUid === user.uid) return null; // 不用評自己
                  const giftName = roomData.gifts ? roomData.gifts[targetUid] : "神秘禮物";
                  const myScore = myVotes[targetUid] || 1; // 預設 1

                  return (
                    <Card key={targetUid} className="p-5 border border-white/5 relative overflow-hidden mb-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-sm text-slate-400 mb-1">{targetName} 的禮物</div>
                          <div className="text-xl font-bold text-white">{giftName}</div>
                        </div>
                        <div className="text-4xl font-black text-amber-400">{myScore}</div>
                      </div>

                      <input
                        type="range"
                        min="1" max="10"
                        value={myScore}
                        onChange={(e) => handleVoteChange(targetUid, parseInt(e.target.value))}
                        className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-sm text-slate-400 mt-2 px-1 font-bold">
                        <span>1 (天使)</span>
                        <span>5 (普通)</span>
                        <span>10 (雷爆)</span>
                      </div>
                    </Card>
                  );
                })}

                <div className="h-20"></div> {/* Spacer */}

                <div className="fixed bottom-6 left-0 w-full px-4 z-50 flex justify-center">
                  <Button variant="danger" className="w-full max-w-2xl shadow-2xl border-t border-red-400 text-2xl py-6" onClick={submitVotes}>
                    ✅ 確認送出評分
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- 階段 6: 最終結果 (Leaderboard) --- */}
        {roomData.phase === 'result' && (
          <div className="animate-fade-in space-y-8 pb-20">
            {/* 跑馬燈預告 */}
            <div className="bg-amber-500/20 text-amber-300 py-2 text-center text-sm font-bold border-y border-amber-500/30 animate-pulse">
              ⚠️ 下一階段：命運大輪盤！準備抽出懲罰...
            </div>

            <div className="text-center mb-10">
              <h2 className="text-5xl font-black text-amber-400 drop-shadow-xl mb-3 flex items-center justify-center gap-3">
                <Star fill="currentColor" size={40} /> 本日最雷王誕生 <Star fill="currentColor" size={40} />
              </h2>
              <p className="text-slate-400 text-lg">恭喜以下得主獲得大家的怨念</p>
            </div>

            {/* 使用 Snapshot 資料 (finalResults) 渲染 */}
            {(roomData.finalResults || []).sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map((item, idx) => (
              <div key={item.uid} className={`relative rounded-3xl p-6 shadow-xl flex items-center gap-5 border ${idx === 0 ? 'bg-gradient-to-r from-amber-900/80 to-slate-900 border-amber-500 transform scale-105 z-10' : 'bg-slate-800/80 border-slate-700'}`}>
                {idx === 0 && <div className="absolute -top-4 -right-3 text-5xl animate-bounce">👑</div>}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0 ${idx === 0 ? 'bg-amber-500 shadow-lg shadow-amber-500/50' : idx === 1 ? 'bg-slate-500' : 'bg-orange-700'}`}>#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-2xl truncate mb-1">{item.name}</div>
                  <div className="text-base text-slate-400 truncate">{item.giftName}</div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-rose-500">{item.totalScore}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Points</div>
                </div>
              </div>
            ))}

            {isHost && (
              <div className="mt-12 text-center">
                <Button variant="danger" size="lg" onClick={() => nextPhase('punishment-reveal')} className="w-full max-w-md mx-auto text-2xl py-6 shadow-2xl animate-bounce">
                  ☠️ 進入懲罰環節 ☠️
                </Button>
              </div>
            )}
          </div>
        )}

        {/* --- 階段 7: 懲罰揭曉 (Slot Machine Style) --- */}
        {roomData.phase === 'punishment-reveal' && (
          <div className="animate-fade-in flex flex-col h-[calc(100vh-20px)] w-full max-w-md mx-auto relative overflow-hidden">

            {/* 1. 雷王資訊 (Fixed Top) */}
            {(() => {
              const loser = (roomData.finalResults || []).sort((a, b) => b.totalScore - a.totalScore)[0];
              if (!loser) return null;

              return (
                <div className="shrink-0 text-center py-4 bg-slate-900/50 border-b border-white/10 relative z-20 mt-12">
                  <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-1">The Loser is</p>
                  <div className="flex flex-col items-center gap-1">
                    <h2 className="text-4xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(225,29,72,0.6)] leading-none">{loser.name}</h2>
                    <span className="text-sm font-bold text-white bg-rose-600 px-3 py-0.5 rounded-full shadow-lg">{loser.totalScore} 分</span>
                  </div>
                </div>
              );
            })()}

            {/* 2. 數位抽獎看板 (Flexible Center) */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
              <PunishmentSlotMachine
                text={roomData.isSpinning || !roomData.finalPunishment ? randomText : roomData.finalPunishment}
                isSpinning={roomData.isSpinning}
                hasResult={!!roomData.finalPunishment && !roomData.isSpinning}
              />
            </div>

            {/* 3. 按鈕區 (Fixed Bottom) */}
            <div className="shrink-0 p-6 w-full relative z-30 pb-safe bg-slate-900/50 backdrop-blur-sm">
              <div className="space-y-3">
                {isHost && !roomData.finalPunishment && (
                  <Button variant="neutral" size="lg" onClick={spinPunishment} className="w-full text-xl py-4 shadow-lg shadow-blue-900/20" disabled={roomData.isSpinning}>
                    {roomData.isSpinning ? "🎲 抽選中..." : "🎲 抽出懲罰"}
                  </Button>
                )}

                {!isHost && !roomData.finalPunishment && (
                  <div className="text-center text-slate-500 py-2 text-sm animate-pulse">等待主持人抽出懲罰...</div>
                )}

                {/* 結果出來後顯示 */}
                {roomData.finalPunishment && !roomData.isSpinning && (
                  <Button variant="secondary" onClick={leaveRoom} className="w-full bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white py-4 animate-fade-in">
                    <LogOut size={20} /> 結束遊戲並清除房間
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 動畫樣式 */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-20px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
        @keyframes scan { 0% { left: -100%; } 100% { left: 100%; } }
        .animate-scan { animation: scan 1.5s linear infinite; }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; } 
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default App;