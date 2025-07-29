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
const statusText = document.getElementById('status');
const reviewsContainer = document.getElementById('reviewGrid'); // This will hold Review 1, 2, etc.

// Modal elements (assume these exist in HTML)
const modal = document.getElementById('modal');
const modalLink = document.getElementById('modal-link');
const modalComment = document.getElementById('modal-comment');
const modalClose = document.getElementById('closeModal');

// Close modal
modalClose.addEventListener('click', () => {
  modal.classList.add('hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nicknameInput = document.getElementById('nickname');
  const nickname = nicknameInput.value.trim().toLowerCase();
  if (!nickname) return;

  const today = new Date().toISOString().split("T")[0];
  const localKey = `reviews_${nickname}_${today}`;

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

  // Step 1: Load user’s today's reviews
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
    reviewedLinks.add(data.link); // prevent re-reviewing same link
    userReviewList.push(data);
  });

  // Step 2: Load global reviewed link|comment pairs (today only)
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

  // Step 3: Load today’s submissions (excluding self)
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
    if (globallyUsedPairs.has(pairKey)) return; // used globally
    if (reviewedLinks.has(link)) return; // user already got this link

    validOptions.push(data);
  });

  // Step 4: Handle if no valid options
  if (validOptions.length === 0) {
    statusText.textContent = "❌ No link+comment pair is available to assign. Please try again later.";
    return;
  }

  // Step 5: Pick a new random valid pair
  const selected = validOptions[Math.floor(Math.random() * validOptions.length)];

  // Step 6: Save to Firestore as new review
  await addDoc(collection(db, "reviews"), {
    nickname,
    link: selected.link,
    comment: selected.comment,
    date: today,
    timestamp: Timestamp.now()
  });

  // Step 7: Show in UI
  userReviewList.push({
    link: selected.link,
    comment: selected.comment
  });
  reviewedLinks.add(selected.link);

  renderReviewList(userReviewList);
  statusText.textContent = "✅ New review assigned!";
});

// Function to render the review cards (Review 1, 2, ...)
function renderReviewList(reviews) {
  reviewsContainer.innerHTML = ''; // Clear all
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