// ── firebase.js ── Конфигурација на Firebase ───────────────────────

// Податоци за поврзување со проектот на Firebase
const firebaseConfig = {
  apiKey:            "AIzaSyDZ27ePdZuTX3HiSssxA85kWo098KNyW6Y",
  authDomain:        "my-first-firebase-projec-dd5bb.firebaseapp.com",
  projectId:         "my-first-firebase-projec-dd5bb",
  storageBucket:     "my-first-firebase-projec-dd5bb.firebasestorage.app",
  messagingSenderId: "624975845324",
  appId:             "1:624975845324:web:bdb10971e70df40a7b6f69"
};

// Иницијализација на Firebase апликацијата
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Вклучување на офлајн работа за да не се изгубат поени
// при краток прекин на интернетот — зачувува локално и синхронизира подоцна
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  // failed-precondition = отворени се повеќе табови (само еден може да чува офлајн податоци)
  // unimplemented       = прелистувачот не поддржува (на пр. инкогнито режим)
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('[Firestore] Грешка со офлајн зачувување:', err.code);
  }
});
