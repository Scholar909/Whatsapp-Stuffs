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
const nicknameInput = document.getElementById('nickname');
const statusText = document.getElementById('status');
const reviewsContainer = document.getElementById('reviewGrid');

// Modal elements
const modal = document.getElementById('modal');
const modalLink = document.getElementById('modal-link');
const modalComment = document.getElementById('modal-comment');
const modalClose = document.getElementById('closeModal');

modalClose.addEventListener('click', () => {
  modal.classList.add('hidden');
});

// Load previously received reviews on page load
window.addEventListener('DOMContentLoaded', async () => {
  const lockedNickname = localStorage.getItem("lockedNickname");
  if (!lockedNickname) return;

  nicknameInput.value = lockedNickname;
  await loadAndRenderReviews(lockedNickname);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const enteredNickname = nicknameInput.value.trim().toLowerCase();
  const lockedNickname = localStorage.getItem("lockedNickname");

  if (!lockedNickname) {
    statusText.textContent = "❌ You must first submit a link and comment pair before receiving reviews.";
    return;
  }

  if (enteredNickname !== lockedNickname) {
    statusText.textContent = `❌ This device is locked to nickname: "${lockedNickname}".`;
    return;
  }

  const nickname = lockedNickname;
  const today = new Date().toISOString().split("T")[0];

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

  // Step 1: Load today's user reviews
  const userReviewQuery = query(
    collection(db, "reviews"),
    where("nickname", "==", nickname),
    where("date", "==", today)
  );
  const userReviewSnap = await getDocs(userReviewQuery);
  const reviewedLinks = new Set();
  const userReviewList = [];

  userReviewSnap.forEach(doc => {
    const data = doc.data();
    reviewedLinks.add(data.link);
    userReviewList.push(data);
  });

  // Step 2: Load all today's reviewed pairs (globally)
  const globalReviewQuery = query(
    collection(db, "reviews"),
    where("date", "==", today)
  );
  const globalReviewSnap = await getDocs(globalReviewQuery);
  const globallyUsedPairs = new Set();

  globalReviewSnap.forEach(doc => {
    const data = doc.data();
    globallyUsedPairs.add(`${data.link}|${data.comment}`);
  });

  // Step 3: Load today's submissions (excluding user's own)
  const submissionsQuery = query(
    collection(db, "submissions"),
    where("date", "==", today)
  );
  const submissionsSnap = await getDocs(submissionsQuery);

  const validOptions = [];

  submissionsSnap.forEach(doc => {
    const data = doc.data();
    const { link, comment } = data;
    if (data.nickname === nickname) return;

    const pairKey = `${link}|${comment}`;
    if (globallyUsedPairs.has(pairKey)) return;
    if (reviewedLinks.has(link)) return;

    validOptions.push(data);
  });

  // Step 4: Check for available pair
  if (validOptions.length === 0) {
    statusText.textContent = "❌ No link+comment pair is available to assign. Please try again later.";
    return;
  }

  // Step 5: Pick one randomly
  const selected = validOptions[Math.floor(Math.random() * validOptions.length)];

  // Step 6: Save to Firestore
  await addDoc(collection(db, "reviews"), {
    nickname,
    link: selected.link,
    comment: selected.comment,
    date: today,
    timestamp: Timestamp.now()
  });

  // Step 7: Update UI
  userReviewList.push({
    link: selected.link,
    comment: selected.comment
  });
  reviewedLinks.add(selected.link);

  renderReviewList(userReviewList);
  statusText.textContent = "✅ New review assigned!";
});

// Render reviews to UI
function renderReviewList(reviews) {
  reviewsContainer.innerHTML = '';
  reviews.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'review-box';
    div.textContent = `Review ${index + 1}`;
    div.dataset.link = item.link;
    div.dataset.comment = item.comment;
    div.addEventListener('click', () => {
      modalLink.href = item.link;
      modalLink.textContent = item.link;
      modalComment.textContent = item.comment;
      modal.classList.remove('hidden');
    });
    reviewsContainer.appendChild(div);
  });
}

// Auto-load reviews on page load
async function loadAndRenderReviews(nickname) {
  const today = new Date().toISOString().split("T")[0];
  const reviewQuery = query(
    collection(db, "reviews"),
    where("nickname", "==", nickname),
    where("date", "==", today)
  );
  const reviewSnap = await getDocs(reviewQuery);
  const reviews = [];
  reviewSnap.forEach(doc => {
    const data = doc.data();
    reviews.push(data);
  });
  if (reviews.length > 0) {
    renderReviewList(reviews);
  }
}