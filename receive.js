import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDRQUnCtIZSpq4Jxed_4lwy9LYup37009c",
  authDomain: "whatsapp-stuffs.firebaseapp.com",
  projectId: "whatsapp-stuffs",
  storageBucket: "whatsapp-stuffs.appspot.com",
  messagingSenderId: "777872998496",
  appId: "1:777872998496:web:ae4b7f2dc278a3c1aa0305"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const form = document.getElementById('receiveForm');
const linkElement = document.getElementById('link');
const commentElement = document.getElementById('comment');
const resultDiv = document.getElementById('result');
const statusText = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nicknameInput = document.getElementById('nickname');
  const nickname = nicknameInput.value.trim().toLowerCase();
  if (!nickname) return;

  const today = new Date().toISOString().split("T")[0];
  const localKey = `received_${nickname}_${today}`;
  const cached = localStorage.getItem(localKey);

  // Step 0: Check if nickname has ever submitted anything
  const userSubmissionsQuery = query(
    collection(db, "submissions"),
    where("nickname", "==", nickname)
  );
  const userSubmissionsSnap = await getDocs(userSubmissionsQuery);

  if (userSubmissionsSnap.empty) {
    statusText.textContent = "❌ Nickname not found or hasn't submitted anything.";
    return;
  }

  // Step 1: Use cached pair if available
  if (cached) {
    const data = JSON.parse(cached);
    showResult(data.link, data.comment);
    return;
  }

  // Step 2: Check if already reviewed today in Firestore
  const existingReviewQuery = query(
    collection(db, "reviews"),
    where("nickname", "==", nickname),
    where("date", "==", today)
  );

  const existingReviewSnap = await getDocs(existingReviewQuery);
  if (!existingReviewSnap.empty) {
    const existingData = existingReviewSnap.docs[0].data();
    showResult(existingData.link, existingData.comment);
    localStorage.setItem(localKey, JSON.stringify(existingData));
    return;
  }

  // Step 3: Fetch review history from last 7 days for this user
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const historyQuery = query(
    collection(db, "reviews"),
    where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo))
  );
  const historySnap = await getDocs(historyQuery);

  const globallyReviewedPairs = new Set();         // link|comment for global check
  const userReviewedLinks = new Map();             // link => [comments] for this user

  historySnap.forEach(doc => {
    const data = doc.data();
    const key = `${data.link}|${data.comment}`;
    globallyReviewedPairs.add(key);

    if (data.nickname === nickname) {
      if (!userReviewedLinks.has(data.link)) {
        userReviewedLinks.set(data.link, []);
      }
      userReviewedLinks.get(data.link).push(data.comment);
    }
  });

  // Step 4: Get today's submissions
  const submissionsQuery = query(
    collection(db, "submissions"),
    where("date", "==", today)
  );
  const submissionsSnap = await getDocs(submissionsQuery);

  const validOptions = [];

  submissionsSnap.forEach(doc => {
    const data = doc.data();
    const { link, comment } = data;

    if (data.nickname === nickname) return; // ❌ Skip own submission

    const pairKey = `${link}|${comment}`;
    if (globallyReviewedPairs.has(pairKey)) return; // ❌ Already shown to someone

    if (!userReviewedLinks.has(link)) {
      validOptions.push(data); // ✅ New link for this user
    } else {
      const seenComments = userReviewedLinks.get(link);
      if (!seenComments.includes(comment)) {
        validOptions.push(data); // ✅ New comment on familiar link
      }
    }
  });

  // Step 5: Handle empty validOptions
  if (validOptions.length === 0) {
    statusText.textContent = "❌ No link+comment pair is available to post at the moment. Please come back later.";
    return;
  }

  // Step 6: Pick a random pair
  const selected = validOptions[Math.floor(Math.random() * validOptions.length)];
  showResult(selected.link, selected.comment);
  localStorage.setItem(localKey, JSON.stringify(selected));

  // Step 7: Save as reviewed in Firestore
  await addDoc(collection(db, "reviews"), {
    nickname,
    link: selected.link,
    comment: selected.comment,
    date: today,
    timestamp: Timestamp.now()
  });
});

function showResult(link, comment) {
  linkElement.href = link;
  linkElement.textContent = link;
  commentElement.value = comment;
  resultDiv.classList.remove("hidden");
  statusText.textContent = "";
}