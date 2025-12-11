🎄 聖誕交換禮物派對 (Xmas Gift Exchange Party)

這是一個專為線下聚會設計的 即時互動網頁應用程式 (Web App)。
結合了 指令卡牌、即時投票 與 懲罰輪盤，解決傳統抽籤的無聊，讓交換禮物過程變得刺激又混亂！

✨ 功能特色 (Features)

⚡️ 即時同步 (Real-time)：基於 Firebase Firestore，所有參與者的畫面秒級同步。

🔗 智慧邀請 (Smart Invite)：複製連結即可自動帶入房間參數 (?room=xxxx)，親友免輸入代碼。

🎁 盲盒機制：禮物內容直到評分階段才會揭曉。

🗳️ 匿名評分：遊戲結束後對禮物進行「雷度」投票，即時計算排行榜。

☠️ 懲罰系統：內建數位老虎機 (Slot Machine)，由雷王抽取大家集思廣益的懲罰。

🛠️ 安裝與執行 (Installation)

如果你想在本地端執行或自行部署此專案，請參考以下步驟：

1. 下載專案

git clone [https://github.com/your-username/xmas-party.git](https://github.com/your-username/xmas-party.git)
cd xmas-party


2. 安裝依賴

npm install
# 或
yarn install


3. Firebase 設定 (重要！)

本專案需要 Firebase 支援。請前往 Firebase Console 建立專案並開啟以下功能：

Authentication: 啟用「匿名登入 (Anonymous)」。

Firestore Database: 建立資料庫並設定適當的讀寫規則。

接著，打開 src/App.jsx，將 firebaseConfig 物件替換為你的設定：

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};


4. 啟動開發伺服器

npm run dev


打開瀏覽器前往 http://localhost:5173 即可開始使用。

📱 遊戲流程 (Game Flow)

1️⃣ 進入大廳 (Lobby)

主持人建立房間，分享連結。

參與者點擊連結自動加入。

2️⃣ 登錄禮物 (Gift Entry)

系統分配每人一個隨機代號。

參與者輸入禮物內容物（需寫清楚，例如：星巴克馬克杯），作為後續評分依據。

3️⃣ 制定規則 & 懲罰 (Rules & Punishments)

每人出一張「交換指令牌」（如：所有人往右傳）。

每人出一個「懲罰點子」（如：屁股寫字）。

4️⃣ 遊戲進行 (Gameplay)

系統將指令牌洗牌後依序顯示。

所有人依照畫面指令動作。

5️⃣ 評分與結算 (Voting & Result)

交換結束，拆禮物。

針對「送禮者」進行雷度評分 (1-10分)。

系統結算總分，分數最高者為「雷王」，需接受懲罰輪盤審判。

🤝 貢獻 (Contributing)

歡迎提交 PR 來新增更多有趣的 隨機規則庫 或 懲罰庫！

📄 授權 (License)

MIT License