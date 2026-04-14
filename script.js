import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB26YRlo3IuiYtFFc3_aweQ8EDe8_DWUd0",
  authDomain: "psephia-9807e.firebaseapp.com",
  projectId: "psephia-9807e",
  storageBucket: "psephia-9807e.firebasestorage.app",
  messagingSenderId: "1085776731080",
  appId: "1:1085776731080:web:ef9dade729d7f043b7befd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== PAGE =====
const appPage = document.querySelector(".app-page");

// ===== APP ELEMENTS =====
const pollsView = document.getElementById("pollsView");
const createPollView = document.getElementById("createPollView");
const openCreatePollBtn = document.getElementById("openCreatePollBtn");
const cancelCreatePollBtn = document.getElementById("cancelCreatePollBtn");
const submitPollBtn = document.getElementById("submitPollBtn");

// ===== CREATE POLL INPUTS =====
const pollQuestion = document.getElementById("pollQuestion");
const pollCategory = document.getElementById("createPollCategory");
const pollDuration = document.getElementById("pollDuration");
const addOptionBtn = document.getElementById("addOptionBtn");
const extraOptions = document.getElementById("extraOptions");

// ===== POLLS DISPLAY =====
const pollsDiv = document.getElementById("polls");
const pollsCard = document.getElementById("pollsCard");
const voteMessage = document.getElementById("voteMessage");
const categoryTabs = document.querySelectorAll(".category-tab");

// ===== AUTH / ACCOUNT =====
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signUpBtn = document.getElementById("signUpBtn");
const loginBtn = document.getElementById("loginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const logoutBtn = document.getElementById("logout");
const statusText = document.getElementById("status");
const loginMessage = document.getElementById("loginMessage");

// ===== STATE =====
let selectedCategory = "Politics";
let countdownInterval = null;
let optionCount = 2;

// ===== MENU =====
window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  if (menu) {
    menu.classList.toggle("show");
  }
};

document.addEventListener("click", (event) => {
  const menu = document.getElementById("dropdownMenu");
  const wrapper = document.querySelector(".menu-wrapper");

  if (menu && wrapper && !wrapper.contains(event.target)) {
    menu.classList.remove("show");
  }
});

