import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB26YRL03IuiYtFFc3_aweQ8EDe8_DWUd0",
  authDomain: "psephia-9807e.firebaseapp.com",
  projectId: "psephia-9807e",
  storageBucket: "psephia-9807e.firebasestorage.app",
  messagingSenderId: "1085776731080",
  appId: "1:1085776731080:web:ef9dade729d7f043b7befd"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Give each browser a simple unique user ID
let userId = localStorage.getItem("userId");

if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

// Hamburger menu
window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  if (menu) {
    menu.classList.toggle("show");
  }
};

window.addEventListener("click", function (event) {
  const button = document.querySelector(".menu-button");
  const menu = document.getElementById("dropdownMenu");

  if (button && menu && !button.contains(event.target) && !menu.contains(event.target)) {
    menu.classList.remove("show");
  }
});

// Load polls onto page
window.loadPolls = async function () {
  const pollList = document.getElementById("pollList");
  if (!pollList) return;

  pollList.innerHTML = "";

  try {
    const querySnapshot = await getDocs(collection(db, "polls"));

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const pollId = docSnap.id;

      const div = document.createElement("div");
      div.style.border = "1px solid #ccc";
      div.style.padding = "10px";
      div.style.marginBottom = "10px";

      const option1 = data.options?.[0] || "Option 1";
      const option2 = data.options?.[1] || "Option 2";

      div.innerHTML = `
        <strong>${data.question || "Untitled poll"}</strong><br><br>
        <button onclick="voteForPoll('${pollId}', '${option1.replace(/'/g, "\\'")}')">${option1}</button>
        <button onclick="voteForPoll('${pollId}', '${option2.replace(/'/g, "\\'")}')">${option2}</button>
        <div id="message-${pollId}" style="margin-top: 8px;"></div>
      `;

      pollList.appendChild(div);
    });
  } catch (error) {
    console.error("Error loading polls:", error);
  }
};

// Create poll
window.createPoll = async function () {
  const question = document.getElementById("question")?.value.trim();
  const option1 = document.getElementById("option1")?.value.trim();
  const option2 = document.getElementById("option2")?.value.trim();

  if (!question || !option1 || !option2) {
    alert("Please fill in the question and both options.");
    return;
  }

  try {
    await addDoc(collection(db, "polls"), {
      question: question,
      options: [option1, option2],
      createdAt: Timestamp.now(),
      status: "open"
    });

    alert("Poll created!");

    document.getElementById("question").value = "";
    document.getElementById("option1").value = "";
    document.getElementById("option2").value = "";

    await loadPolls();
  } catch (error) {
    console.error("Error creating poll:", error);
    alert("Something went wrong creating the poll.");
  }
};

// Vote for poll, but only once per browser per poll
window.voteForPoll = async function (pollId, selectedOption) {
  try {
    const votesSnapshot = await getDocs(collection(db, "votes"));
    let alreadyVoted = false;

    votesSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.pollId === pollId && data.userId === userId) {
        alreadyVoted = true;
      }
    });

    const messageBox = document.getElementById(`message-${pollId}`);

    if (alreadyVoted) {
      if (messageBox) {
        messageBox.textContent = "You already voted!";
      }
      return;
    }

    await addDoc(collection(db, "votes"), {
      pollId: pollId,
      option: selectedOption,
      userId: userId,
      createdAt: Timestamp.now()
    });

    if (messageBox) {
      messageBox.textContent = "Vote recorded!";
    }
  } catch (error) {
    console.error("Error recording vote:", error);
    alert("Something went wrong recording the vote.");
  }
};

// Load polls when page opens
window.addEventListener("DOMContentLoaded", loadPolls);