import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {
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

  const form = document.getElementById('submissionForm');
  const linkCommentPairs = document.getElementById('linkCommentPairs');
  const addPairBtn = document.getElementById('addPairBtn');
  const statusText = document.getElementById('status');
  const nicknameInput = document.getElementById('nickname');

  let pairCount = 1;
  const maxPairs = 4;

  // Helper: Generate and store device ID
  function getDeviceId() {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('deviceId', id);
    }
    return id;
  }

  addPairBtn.addEventListener('click', () => {
    if (pairCount >= maxPairs) return;

    const newPair = document.createElement('div');
    newPair.classList.add('pair');
    newPair.innerHTML = `
      <input type="text" name="link" placeholder="Paste Link" required>
      <textarea name="comment" placeholder="Enter Comment" class="comment" required></textarea>
    `;
    linkCommentPairs.appendChild(newPair);
    pairCount++;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusText.textContent = '';
    const nickname = nicknameInput.value.trim().toLowerCase();

    if (!nickname) {
      statusText.textContent = "Nickname is required.";
      return;
    }

    const deviceId = getDeviceId();

    // ✅ Lock nickname per device
    const lockedNickname = localStorage.getItem('lockedNickname');
    if (lockedNickname && lockedNickname !== nickname) {
      statusText.textContent = `This device is already locked to nickname: "${lockedNickname}". You cannot use a different nickname.`;
      return;
    }

    // ✅ Save nickname to localStorage if first time
    if (!lockedNickname) {
      localStorage.setItem('lockedNickname', nickname);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const pairs = Array.from(linkCommentPairs.getElementsByClassName('pair'));
    const submissions = [];

    for (const pair of pairs) {
      const link = pair.querySelector('input[name="link"]').value.trim();
      const commentInput = pair.querySelector('input[name="comment"], textarea[name="comment"]');
      const comment = commentInput?.value.trim();

      if (!link || !comment) {
        statusText.textContent = "Both link and comment are required.";
        return;
      }

      submissions.push({ nickname, link, comment });
    }

    try {
      const submissionsRef = collection(db, 'submissions');
      const q = query(submissionsRef, where("nickname", "==", nickname));
      const querySnapshot = await getDocs(q);

      // Check for today's submission
      let submittedToday = false;
      const existingCombos = new Set();

      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.date === todayStr) {
          submittedToday = true;
        }
        const comboKey = `${data.link}___${data.comment}`;
        existingCombos.add(comboKey);
      });

      if (submittedToday) {
        statusText.textContent = "You've already submitted today.";
        return;
      }

      // Filter out duplicates
      const uniqueNewSubmissions = submissions.filter(sub => {
        const comboKey = `${sub.link}___${sub.comment}`;
        return !existingCombos.has(comboKey);
      });

      if (uniqueNewSubmissions.length === 0) {
        statusText.textContent = "No new (unique) link+comment pairs to submit.";
        return;
      }

      // Submit all valid new entries
      for (const sub of uniqueNewSubmissions) {
        await addDoc(submissionsRef, {
          nickname: sub.nickname,
          link: sub.link,
          comment: sub.comment,
          deviceId,
          date: todayStr,
          timestamp: serverTimestamp()
        });
      }

      statusText.textContent = "✅ Submitted successfully!";
      alert("✅ Your link + comment has been submitted successfully!");
      form.reset();
      linkCommentPairs.innerHTML = `
        <div class="pair">
          <input type="text" name="link" placeholder="Paste Link" required>
          <input type="text" name="comment" placeholder="Write Comment" required>
        </div>
      `;
      pairCount = 1;

    } catch (err) {
      console.error("❌ Error submitting:", err);
      statusText.textContent = "Error submitting. Try again.";
    }
  });
});