// ===== VIEW SWITCHING =====
function showPollsView() {
  if (pollsView) {
    pollsView.classList.remove("hidden");
  }

  if (createPollView) {
    createPollView.classList.add("hidden");
  }

  if (openCreatePollBtn) {
    if (auth.currentUser) {
      openCreatePollBtn.classList.remove("hidden");
    } else {
      openCreatePollBtn.classList.add("hidden");
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCreatePollView() {
  if (!auth.currentUser) {
    alert("You must be logged in to create a poll.");
    return;
  }

  if (pollsView) {
    pollsView.classList.add("hidden");
  }

  if (createPollView) {
    createPollView.classList.remove("hidden");
  }

  if (openCreatePollBtn) {
    openCreatePollBtn.classList.add("hidden");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (openCreatePollBtn) {
  openCreatePollBtn.addEventListener("click", showCreatePollView);
}

if (cancelCreatePollBtn) {
  cancelCreatePollBtn.addEventListener("click", showPollsView);
}

if (addOptionBtn) {
  addOptionBtn.addEventListener("click", () => {
    if (optionCount >= 5) return;

    optionCount += 1;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Option ${optionCount}`;
    input.className = "poll-option";

    extraOptions.appendChild(input);
  });
}

// ===== CATEGORY TABS =====
categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const category = tab.dataset.category || "Politics";

    selectedCategory = category;

    categoryTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    loadPolls();
  });
});

// ===== HELPERS =====
function showVoteMessage(message, isError = false) {
  if (!voteMessage) return;

  voteMessage.textContent = message;
  voteMessage.style.display = "block";
  voteMessage.style.background = isError ? "#fff3f3" : "#f3fff5";
  voteMessage.style.color = isError ? "#b00020" : "#146c2e";
  voteMessage.style.border = isError ? "1px solid #e0b4b4" : "1px solid #b7dfc1";
}

function hideVoteMessage() {
  if (!voteMessage) return;

  voteMessage.style.display = "none";
  voteMessage.textContent = "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function getEndsAtDate(pollData) {
  if (!pollData?.closesAt) return null;

  if (typeof pollData.closesAt.toDate === "function") {
    return pollData.closesAt.toDate();
  }

  const date = new Date(pollData.closesAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasPollEnded(pollData) {
  const endsAtDate = getEndsAtDate(pollData);
  if (!endsAtDate) return false;
  return Date.now() >= endsAtDate.getTime();
}

function formatTimeRemainingFromMs(ms) {
  if (ms <= 0) {
    return "Voting has ended";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `Voting on this ends in ${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} minute${minutes !== 1 ? "s" : ""} and ${seconds} second${seconds !== 1 ? "s" : ""}`;
}

function formatTimeRemaining(endsAtDate) {
  return formatTimeRemainingFromMs(endsAtDate.getTime() - Date.now());
}

function getPollResultsHtml(pollData) {
  const options = Array.isArray(pollData.options) ? pollData.options : [];
  const votes = pollData.votes && typeof pollData.votes === "object" ? pollData.votes : {};

  let totalVotes = 0;

  options.forEach((option) => {
    totalVotes += typeof votes[option] === "number" ? votes[option] : 0;
  });

  if (options.length === 0) {
    return `<div class="poll-results"><p>No options available.</p></div>`;
  }

  if (totalVotes === 0) {
    return `
      <div class="poll-results">
        ${options.map((option) => `<p>${escapeHtml(option)}: 0%</p>`).join("")}
      </div>
    `;
  }

  return `
    <div class="poll-results">
      ${options.map((option) => {
        const count = typeof votes[option] === "number" ? votes[option] : 0;
        const percent = Math.round((count / totalVotes) * 100);
        return `<p>${escapeHtml(option)}: ${percent}%</p>`;
      }).join("")}
    </div>
  `;
}

function startCountdownUpdater() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    const timerEls = document.querySelectorAll(".poll-timer[data-end-time]");

    timerEls.forEach((el) => {
      const endTime = Number(el.dataset.endTime);
      if (!endTime) return;

      const remaining = endTime - Date.now();
      el.textContent = formatTimeRemainingFromMs(remaining);

      if (remaining <= 0) {
        loadPolls();
      }
    });
  }, 1000);
}

// ===== AUTH =====
if (signUpBtn) {
  signUpBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    if (!email || !password) {
      loginMessage.textContent = "Please enter both email and password.";
      return;
    }

    if (password.length < 6) {
      loginMessage.textContent = "Password must be at least 6 characters long.";
      return;
    }

    signUpBtn.disabled = true;
    loginBtn.disabled = true;
    forgotPasswordBtn.disabled = true;
    loginMessage.textContent = "Creating account...";

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await sendEmailVerification(userCredential.user);
      await signOut(auth);

      loginMessage.innerHTML = `
        We have sent you a verification email.<br><br>
        Please click the link in that email, then return here and log in.
      `;
    } catch (error) {
      console.error("Sign up error:", error);

      if (error.code === "auth/email-already-in-use") {
        loginMessage.textContent = "An account already exists with that email.";
      } else if (error.code === "auth/invalid-email") {
        loginMessage.textContent = "Please enter a valid email address.";
      } else if (error.code === "auth/weak-password") {
        loginMessage.textContent = "Password must be at least 6 characters long.";
      } else {
        loginMessage.textContent = error.message || "Could not create account.";
      }
    } finally {
      signUpBtn.disabled = false;
      loginBtn.disabled = false;
      forgotPasswordBtn.disabled = false;
    }
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    if (!email || !password) {
      loginMessage.textContent = "Please enter both email and password.";
      return;
    }

    signUpBtn.disabled = true;
    loginBtn.disabled = true;
    forgotPasswordBtn.disabled = true;
    loginMessage.textContent = "Logging in...";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        loginMessage.textContent = "Please verify your email before logging in.";
        return;
      }

      loginMessage.textContent = "Login successful.";
    } catch (error) {
      console.error("Login error:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        loginMessage.textContent = "Incorrect email or password.";
      } else if (error.code === "auth/invalid-email") {
        loginMessage.textContent = "Please enter a valid email address.";
      } else {
        loginMessage.textContent = error.message || "Could not log in.";
      }
    } finally {
      signUpBtn.disabled = false;
      loginBtn.disabled = false;
      forgotPasswordBtn.disabled = false;
    }
  });
}

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";

    if (!email) {
      loginMessage.textContent = "Enter your email address first, then press Forgot Password.";
      return;
    }

    forgotPasswordBtn.disabled = true;
    signUpBtn.disabled = true;
    loginBtn.disabled = true;
    loginMessage.textContent = "Sending password reset email...";

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/app.html`
      });

      loginMessage.innerHTML = `
        We have sent you a password reset email.<br><br>
        Please use the newest email if you requested more than one reset link.
      `;
    } catch (error) {
      console.error("Password reset error:", error);

      if (error.code === "auth/invalid-email") {
        loginMessage.textContent = "Please enter a valid email address.";
      } else {
        loginMessage.textContent = error.message || "Could not send password reset email.";
      }
    } finally {
      forgotPasswordBtn.disabled = false;
      signUpBtn.disabled = false;
      loginBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      hideVoteMessage();
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (appPage) {
    appPage.classList.remove("hidden-until-ready");
    appPage.style.visibility = "visible";
  }

  if (user) {
    statusText.textContent = "Logged in: " + user.email;
    logoutBtn.style.display = "inline-block";
    signUpBtn.style.display = "none";
    loginBtn.style.display = "none";
    forgotPasswordBtn.style.display = "none";
    emailInput.style.display = "none";
    passwordInput.style.display = "none";
    loginMessage.textContent = "";

    showPollsView();
    await loadPolls();
  } else {
    statusText.textContent = "Not logged in";
    logoutBtn.style.display = "none";
    signUpBtn.style.display = "inline-block";
    loginBtn.style.display = "inline-block";
    forgotPasswordBtn.style.display = "inline-block";
    emailInput.style.display = "block";
    passwordInput.style.display = "block";

    hideVoteMessage();
    showPollsView();
    await loadPolls();
  }
});

// ===== CREATE POLL =====
if (submitPollBtn) {
  submitPollBtn.addEventListener("click", async () => {
    const question = pollQuestion?.value.trim() || "";
    const category = pollCategory?.value || "Politics";
    const durationDays = Number(pollDuration?.value || "1");

    if (!auth.currentUser) {
      alert("You must be logged in to create a poll.");
      return;
    }

    const optionInputs = document.querySelectorAll(".poll-option");
    const options = [...optionInputs]
      .map((input) => input.value.trim())
      .filter((value) => value !== "");

    if (!question) {
      alert("Please enter a question.");
      return;
    }

    if (options.length < 2) {
      alert("You must create at least two options.");
      return;
    }

    try {
      const createdAt = new Date();
      const closesAt = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const user = auth.currentUser;

const userDoc = await getDoc(doc(db, "users", user.uid));
const creator = userDoc.exists() ? userDoc.data().username : "Unknown user";

      await addDoc(collection(db, "polls"), {
        question,
        category,
        options,
        createdAt: Timestamp.fromDate(createdAt),
        closesAt: Timestamp.fromDate(closesAt),
        createdBy: creator,
        votes: {},
        userVotes: {},
        votedBy: []
      });

      pollQuestion.value = "";
      pollCategory.value = "Politics";
      pollDuration.value = "1";

      document.querySelectorAll(".poll-option").forEach((input, index) => {
        if (index < 2) {
          input.value = "";
        }
      });

      extraOptions.innerHTML = "";
      optionCount = 2;

      hideVoteMessage();
      showPollsView();
      await loadPolls();
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("There was a problem creating the poll.");
    }
  });
}

// ===== LOAD POLLS =====
async function loadPolls() {
  if (!pollsDiv) return;

  try {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    pollsDiv.innerHTML = "";

    if (snap.empty) {
      pollsDiv.innerHTML = "<p>No polls yet.</p>";
      return;
    }

    const currentUid = auth.currentUser?.uid || null;
    let hasVisiblePolls = false;

    snap.forEach((docItem) => {
      const p = docItem.data();

      if ((p.category || "Politics") !== selectedCategory) {
        return;
      }

      hasVisiblePolls = true;

      const options = Array.isArray(p.options) ? p.options : [];
      const selectedOption =
        currentUid && p.userVotes && typeof p.userVotes === "object"
          ? p.userVotes[currentUid] || null
          : null;

      const endsAtDate = getEndsAtDate(p);
      const pollEnded = hasPollEnded(p);

      let timerHtml = `<p class="poll-timer">No end time set</p>`;
      if (endsAtDate) {
        timerHtml = `
          <p class="poll-timer" data-end-time="${endsAtDate.getTime()}">
            ${escapeHtml(formatTimeRemaining(endsAtDate))}
          </p>
        `;
      }

      let contentHtml = "";

      if (pollEnded) {
        contentHtml = getPollResultsHtml(p);
      } else {
        contentHtml = options.map((option) => {
          const isSelected = selectedOption === option;
          return `
            <div
              class="vote-option${isSelected ? " selected" : ""}"
              data-poll-id="${docItem.id}"
              data-option="${encodeURIComponent(option)}"
            >
              <span class="vote-tick">${isSelected ? "✔" : "✓"}</span>
              <span class="vote-text">${escapeHtml(option)}</span>
            </div>
          `;
        }).join("");
      }

      pollsDiv.innerHTML += `
        <div class="poll">
          <strong>${escapeHtml(p.question || "")}</strong>
         <p class="poll-author">Poll created by: ${escapeHtml(p.createdBy || "Anonymous")}</p>
          ${timerHtml}
          ${contentHtml}
        </div>
      `;
    });

    if (!hasVisiblePolls) {
      pollsDiv.innerHTML = "<p>No polls in this category yet.</p>";
    }

    startCountdownUpdater();
  } catch (error) {
    console.error("Load polls error:", error);
    pollsDiv.innerHTML = "<p>Could not load polls.</p>";
  }
}

// ===== VOTING =====
if (pollsDiv) {
  pollsDiv.addEventListener("click", async (event) => {
    const optionEl = event.target.closest(".vote-option");

    if (!optionEl || !pollsDiv.contains(optionEl)) {
      return;
    }

    const pollId = optionEl.dataset.pollId;
    const encodedOption = optionEl.dataset.option;

    if (!pollId || typeof encodedOption !== "string") {
      showVoteMessage("There was a problem reading that vote option.", true);
      return;
    }

    const option = decodeURIComponent(encodedOption);
    await voteOnPoll(pollId, option);
  });
}

async function voteOnPoll(pollId, option) {
  const user = auth.currentUser;

  if (!user) {
    showVoteMessage("You must be signed in to vote.", true);
    return;
  }

  try {
    const pollRef = doc(db, "polls", pollId);
    const pollSnap = await getDoc(pollRef);

    if (!pollSnap.exists()) {
      showVoteMessage("Poll not found.", true);
      return;
    }

    const selectedPoll = pollSnap.data();

    if (hasPollEnded(selectedPoll)) {
      showVoteMessage("Voting on this poll has ended.", true);
      await loadPolls();
      return;
    }

    const userVotes =
      selectedPoll.userVotes && typeof selectedPoll.userVotes === "object"
        ? { ...selectedPoll.userVotes }
        : {};

    const votes =
      selectedPoll.votes && typeof selectedPoll.votes === "object"
        ? { ...selectedPoll.votes }
        : {};

    const votedBy =
      Array.isArray(selectedPoll.votedBy) ? [...selectedPoll.votedBy] : [];

    if (userVotes[user.uid]) {
      showVoteMessage("You have already voted on this poll. Please try a new one.", true);
      await loadPolls();
      return;
    }

    votes[option] = typeof votes[option] === "number" ? votes[option] + 1 : 1;
    userVotes[user.uid] = option;

    if (!votedBy.includes(user.uid)) {
      votedBy.push(user.uid);
    }

    await updateDoc(pollRef, {
      votes,
      votedBy,
      userVotes
    });

    showVoteMessage("Your vote has been received.", false);
    await loadPolls();
  } catch (error) {
    console.error("Voting error:", error);
    showVoteMessage("There was a problem submitting your vote.", true);
  }
}