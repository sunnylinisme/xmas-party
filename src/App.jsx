import React, { useState, useEffect, useRef, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { Gift, Users, ArrowRight, Zap, Skull, Play, Edit3, AlertTriangle, LogIn, Share2, Link as LinkIcon } from 'lucide-react';

// ==========================================
// ⚠️ 請在此處填入你的 Firebase 設定
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
    const snowflakes = Array.from({ length: 30 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 1 + 0.5
    }));
    let animationFrameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
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
  <div className={`bg-white/95 backdrop-blur-md rounded-xl shadow-xl p-4 md:p-6 border-2 border-red-100 ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', className = "", disabled = false, size = 'md' }) => {
  const baseStyle = "rounded-full font-bold transition-all transform active:scale-95 shadow-md flex items-center justify-center gap-2";
  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-xl"
  };
  const variants = {
    primary: "bg-red-600 text-white hover:bg-red-700 border-b-4 border-red-800",
    secondary: "bg-green-600 text-white hover:bg-green-700 border-b-4 border-green-800",
    neutral: "bg-gray-200 text-gray-800 hover:bg-gray-300 border-b-4 border-gray-400",
    danger: "bg-gray-800 text-white hover:bg-black border-b-4 border-gray-900",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
      {children}
    </button>
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

  // 本地輸入狀態
  const [myRuleInput, setMyRuleInput] = useState('');
  const [myGiftGiver, setMyGiftGiver] = useState('');

  // 檢查 Config
  if (!isConfigured) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white p-10 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-red-500">尚未設定 Firebase</h1>
          <p>請打開程式碼 (App.jsx)，將你的 Firebase Config 填入 firebaseConfig 物件中。</p>
        </div>
      </div>
    );
  }

  // Auth 初始化
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("登入失敗:", error);
        alert("登入失敗，請確認 Firebase Auth 是否已開啟「匿名登入」");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 監聽房間數據
  useEffect(() => {
    if (!user || !roomId || !isInRoom) return;

    // 💡 修正重點：使用簡單的頂層集合 "xmas_rooms"
    // 這樣可以避免路徑過深導致的權限或索引問題
    const roomRef = doc(db, 'xmas_rooms', `room_${roomId}`);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
      } else {
        // 如果監聽不到，可能代表房間剛被建立但還沒同步，或是真的不存在
        // 但因為我們在 joinRoom 有先 setDoc，所以通常不會進來這裡
        setRoomData(null);
      }
    }, (error) => {
      console.error("Error listening to room:", error);
      alert(`連線錯誤：${error.message}\n請確認 Firestore 規則是否為公開 (Test Mode)`);
    });

    return () => unsubscribe();
  }, [user, roomId, isInRoom]);

  // --- 動作函式 ---

  const joinRoom = async () => {
    const safeRoomId = roomId.toString().trim(); // 強制轉字串
    const safeUserName = userName.trim();

    if (!safeRoomId || !safeUserName) return alert("請輸入房間代碼和你的名字");

    setRoomId(safeRoomId);
    setUserName(safeUserName);

    // 💡 修正重點：對應上方的簡單路徑
    const roomRef = doc(db, 'xmas_rooms', `room_${safeRoomId}`);

    try {
      const docSnap = await getDoc(roomRef);

      if (!docSnap.exists()) {
        // 創建新房間
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
        // 加入現有房間
        const currentData = docSnap.data();
        if (currentData.phase !== 'entry' && !currentData.participants[user.uid]) {
          return alert("遊戲已經開始，無法中途加入！");
        }
        await updateDoc(roomRef, {
          [`participants.${user.uid}`]: safeUserName
        });
      }
      setIsInRoom(true);
    } catch (e) {
      console.error(e);
      alert("加入失敗！請確認 Firebase Firestore 的規則 (Rules) 已經設為 true (公開)");
    }
  };

  const copyInvite = () => {
    const currentUrl = window.location.href;
    const inviteText = `🎄 2025 交換禮物派對邀請！\n\n1. 點擊連結：${currentUrl}\n2. 輸入代碼：${roomId}\n\n快來加入！`;

    // 萬用複製法
    const textArea = document.createElement("textarea");
    textArea.value = inviteText;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert("✅ 邀請已複製！趕快貼給朋友！");
    } catch (err) {
      alert(`請手動複製：\n\n${inviteText}`);
    }
    document.body.removeChild(textArea);
  };

  // 通用更新函式 (簡化路徑引用)
  const updateRoom = async (updates) => {
    if (!roomId) return;
    const roomRef = doc(db, 'xmas_rooms', `room_${roomId}`);
    await updateDoc(roomRef, updates);
  };

  const nextPhase = async (nextPhaseName) => {
    if (!roomData) return;

    let updates = { phase: nextPhaseName };

    if (nextPhaseName === 'rule-entry' && roomData.phase === 'entry') {
      const pIds = Object.keys(roomData.participants);
      const initialRules = pIds.map(uid => ({
        uid,
        authorName: roomData.participants[uid],
        text: ""
      }));
      updates.rules = initialRules;
    }

    if (nextPhaseName === 'game-playing' && roomData.phase === 'rule-entry') {
      const shuffled = [...roomData.rules];
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
      Object.keys(roomData.participants).forEach(uid => {
        details[uid] = { giftName: '', votes: 1 };
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
    alert("規則已送出！");
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
    alert("已回報！");
  };

  const submitGiftDescription = async (targetUid, text) => {
    await updateRoom({ [`matchDetails.${targetUid}.giftName`]: text });
  };

  const vote = async (targetUid, delta) => {
    const currentVotes = roomData.matchDetails[targetUid]?.votes || 1;
    let newVotes = Math.max(1, Math.min(10, currentVotes + delta));
    await updateRoom({ [`matchDetails.${targetUid}.votes`]: newVotes });
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


  // --- 畫面渲染 ---

  if (loading) return <div className="h-screen flex items-center justify-center text-white bg-red-800">載入中...</div>;

  // 1. 登入/大廳頁面
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-800 to-green-900 p-4 flex items-center justify-center relative overflow-hidden">
        <SnowBackground />
        <Card className="w-full max-w-md z-10 text-center">
          <Gift size={60} className="mx-auto text-red-600 mb-4" />
          <h1 className="text-3xl font-black text-gray-800 mb-2">2025 交換禮物 Online</h1>
          <p className="text-gray-500 mb-6">拿出手機，一起連線開戰！</p>

          <div className="space-y-4">
            <div className="text-left">
              <label className="text-sm font-bold text-gray-600 ml-1">你的名字</label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 outline-none text-lg"
                placeholder="例：小明"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
            </div>
            <div className="text-left">
              <label className="text-sm font-bold text-gray-600 ml-1">房間代碼 (數字)</label>
              <input
                type="number"
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none text-lg"
                placeholder="例：1234"
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
              />
            </div>
            <Button onClick={joinRoom} size="lg" className="w-full mt-4">
              <LogIn size={20} /> 進入房間
            </Button>
            <div className="text-xs text-gray-400 mt-4 bg-black/20 p-2 rounded">
              <p>💡 提醒：所有人必須在<b>同一個網址</b>輸入<b>同一個號碼</b>才能連線喔！</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. 遊戲房間內
  if (!roomData) return <div className="h-screen flex items-center justify-center text-white">讀取房間資料中...</div>;

  const isHost = user.uid === roomData.hostId;
  const participantList = Object.entries(roomData.participants);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 via-red-600 to-green-800 font-sans text-gray-800 relative pb-20">
      <SnowBackground />

      {/* 頂部資訊列 */}
      <div className="bg-black/30 text-white p-3 backdrop-blur-sm sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 px-2 py-1 rounded text-xs font-bold">Room: {roomId}</div>
          <span className="font-bold">{userName}</span>
        </div>
        <div className="text-xs opacity-75 flex items-center gap-1">
          <Users size={14} /> {participantList.length} 人在線
        </div>
      </div>

      <main className="relative z-10 max-w-3xl mx-auto p-4 flex flex-col gap-6">

        {/* --- 階段 1: 等待大廳 (Entry) --- */}
        {roomData.phase === 'entry' && (
          <div className="animate-fade-in space-y-6">
            <Card className="text-center py-10">
              <h2 className="text-2xl font-bold mb-4">等待玩家加入...</h2>
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {participantList.map(([uid, name]) => (
                  <span key={uid} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    {uid === roomData.hostId && "👑"} {name}
                  </span>
                ))}
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg text-left text-sm text-gray-600 max-w-sm mx-auto mb-6">
                <p>1. 請確認所有人都已顯示在上方。</p>
                <p>2. 只有房主可以按開始。</p>
                <p>3. 請務必確認大家都在同一間房！</p>
              </div>

              <div className="mb-4">
                <Button onClick={copyInvite} variant="secondary" className="w-full">
                  <Share2 size={20} /> 複製邀請 (含連結)
                </Button>
              </div>

              {isHost ? (
                <Button onClick={() => nextPhase('rule-entry')} size="lg" disabled={participantList.length < 2}>
                  下一步：撰寫規則 <ArrowRight />
                </Button>
              ) : (
                <p className="text-gray-500 animate-pulse">等待房主開始遊戲...</p>
              )}
            </Card>
          </div>
        )}

        {roomData.phase === 'rule-entry' && (
          <div className="animate-fade-in space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2">
                <Edit3 className="text-red-600" /> 請出一道「交換指令」
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">例如：跟戴眼鏡的人換、往右傳兩格...</p>

              <div className="mb-6">
                <textarea
                  className="w-full p-4 border-2 border-red-200 rounded-xl focus:border-red-500 outline-none resize-none text-lg"
                  rows={3}
                  placeholder="輸入你的邪惡指令..."
                  value={myRuleInput}
                  onChange={e => setMyRuleInput(e.target.value)}
                  disabled={roomData.rules.find(r => r.uid === user.uid)?.text !== ""}
                />
              </div>
              <Button onClick={submitRule} className="w-full" disabled={!myRuleInput}>送出指令</Button>
            </Card>
            <div className="text-center text-white/80 text-sm">
              <p>目前完成進度： {roomData.rules.filter(r => r.text).length} / {participantList.length}</p>
            </div>
            {isHost && (
              <div className="flex justify-center mt-4">
                <Button variant="danger" onClick={() => nextPhase('game-playing')}>不管了，直接開始遊戲 <Play size={16} /></Button>
              </div>
            )}
          </div>
        )}

        {roomData.phase === 'game-playing' && (
          <div className="animate-fade-in py-10 flex flex-col items-center">
            <div className="text-white mb-4 text-center">
              <span className="block opacity-80 text-sm">Round {roomData.currentRuleIndex + 1} / {roomData.rules.length}</span>
              <div className="w-32 h-1 bg-white/30 rounded mx-auto mt-2 overflow-hidden">
                <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${((roomData.currentRuleIndex + 1) / roomData.rules.length) * 100}%` }}></div>
              </div>
            </div>
            <Card className="w-full text-center py-12 transform transition-all duration-500 hover:scale-105">
              <div className="mb-4">
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold">
                  {roomData.rules[roomData.currentRuleIndex].authorName} 的指令
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-gray-800 leading-tight">
                {roomData.rules[roomData.currentRuleIndex].text || "（這人太懶，沒寫規則，這回合休息）"}
              </h2>
            </Card>
            {isHost && (
              <div className="mt-8">
                <Button onClick={nextRule} size="lg">
                  {roomData.currentRuleIndex < roomData.rules.length - 1 ? "下一條指令 ➔" : "遊戲結束，進入結算 🏁"}
                </Button>
              </div>
            )}
          </div>
        )}

        {roomData.phase === 'result-entry' && (
          <div className="animate-fade-in space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-center mb-6">🎁 你最後拿到了誰的禮物？</h2>
              <div className="space-y-4">
                <select
                  className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg bg-white"
                  value={myGiftGiver}
                  onChange={e => setMyGiftGiver(e.target.value)}
                >
                  <option value="">請選擇...</option>
                  {participantList.map(([uid, name]) => (
                    <option key={uid} value={uid}>{name} 的禮物</option>
                  ))}
                </select>
                <Button onClick={submitResult} className="w-full">確認送出</Button>
              </div>
            </Card>
            <div className="bg-black/20 p-4 rounded-xl text-white text-center">
              <h3 className="font-bold mb-2">已回報玩家</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.keys(roomData.resultMapping).map(uid => (
                  <span key={uid} className="bg-green-500 text-xs px-2 py-1 rounded">
                    {roomData.participants[uid]}
                  </span>
                ))}
              </div>
            </div>
            {isHost && (
              <div className="flex justify-center">
                <Button variant="danger" onClick={() => nextPhase('voting')}>全員回報完畢，開始投票 <ArrowRight /></Button>
              </div>
            )}
          </div>
        )}

        {roomData.phase === 'voting' && (
          <div className="animate-fade-in space-y-4 pb-20">
            <Card className="mb-4 bg-yellow-50 border-yellow-200">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={20} /> 審判時刻</h2>
              <p className="text-sm text-gray-600">1. 幫大家輸入禮物內容<br />2. 用力按下 + 按鈕投票</p>
            </Card>
            {participantList.map(([receiverUid, receiverName]) => {
              const giverUid = roomData.resultMapping[receiverUid];
              const giverName = roomData.participants[giverUid] || "未知";
              const details = roomData.matchDetails[receiverUid] || { giftName: '', votes: 1 };
              const score = details.votes;
              const scoreColor = score >= 8 ? "text-red-600" : score >= 4 ? "text-yellow-600" : "text-green-600";
              return (
                <Card key={receiverUid} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500">🎁 <span className="font-bold text-gray-800 text-base">{giverName}</span> 送給 {receiverName}</div>
                    <div className="font-black text-2xl flex flex-col items-center leading-none"><span className={scoreColor}>{score}</span><span className="text-[10px] text-gray-400">雷指數</span></div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input type="text" className="flex-1 border-b border-gray-300 p-1 text-sm outline-none focus:border-red-500 bg-transparent" placeholder="輸入禮物內容..." defaultValue={details.giftName} onBlur={(e) => submitGiftDescription(receiverUid, e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => vote(receiverUid, -1)} className="w-8 h-8 rounded-full bg-gray-100 font-bold text-gray-600">-</button>
                    <button onClick={() => vote(receiverUid, 1)} className="w-8 h-8 rounded-full bg-red-100 font-bold text-red-600 border border-red-200 shadow-sm active:scale-90 transition-transform">+</button>
                  </div>
                </Card>
              );
            })}
            {isHost && (
              <div className="fixed bottom-4 left-0 w-full px-4 z-50">
                <Button variant="danger" className="w-full shadow-2xl" onClick={() => nextPhase('result')}>☠️ 結算懲罰 ☠️</Button>
              </div>
            )}
          </div>
        )}

        {roomData.phase === 'result' && (
          <div className="animate-fade-in space-y-6 pb-20">
            <div className="text-center text-white mb-8">
              <h2 className="text-4xl font-black text-yellow-300 drop-shadow-md mb-2">🏆 雷王誕生 🏆</h2>
              <p className="opacity-80">快看看是誰要接受懲罰！</p>
            </div>
            {participantList.map(([uid]) => ({ uid, ...roomData.matchDetails[uid], giverName: roomData.participants[roomData.resultMapping[uid]] })).sort((a, b) => b.votes - a.votes).slice(0, 3).map((item, idx) => (
              <div key={item.uid} className={`bg-white rounded-xl p-4 shadow-lg flex items-center gap-4 ${idx === 0 ? 'border-4 border-yellow-400 transform scale-105' : 'opacity-90'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${idx === 0 ? 'bg-red-600' : idx === 1 ? 'bg-orange-500' : 'bg-yellow-500'}`}>#{idx + 1}</div>
                <div className="flex-1"><div className="font-bold text-gray-800 text-lg">{item.giverName}</div><div className="text-sm text-gray-500">{item.giftName || "神秘禮物"}</div></div>
                <div className="text-3xl font-black text-red-600">{item.votes} <span className="text-xs text-gray-400 font-normal">分</span></div>
              </div>
            ))}
            <Card className="bg-gray-900 border-gray-800 text-white mt-8 text-center">
              <h3 className="text-xl font-bold text-red-500 mb-2 flex justify-center items-center gap-2"><Skull /> 懲罰內容</h3>
              <div className="text-3xl font-black text-yellow-400 mb-4 px-4 leading-tight">{roomData.punishment}</div>
              {isHost && (<Button variant="neutral" size="sm" onClick={drawPunishment}><Zap size={14} /> 換一個懲罰</Button>)}
            </Card>
            <div className="text-center mt-8"><Button variant="secondary" onClick={() => window.location.reload()}>離開房間</Button></div>
          </div>
        )}

      </main>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }`}</style>
    </div>
  );
};

export default App;