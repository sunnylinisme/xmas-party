import React, { useState, useEffect, useRef, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc, deleteDoc, deleteField, increment } from 'firebase/firestore';
import { Gift, Users, ArrowRight, Zap, Skull, Play, Edit3, AlertTriangle, LogIn, Share2, Link as LinkIcon, RotateCcw, Shuffle, Star, Save, X, LogOut, Info, CheckCircle, Clock, Bomb, ChevronDown, Hash, Lightbulb } from 'lucide-react';

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

// --- 隨機規則庫 (邏輯型) ---
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
  if (score <= 10) return { text: "😇 天使好禮", color: "text-green-400" };
  if (score <= 20) return { text: "🙂 還算實用", color: "text-blue-400" };
  if (score <= 30) return { text: "😐 微妙...不好說", color: "text-yellow-400" };
  if (score <= 40) return { text: "🤔 有點雷喔", color: "text-orange-400" };
  return { text: "☠️ 恭喜! 超~級~雷~", color: "text-red-500 font-black animate-pulse" };
};

// --- 解析規則並產生提示的 Helper ---
const calculateHint = (ruleText, myNum, allParticipants) => {
  if (!ruleText || !myNum || !allParticipants) return null;

  // 取得所有存在的號碼並排序 (1, 2, 3...)
  const numbers = Object.values(allParticipants).sort((a, b) => a - b);
  const myIndex = numbers.indexOf(myNum);
  const count = numbers.length;
  if (myIndex === -1) return null;

  let targetNum = null;

  // 解析 +N 邏輯
  const plusMatch = ruleText.match(/號碼\s*\+(\d+)/);
  if (plusMatch) {
    const offset = parseInt(plusMatch[1]);
    const targetIndex = (myIndex + offset) % count;
    targetNum = numbers[targetIndex];
  }

  // 解析 -N 邏輯
  const minusMatch = ruleText.match(/號碼\s*\-(\d+)/);
  if (minusMatch) {
    const offset = parseInt(minusMatch[1]);
    const targetIndex = (myIndex - offset + count * 10) % count; // 加多一點 count 避免負數
    targetNum = numbers[targetIndex];
  }

  if (targetNum !== null) {
    const targetEntry = Object.entries(allParticipants).find(([uid, num]) => num === targetNum);
    if (targetEntry) {
      return { num: targetNum, uid: targetEntry[0] };
    }
  }

  return null;
};

// --- Toast 通知元件 ---
const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in-down w-max max-w-[90%] pointer-events-none">
      <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-600 flex items-center gap-2">
        <Info size={18} className="text-blue-400 shrink-0" />
        <span className="font-bold text-sm md:text-base">{message}</span>
      </div>
    </div>
  );
};

// --- 輪盤元件 (Roulette) ---
const RouletteWheel = ({ items, targetItem, isSpinning, className }) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isSpinning && targetItem && items.length > 0) {
      const targetIndex = items.indexOf(targetItem);
      if (targetIndex === -1) return;

      const segmentAngle = 360 / items.length;
      const centerAngle = (targetIndex * segmentAngle) + (segmentAngle / 2);
      const baseRotation = 3600 + (360 - centerAngle);
      const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8);

      setRotation(baseRotation + randomOffset);
    }
  }, [isSpinning, targetItem, items]);

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#6366f1'];

  return (
    <div className={`relative w-64 h-64 md:w-80 md:h-80 mx-auto ${className}`}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-20 filter drop-shadow-lg">
        <ChevronDown size={40} className="text-white fill-white stroke-[3px] stroke-slate-900" />
      </div>

      <div
        className="w-full h-full rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden transition-transform duration-[5000ms] cubic-bezier(0.15, 0.85, 0.15, 1)"
        style={{
          transform: `rotate(${rotation}deg)`,
          background: `conic-gradient(${items.map((_, i) => `${colors[i % colors.length]} ${i * (100 / items.length)}% ${(i + 1) * (100 / items.length)}%`).join(', ')
            })`
        }}
      >
        {items.map((item, i) => {
          const angle = (360 / items.length) * i + (360 / items.length) / 2;
          return (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-1/2 h-1 origin-left flex items-center"
              style={{ transform: `rotate(${angle - 90}deg)` }}
            >
              <div className="pl-8 text-white font-bold text-xs md:text-sm truncate w-24 md:w-32 text-shadow" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                {item}
              </div>
            </div>
          )
        })}
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center shadow-xl z-10">
        <Skull className="text-slate-400" size={20} />
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
        <div className="text-yellow-400 text-4xl mb-4 font-bold">即將揭曉</div>
        <div className="text-[15rem] font-black text-white leading-none">{count}</div>
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

  // 抽獎狀態
  const [punishmentPool, setPunishmentPool] = useState([]);

  // 我的號碼
  const myNumber = roomData?.participantNumbers?.[user?.uid];

  // 自動提示
  const [currentHint, setCurrentHint] = useState(null);

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

          // 還原輸入狀態
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

        // 計算提示 (遊戲階段)
        if (data.phase === 'game-playing' && data.participantNumbers && data.participantNumbers[user.uid]) {
          const rule = data.rules[data.currentRuleIndex];
          if (rule && rule.text) {
            const hint = calculateHint(rule.text, data.participantNumbers[user.uid], data.participantNumbers);
            if (hint) {
              const targetName = data.participants[hint.uid];
              setCurrentHint(`你的目標是：${hint.num} 號 (${targetName})`);
            } else {
              setCurrentHint(null);
            }
          }
        } else {
          setCurrentHint(null);
        }

        // 初始化懲罰池
        if (data.phase === 'punishment-reveal' && (!punishmentPool || punishmentPool.length === 0)) {
          let pool = Object.values(data.punishments || {});
          if (pool.length === 0) pool = RANDOM_PUNISHMENTS;
          setPunishmentPool(pool);
        }

        // --- 自動流程 (由主持人觸發) ---
        if (data.hostId === user.uid) {
          const participantCount = Object.keys(data.participants).length;

          // 1. 禮物登錄完 -> 寫規則 (順便分發隨機號碼)
          if (data.phase === 'gift-entry' && participantCount > 1) {
            const finishedGifts = Object.keys(data.gifts || {}).length;
            if (finishedGifts === participantCount) {
              nextPhase('rule-entry', data);
            }
          }

          // 2. 寫完規則 -> 寫懲罰
          if (data.phase === 'rule-entry' && participantCount > 1) {
            const finishedRules = data.rules.filter(r => r.text && r.text.trim() !== "").length;
            if (finishedRules === participantCount) {
              nextPhase('punishment-entry', data);
            }
          }

          // 3. 寫完懲罰 -> 遊戲開始
          if (data.phase === 'punishment-entry' && participantCount > 1) {
            const finishedPunishments = Object.keys(data.punishments || {}).length;
            if (finishedPunishments === participantCount) {
              nextPhase('game-playing', data);
            }
          }

          // 4. 投票完 -> 倒數
          if (data.phase === 'voting' && participantCount > 1) {
            const votedCount = Object.keys(data.votingStatus || {}).length;
            if (votedCount === participantCount) {
              nextPhase('countdown', data);
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

    // --- 關鍵修正：在進入 'rule-entry' (也就是遊戲正式開始前) 分配隨機號碼 ---
    if (nextPhaseName === 'rule-entry' && currentData.phase === 'gift-entry') {
      const pIds = Object.keys(currentData.participants);
      const count = pIds.length;

      // 1. 產生 1~N 的數列
      const numbers = Array.from({ length: count }, (_, i) => i + 1);

      // 2. Fisher-Yates 洗牌
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }

      // 3. 分配給每個 UID
      const assignedNumbers = {};
      pIds.forEach((uid, index) => {
        assignedNumbers[uid] = numbers[index];
      });
      updates.participantNumbers = assignedNumbers;

      // 初始化規則陣列
      const initialRules = pIds.map(uid => ({
        uid,
        authorName: currentData.participants[uid],
        text: ""
      }));
      updates.rules = initialRules;
    }

    // 進入遊戲階段初始化 (洗牌規則)
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

    // 進入結果畫面時，建立成績快照 (Snapshot)
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
      // 遊戲結束，直接進入投票
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
    const participantCount = Object.keys(roomData.participants).length;
    if (Object.keys(myVotes).length < participantCount - 1) {
      showToast("請對所有人的禮物進行評分！");
      return;
    }
    const updates = { [`votingStatus.${user.uid}`]: true };
    Object.entries(myVotes).forEach(([targetUid, score]) => {
      updates[`ratings.${targetUid}.${user.uid}`] = score;
    });
    await updateRoom(updates);
    showToast("評分已送出！等待開票...");
  };

  // 抽獎邏輯 (主持人執行)
  const spinPunishment = async () => {
    // 1. 決定結果
    let pool = Object.values(roomData.punishments || {});
    if (pool.length === 0) pool = RANDOM_PUNISHMENTS;
    const final = pool[Math.floor(Math.random() * pool.length)];

    // 2. 寫入 DB，觸發所有人的動畫
    await updateRoom({
      finalPunishment: final,
      isSpinning: true // 告訴前端開始轉
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">載入中...</div>;

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

  if (!roomData) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">讀取房間資料中...</div>;

  const isHost = user.uid === roomData.hostId;
  const participantList = Object.entries(roomData.participants).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 font-sans text-white relative pb-20 overflow-hidden">
      <SnowBackground />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* 10秒倒數遮罩 */}
      {roomData.phase === 'countdown' && (
        <CountdownDisplay onFinish={() => isHost && nextPhase('result')} />
      )}

      {/* 頂部資訊列 (現在全頁面顯示) */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 shadow-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-purple-500/30">Room {roomId}</div>
            <div className="flex flex-col">
              <span className="font-bold truncate max-w-[140px] text-slate-200 text-lg leading-none mb-0.5">{userName}</span>
              {/* 顯示我的號碼 */}
              {myNumber && <span className="text-xs text-yellow-400 font-bold flex items-center gap-0.5"><Hash size={10} /> 你是 {myNumber} 號</span>}
            </div>
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

      <main className={`relative z-10 max-w-3xl mx-auto p-4 flex flex-col gap-8 ${roomData.phase === 'punishment-reveal' ? 'h-screen p-0 m-0 max-w-none' : 'mt-4'}`}>

        {/* --- 階段 1: 等待大廳 (Entry) --- */}
        {roomData.phase === 'entry' && (
          <div className="animate-fade-in space-y-8">
            <Card className="text-center py-16 border-t-4 border-t-emerald-500">
              <h2 className="text-3xl font-bold mb-3">準備開始</h2>
              <p className="text-slate-400 text-lg mb-10">等待其他玩家加入...</p>

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
                <Button onClick={() => nextPhase('gift-entry')} size="lg" className="w-full shadow-emerald-900/50 text-2xl py-6" disabled={participantList.length < 2}>
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
              <div className="bg-yellow-500/20 border border-yellow-500/50 p-6 rounded-2xl text-center shadow-lg animate-fade-in-up">
                <p className="text-yellow-200 text-sm mb-1 uppercase tracking-widest">Your Number</p>
                <div className="text-5xl font-black text-yellow-400 flex items-center justify-center gap-2">
                  <Hash size={40} /> {myNumber}
                </div>
                <p className="text-xs text-yellow-200/70 mt-2">請記住你的代號，等一下交換會用到！</p>
              </div>
            )}

            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Gift className="text-pink-400" size={28} /> 你的禮物是？
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">請簡單描述你帶來的禮物（其他人暫時看不到）</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-pink-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[120px]"
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
                <Edit3 className="text-purple-400" size={28} /> 你的交換指令
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">發揮創意，讓場面混亂起來！</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-purple-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[160px]"
                  placeholder="例：所有人往右傳給 +1 號..."
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

        {/* --- 階段 2.5: 撰寫懲罰 (Punishment Entry) --- */}
        {roomData.phase === 'punishment-entry' && (
          <div className="animate-fade-in space-y-8">
            <Card>
              <h2 className="text-2xl font-bold text-center mb-2 flex items-center justify-center gap-2">
                <Bomb className="text-red-500" size={28} /> 你的懲罰點子
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8">請提供一個「懲罰」，最後大家一起抽！</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-5 bg-slate-800/50 border border-slate-600 rounded-2xl focus:border-red-500 outline-none resize-none text-xl text-white placeholder-slate-600 min-h-[160px]"
                  placeholder="例：用屁股寫字..."
                  value={myPunishmentInput}
                  onChange={e => setMyPunishmentInput(e.target.value)}
                  disabled={roomData.punishments && roomData.punishments[user.uid]}
                />
              </div>

              <div className="flex justify-end mb-8">
                <button onClick={pickRandomPunishmentInput} disabled={roomData.punishments && roomData.punishments[user.uid]} className="text-sm text-red-300 flex items-center gap-2 hover:text-white transition-colors bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                  <Shuffle size={16} /> 隨機懲罰靈感
                </button>
              </div>

              <Button onClick={submitPunishmentInput} className="w-full text-xl py-5 bg-red-600 hover:bg-red-500 shadow-red-900/50 border-none" disabled={!myPunishmentInput}>
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
            <div className="text-slate-400 mb-8 text-center w-full">
              <div className="flex justify-between text-sm mb-3 px-3">
                <span>Round {roomData.currentRuleIndex + 1}</span>
                <span>Total {roomData.rules.length}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${((roomData.currentRuleIndex + 1) / roomData.rules.length) * 100}%` }}></div>
              </div>
            </div>

            {/* 自動提示 (Smart Hint) */}
            {currentHint && (
              <div className="mb-6 animate-fade-in-up w-full">
                <div className="bg-blue-500/20 border border-blue-500/50 text-blue-200 px-6 py-4 rounded-xl text-center shadow-lg backdrop-blur-sm flex items-center justify-center gap-2">
                  <Lightbulb className="text-yellow-400 shrink-0 animate-pulse" size={24} />
                  <span className="font-bold text-lg">{currentHint}</span>
                </div>
              </div>
            )}

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
              <Card className="text-center py-12 border-t-4 border-t-green-500">
                <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">評分已送出</h2>
                <p className="text-slate-400">等待其他人完成...</p>
                <div className="mt-6 text-sm text-slate-500">
                  進度：{Object.keys(roomData.votingStatus || {}).length} / {participantList.length}
                </div>
              </Card>
            ) : (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-2xl flex gap-4 items-start mb-6">
                  <AlertTriangle className="text-yellow-500 shrink-0 mt-1" size={24} />
                  <div>
                    <h2 className="text-lg font-bold text-yellow-500">審判時刻</h2>
                    <p className="text-sm text-yellow-200/70 mt-1">請依序對大家的禮物評分！<br />分數越高 = 越雷 (10分=爛透了)</p>
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
                        <div className="text-4xl font-black text-yellow-400">{myScore}</div>
                      </div>

                      <input
                        type="range"
                        min="1" max="10"
                        value={myScore}
                        onChange={(e) => handleVoteChange(targetUid, parseInt(e.target.value))}
                        className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
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
            <div className="bg-yellow-500/20 text-yellow-300 py-2 text-center text-sm font-bold border-y border-yellow-500/30 animate-pulse">
              ⚠️ 下一階段：命運大輪盤！準備抽出懲罰...
            </div>

            <div className="text-center mb-10">
              <h2 className="text-5xl font-black text-yellow-400 drop-shadow-xl mb-3 flex items-center justify-center gap-3">
                <Star fill="currentColor" size={40} /> 本日最雷王誕生 <Star fill="currentColor" size={40} />
              </h2>
              <p className="text-slate-400 text-lg">恭喜以下得主獲得大家的怨念</p>
            </div>

            {/* 使用 Snapshot 資料 (finalResults) 渲染 */}
            {(roomData.finalResults || []).sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map((item, idx) => (
              <div key={item.uid} className={`relative rounded-3xl p-6 shadow-xl flex items-center gap-5 border ${idx === 0 ? 'bg-gradient-to-r from-yellow-900/80 to-slate-900 border-yellow-500 transform scale-105 z-10' : 'bg-slate-800/80 border-slate-700'}`}>
                {idx === 0 && <div className="absolute -top-4 -right-3 text-5xl animate-bounce">👑</div>}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0 ${idx === 0 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : idx === 1 ? 'bg-slate-500' : 'bg-amber-700'}`}>#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-2xl truncate mb-1">{item.name}</div>
                  <div className="text-base text-slate-400 truncate">{item.giftName}</div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-red-500">{item.totalScore}</div>
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

        {/* --- 階段 7: 懲罰揭曉 (Compact Layout) --- */}
        {roomData.phase === 'punishment-reveal' && (
          <div className="animate-fade-in flex flex-col h-[calc(100vh-20px)] overflow-hidden w-full max-w-md mx-auto">

            {/* 1. 雷王資訊 (Compact) */}
            {(() => {
              const loser = (roomData.finalResults || []).sort((a, b) => b.totalScore - a.totalScore)[0];
              if (!loser) return null;

              return (
                <div className="shrink-0 text-center py-4 bg-slate-900/50 border-b border-white/10 relative z-20">
                  <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-1">The Loser is</p>
                  <div className="flex flex-col items-center gap-1">
                    <h2 className="text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] leading-none">{loser.name}</h2>
                    <span className="text-sm font-bold text-white bg-red-600 px-3 py-0.5 rounded-full shadow-lg">{loser.totalScore} 分</span>
                  </div>
                </div>
              );
            })()}

            {/* 2. 輪盤 (Flexible) */}
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
              <h3 className="text-lg font-bold text-slate-300 mb-2 flex items-center gap-2 shrink-0">
                <Skull size={20} /> 命運大輪盤 <Skull size={20} />
              </h3>

              {/* 輪盤縮放容器 */}
              <div className="scale-75 md:scale-90 origin-center transition-transform">
                <RouletteWheel
                  items={punishmentPool}
                  targetItem={roomData.finalPunishment}
                  isSpinning={roomData.isSpinning}
                />
              </div>
            </div>

            {/* 3. 結果與控制 (Bottom Fixed) */}
            <div className="shrink-0 p-4 w-full bg-slate-900/80 border-t border-white/10 backdrop-blur-md relative z-30 pb-8">
              {/* 結果顯示 */}
              {roomData.finalPunishment && (
                <div className="mb-4 animate-fade-in-up">
                  <div className="text-yellow-400 font-black text-2xl md:text-3xl text-center bg-black/40 border-2 border-yellow-500/50 p-4 rounded-xl shadow-xl leading-tight">
                    {roomData.finalPunishment}
                  </div>
                </div>
              )}

              {/* 按鈕區 */}
              <div className="space-y-3">
                {isHost && !roomData.finalPunishment && (
                  <Button variant="neutral" size="lg" onClick={spinPunishment} className="w-full text-xl py-4 shadow-lg shadow-blue-900/20" disabled={roomData.isSpinning}>
                    {roomData.isSpinning ? "抽選中..." : "🎲 啟動輪盤"}
                  </Button>
                )}

                {!isHost && !roomData.finalPunishment && (
                  <div className="text-center text-slate-500 py-2 text-sm animate-pulse">等待主持人啟動輪盤...</div>
                )}

                {/* 只有結果出來後才顯示離開按鈕 */}
                {roomData.finalPunishment && (
                  <Button variant="secondary" onClick={leaveRoom} className="w-full bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white py-4 animate-fade-in">
                    <LogOut size={20} /> 結束遊戲離開房間
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
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; } 
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;