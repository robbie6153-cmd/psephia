import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  deleteUser
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
  updateDoc,
  setDoc,
  deleteDoc
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

const isProfilePage = window.location.pathname.endsWith("profile.html");

// ===== EMAIL LINK SIGN-IN =====
if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = localStorage.getItem("emailForSignIn");

  if (!email) {
    email = prompt("Please confirm your email:");
  }

  if (email) {
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        localStorage.removeItem("emailForSignIn");
        window.history.replaceState({}, document.title, "profile.html");
      })
      .catch((error) => {
        console.error("Sign-in error:", error);
        const loginMessage = document.getElementById("loginMessage");
        if (loginMessage) {
          loginMessage.textContent = "Link expired. Please request a new one.";
        }
      });
  }
}

// ===== COMMON =====
const appPage = document.querySelector(".app-page");

// ===== APP PAGE ELEMENTS =====
const pollsView = document.getElementById("pollsView");
const createPollView = document.getElementById("createPollView");
const openCreatePollBtn = document.getElementById("openCreatePollBtn");
const cancelCreatePollBtn = document.getElementById("cancelCreatePollBtn");
const submitPollBtn = document.getElementById("submitPollBtn");

const userDetailsView = document.getElementById("userDetailsView");
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const countryInput = document.getElementById("country");
const usernameInput = document.getElementById("username");
const saveDetailsBtn = document.getElementById("saveDetailsBtn");
const detailsMessage = document.getElementById("detailsMessage");

const pollQuestion = document.getElementById("pollQuestion");
const pollCategory = document.getElementById("createPollCategory");
const pollDuration = document.getElementById("pollDuration");
const addOptionBtn = document.getElementById("addOptionBtn");
const extraOptions = document.getElementById("extraOptions");

const pollsDiv = document.getElementById("polls");
const pollsCard = document.getElementById("pollsCard");
const voteMessage = document.getElementById("voteMessage");
const categoryTabs = document.querySelectorAll(".category-tab[data-category]");
const openPollsTab = document.getElementById("openPollsTab");
const resultsPollsTab = document.getElementById("resultsPollsTab");

// ===== PROFILE PAGE ELEMENTS =====
const profileAuthView = document.getElementById("profileAuthView");
const profileLoggedInView = document.getElementById("profileLoggedInView");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signUpBtn = document.getElementById("signUpBtn");
const loginBtn = document.getElementById("loginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");

const profileFirstName = document.getElementById("profileFirstName");
const profileLastName = document.getElementById("profileLastName");
const profileCountry = document.getElementById("profileCountry");
const profileUsername = document.getElementById("profileUsername");
const editDetailsBtn = document.getElementById("editDetailsBtn");
const saveProfileDetailsBtn = document.getElementById("saveProfileDetailsBtn");
const profileMessage = document.getElementById("profileMessage");
const myPollsList = document.getElementById("myPollsList");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const deleteProfileMessage = document.getElementById("deleteProfileMessage");

// ===== STATE =====
let selectedCategory = "Politics";
let currentPollView = "open";
let countdownInterval = null;
let optionCount = 2;

// ===== MENU =====
function closeMenu() {
  const menu = document.getElementById("dropdownMenu");
  if (menu) menu.classList.remove("show");
}
window.closeMenu = closeMenu;

window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  if (menu) menu.classList.toggle("show");
};

document.addEventListener("click", (event) => {
  const menu = document.getElementById("dropdownMenu");
  const topBar = document.querySelector(".top-bar");
  if (menu && topBar && !topBar.contains(event.target)) {
    menu.classList.remove("show");
  }
});
// ===== APP VIEW HELPERS =====
function showPollsView() {
  if (userDetailsView) userDetailsView.classList.add("hidden");
  if (pollsView) pollsView.classList.remove("hidden");
  if (createPollView) createPollView.classList.add("hidden");

  if (openCreatePollBtn) {
    if (auth.currentUser) {
      openCreatePollBtn.classList.remove("hidden");
    } else {
      openCreatePollBtn.classList.add("hidden");
    }
  }
}

function showCreatePollView() {
  if (!auth.currentUser) {
    alert("You must be logged in to create a poll.");
    return;
  }

  if (userDetailsView) userDetailsView.classList.add("hidden");
  if (pollsView) pollsView.classList.add("hidden");
  if (createPollView) createPollView.classList.remove("hidden");
  if (openCreatePollBtn) openCreatePollBtn.classList.add("hidden");
}

function showUserDetailsView() {
  if (pollsView) pollsView.classList.add("hidden");
  if (createPollView) createPollView.classList.add("hidden");
  if (openCreatePollBtn) openCreatePollBtn.classList.add("hidden");
  if (userDetailsView) userDetailsView.classList.remove("hidden");
}

function setPollView(view) {
  currentPollView = view;

  if (pollsCard) {
    pollsCard.classList.toggle("mode-open", view === "open");
    pollsCard.classList.toggle("mode-results", view === "results");
  }

  if (openPollsTab) openPollsTab.classList.toggle("active", view === "open");
  if (resultsPollsTab) resultsPollsTab.classList.toggle("active", view === "results");

  loadPolls();
}

if (openPollsTab) openPollsTab.addEventListener("click", () => setPollView("open"));
if (resultsPollsTab) resultsPollsTab.addEventListener("click", () => setPollView("results"));
if (openCreatePollBtn) openCreatePollBtn.addEventListener("click", showCreatePollView);
if (cancelCreatePollBtn) cancelCreatePollBtn.addEventListener("click", showPollsView);

if (addOptionBtn) {
  addOptionBtn.addEventListener("click", () => {
    if (!extraOptions || optionCount >= 5) return;
    optionCount += 1;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Option ${optionCount}`;
    input.className = "poll-option";
    extraOptions.appendChild(input);
  });
}

categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedCategory = tab.dataset.category || "Politics";
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
  if (typeof pollData.closesAt.toDate === "function") return pollData.closesAt.toDate();
  const date = new Date(pollData.closesAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasPollEnded(pollData) {
  const endsAtDate = getEndsAtDate(pollData);
  if (!endsAtDate) return false;
  return Date.now() >= endsAtDate.getTime();
}

function formatTimeRemainingFromMs(ms) {
  if (ms <= 0) return "Voting has ended";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `Voting on this ends in ${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} minute${minutes !== 1 ? "s" : ""} and ${seconds} second${seconds !== 1 ? "s" : ""}`;
}

function getTimeRemainingText(targetDate) {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "0 minutes";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds`;
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
    return `<div class="poll-results">${options.map((option) => `<p>${escapeHtml(option)}: 0%</p>`).join("")}</div>`;
  }

  return `<div class="poll-results">${options.map((option) => {
    const count = typeof votes[option] === "number" ? votes[option] : 0;
    const percent = Math.round((count / totalVotes) * 100);
    return `<p>${escapeHtml(option)}: ${percent}%</p>`;
  }).join("")}</div>`;
}

function startCountdownUpdater() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const timerEls = document.querySelectorAll(".poll-timer[data-end-time]");

    timerEls.forEach((el) => {
      const endTime = Number(el.dataset.endTime);
      const timerType = el.dataset.timerType || "open";
      if (!endTime) return;

      const remaining = endTime - Date.now();

      if (remaining <= 0) {
        el.textContent = timerType === "results" ? "Results expired" : "Voting has ended";
        loadPolls();
        return;
      }

      if (timerType === "results") {
        el.textContent = `Results disappear in ${getTimeRemainingText(new Date(endTime))}`;
      } else {
        el.textContent = formatTimeRemainingFromMs(remaining);
      }
    });
  }, 1000);
}
// ===== PROFILE HELPERS =====
function setProfileInputsDisabled(disabled) {
  if (!profileFirstName) return;
  profileFirstName.disabled = disabled;
  profileLastName.disabled = disabled;
  profileCountry.disabled = disabled;
  profileUsername.disabled = disabled;
}

async function saveUserDetails() {
  if (!auth.currentUser) return;

  const firstName = firstNameInput?.value.trim() || "";
  const lastName = lastNameInput?.value.trim() || "";
  const country = countryInput?.value.trim() || "";
  const username = usernameInput?.value.trim() || "";

  if (!firstName || !lastName || !country || !username) {
    if (detailsMessage) detailsMessage.textContent = "Please complete all fields.";
    return;
  }

  try {
    await setDoc(doc(db, "users", auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      firstName,
      lastName,
      country,
      username
    });

    if (detailsMessage) detailsMessage.textContent = "Details saved.";
    showPollsView();
    await loadPolls();
  } catch (error) {
    console.error("Save details error:", error);
    if (detailsMessage) detailsMessage.textContent = "Could not save your details.";
  }
}

if (saveDetailsBtn) {
  saveDetailsBtn.addEventListener("click", saveUserDetails);
}

async function loadProfile(user) {
  if (!user || !profileFirstName) return;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    const data = snap.data();
    profileFirstName.value = data.firstName || "";
    profileLastName.value = data.lastName || "";
    profileCountry.value = data.country || "";
    profileUsername.value = data.username || "";

    setProfileInputsDisabled(true);
    if (saveProfileDetailsBtn) saveProfileDetailsBtn.classList.add("hidden");
    if (profileMessage) profileMessage.textContent = "";
  } catch (error) {
    console.error("Load profile error:", error);
  }
}

async function saveProfileDetails(user) {
  if (!user) return;

  const firstName = profileFirstName?.value.trim() || "";
  const lastName = profileLastName?.value.trim() || "";
  const country = profileCountry?.value.trim() || "";
  const username = profileUsername?.value.trim() || "";

  if (!firstName || !lastName || !country || !username) {
    if (profileMessage) profileMessage.textContent = "Please complete all fields.";
    return;
  }

  try {
    await updateDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      country,
      username
    });

    if (profileMessage) profileMessage.textContent = "Details saved successfully.";
    setProfileInputsDisabled(true);
    if (saveProfileDetailsBtn) saveProfileDetailsBtn.classList.add("hidden");
  } catch (error) {
    console.error("Save profile error:", error);
    if (profileMessage) profileMessage.textContent = "Could not save details.";
  }
}

async function loadMyPolls(user) {
  if (!user || !myPollsList) return;

  myPollsList.innerHTML = "";

  try {
    const snap = await getDocs(query(collection(db, "polls"), orderBy("createdAt", "desc")));
    const myDocs = snap.docs.filter((pollDoc) => {
      const poll = pollDoc.data();
      return poll.createdByUid === user.uid;
    });

    if (myDocs.length === 0) {
      myPollsList.innerHTML = "<p>You have not created any polls yet.</p>";
      return;
    }

    myDocs.forEach((pollDoc) => {
      const poll = pollDoc.data();
      const pollId = pollDoc.id;

      const pollEl = document.createElement("div");
      pollEl.className = "my-poll-card";

      pollEl.innerHTML = `
        <div class="my-poll-top">
          <div>
            <h3>${escapeHtml(poll.question || "Untitled poll")}</h3>
            <p><strong>Category:</strong> ${escapeHtml(poll.category || "Other")}</p>
          </div>
          <div class="poll-menu-wrapper">
            <button class="poll-menu-btn" type="button" data-poll-menu="${pollId}">⋯</button>
            <div class="poll-menu-dropdown" id="pollMenu-${pollId}">
              <button type="button" data-delete-poll="${pollId}">Delete poll</button>
            </div>
          </div>
        </div>
      `;

      myPollsList.appendChild(pollEl);
    });

    attachMyPollMenuEvents();
  } catch (error) {
    console.error("Load my polls error:", error);
    myPollsList.innerHTML = "<p>Could not load your polls.</p>";
  }
}

function attachMyPollMenuEvents() {
  document.querySelectorAll("[data-poll-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const pollId = button.getAttribute("data-poll-menu");
      const menu = document.getElementById(`pollMenu-${pollId}`);
      document.querySelectorAll(".poll-menu-dropdown.show").forEach((m) => m.classList.remove("show"));
      if (menu) menu.classList.toggle("show");
    });
  });

  document.querySelectorAll("[data-delete-poll]").forEach((button) => {
    button.addEventListener("click", async () => {
      const pollId = button.getAttribute("data-delete-poll");
      if (!pollId) return;

      const confirmed = confirm("Are you sure you want to delete this poll?");
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, "polls", pollId));
        await loadMyPolls(auth.currentUser);
      } catch (error) {
        console.error("Delete poll error:", error);
        alert("Could not delete poll.");
      }
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".poll-menu-dropdown.show").forEach((menu) => {
    menu.classList.remove("show");
  });
});
async function deleteProfile(user) {
  if (!user) return;

  const confirmed = confirm(
    "Are you sure you want to delete your profile? This will permanently delete your profile and any polls you have created, and your votes will be discounted."
  );

  if (!confirmed) return;

  try {
    const allPollsSnap = await getDocs(query(collection(db, "polls"), orderBy("createdAt", "desc")));

    for (const pollDoc of allPollsSnap.docs) {
      const poll = pollDoc.data();

      if (poll.createdByUid === user.uid) {
        await deleteDoc(doc(db, "polls", pollDoc.id));
        continue;
      }

      const userVotes = poll.userVotes && typeof poll.userVotes === "object" ? { ...poll.userVotes } : {};
      const votes = poll.votes && typeof poll.votes === "object" ? { ...poll.votes } : {};
      const votedBy = Array.isArray(poll.votedBy) ? [...poll.votedBy] : [];

      if (userVotes[user.uid]) {
        const chosenOption = userVotes[user.uid];
        if (typeof votes[chosenOption] === "number" && votes[chosenOption] > 0) {
          votes[chosenOption] -= 1;
        }

        delete userVotes[user.uid];

        const index = votedBy.indexOf(user.uid);
        if (index !== -1) votedBy.splice(index, 1);

        await updateDoc(doc(db, "polls", pollDoc.id), {
          votes,
          userVotes,
          votedBy
        });
      }
    }

    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Delete profile error:", error);
    if (deleteProfileMessage) {
      deleteProfileMessage.textContent = "Could not delete profile. You may need to log in again before deleting.";
    }
  }
}

if (editDetailsBtn) {
  editDetailsBtn.addEventListener("click", () => {
    setProfileInputsDisabled(false);
    if (saveProfileDetailsBtn) saveProfileDetailsBtn.classList.remove("hidden");
    if (profileMessage) profileMessage.textContent = "";
  });
}

if (saveProfileDetailsBtn) {
  saveProfileDetailsBtn.addEventListener("click", async () => {
    if (auth.currentUser) await saveProfileDetails(auth.currentUser);
  });
}

if (deleteProfileBtn) {
  deleteProfileBtn.addEventListener("click", async () => {
    if (auth.currentUser) await deleteProfile(auth.currentUser);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "profile.html";
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

if (signUpBtn) {
  signUpBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";

    if (!email) {
      if (loginMessage) loginMessage.textContent = "Please enter your email.";
      return;
    }

    if (loginMessage) loginMessage.textContent = "Sending sign-in link...";

    try {
      await sendSignInLinkToEmail(auth, email, {
        url: "https://psephia.com/profile.html",
        handleCodeInApp: true
      });

      localStorage.setItem("emailForSignIn", email);

      if (loginMessage) {
        loginMessage.innerHTML = `We’ve sent you a sign-in link.<br><br>Click the link in your email to continue.`;
      }
    } catch (error) {
      console.error(error);
      if (loginMessage) loginMessage.textContent = error.message || "Error sending link.";
    }
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    if (!email || !password) {
      if (loginMessage) loginMessage.textContent = "Please enter both email and password.";
      return;
    }

    if (loginMessage) loginMessage.textContent = "Logging in...";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        if (loginMessage) loginMessage.textContent = "Please verify your email before logging in.";
        return;
      }

      window.location.href = "app.html";
    } catch (error) {
      console.error("Login error:", error);
      if (loginMessage) loginMessage.textContent = "Incorrect email or password.";
    }
  });
}

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";

    if (!email) {
      if (loginMessage) loginMessage.textContent = "Enter your email address first.";
      return;
    }

    if (loginMessage) loginMessage.textContent = "Sending password reset email...";

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/profile.html`
      });

      if (loginMessage) {
        loginMessage.innerHTML = `We have sent you a password reset email.<br><br>Please use the newest email if you requested more than one reset link.`;
      }
    } catch (error) {
      console.error("Password reset error:", error);
      if (loginMessage) loginMessage.textContent = error.message || "Could not send password reset email.";
    }
  });
}

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
    const options = [...optionInputs].map((input) => input.value.trim()).filter((value) => value !== "");

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

      if (!userDoc.exists()) {
        alert("Please complete your profile details before creating a poll.");
        showUserDetailsView();
        return;
      }

      const creatorData = userDoc.data();

      await addDoc(collection(db, "polls"), {
        question,
        category,
        options,
        createdAt: Timestamp.fromDate(createdAt),
        closesAt: Timestamp.fromDate(closesAt),
        createdBy: creatorData.username || "Anonymous",
        createdByUid: user.uid,
        votes: {},
        userVotes: {},
        votedBy: []
      });

      if (pollQuestion) pollQuestion.value = "";
      if (pollCategory) pollCategory.value = "Politics";
      if (pollDuration) pollDuration.value = "1";

      document.querySelectorAll(".poll-option").forEach((input, index) => {
        if (index < 2) input.value = "";
      });

      if (extraOptions) extraOptions.innerHTML = "";
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

async function loadPolls() {
  if (!pollsDiv) return;

  try {
    const snap = await getDocs(query(collection(db, "polls"), orderBy("createdAt", "desc")));
    pollsDiv.innerHTML = "";

    if (snap.empty) {
      pollsDiv.innerHTML = "<p>No polls yet.</p>";
      return;
    }

    const currentUid = auth.currentUser?.uid || null;
    const now = new Date();
    let hasVisiblePolls = false;

    snap.forEach((docItem) => {
      const p = docItem.data();

      if ((p.category || "Politics") !== selectedCategory) return;

      const options = Array.isArray(p.options) ? p.options : [];
      const selectedOption =
        currentUid && p.userVotes && typeof p.userVotes === "object"
          ? p.userVotes[currentUid] || null
          : null;

      const endsAtDate = getEndsAtDate(p);
      const pollEnded = hasPollEnded(p);

      let showThisPoll = false;

      if (currentPollView === "open") {
        showThisPoll = !pollEnded;
      } else if (currentPollView === "results") {
        if (pollEnded && endsAtDate) {
          const resultsExpiryTime = endsAtDate.getTime() + 24 * 60 * 60 * 1000;
          showThisPoll = now.getTime() < resultsExpiryTime;
        }
      }

      if (!showThisPoll) return;

      hasVisiblePolls = true;

      let timerHtml = "";

      if (currentPollView === "open") {
        timerHtml = endsAtDate
          ? `<p class="poll-timer" data-end-time="${endsAtDate.getTime()}" data-timer-type="open">${escapeHtml(formatTimeRemainingFromMs(endsAtDate.getTime() - Date.now()))}</p>`
          : `<p class="poll-timer">No end time set</p>`;
      }

      if (currentPollView === "results" && endsAtDate) {
        const resultsExpiryDate = new Date(endsAtDate.getTime() + 24 * 60 * 60 * 1000);
        timerHtml = `<p class="poll-timer" data-end-time="${resultsExpiryDate.getTime()}" data-timer-type="results">Results disappear in ${escapeHtml(getTimeRemainingText(resultsExpiryDate))}</p>`;
      }

      let contentHtml = "";

      if (currentPollView === "results") {
        contentHtml = getPollResultsHtml(p);
      } else {
        contentHtml = options.map((option) => {
          const isSelected = selectedOption === option;
          return `
            <div class="vote-option${isSelected ? " selected" : ""}" data-poll-id="${docItem.id}" data-option="${encodeURIComponent(option)}">
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
      pollsDiv.innerHTML = currentPollView === "open"
        ? "<p>No open polls in this category yet.</p>"
        : "<p>No recent results in this category yet.</p>";
    }

    startCountdownUpdater();
  } catch (error) {
    console.error("Load polls error:", error);
    pollsDiv.innerHTML = "<p>Could not load polls.</p>";
  }
}

if (pollsDiv) {
  pollsDiv.addEventListener("click", async (event) => {
    const optionEl = event.target.closest(".vote-option");
    if (!optionEl || !pollsDiv.contains(optionEl)) return;

    const pollId = optionEl.dataset.pollId;
    const encodedOption = optionEl.dataset.option;
    if (!pollId || typeof encodedOption !== "string") return;

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

    const userVotes = selectedPoll.userVotes && typeof selectedPoll.userVotes === "object" ? { ...selectedPoll.userVotes } : {};
    const votes = selectedPoll.votes && typeof selectedPoll.votes === "object" ? { ...selectedPoll.votes } : {};
    const votedBy = Array.isArray(selectedPoll.votedBy) ? [...selectedPoll.votedBy] : [];

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

    await updateDoc(pollRef, { votes, userVotes, votedBy });

    showVoteMessage("Your vote has been received.", false);
    await loadPolls();
  } catch (error) {
    console.error("Voting error:", error);
    showVoteMessage("There was a problem submitting your vote.", true);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (appPage) {
    appPage.classList.remove("hidden-until-ready");
    appPage.style.visibility = "visible";
  }

  if (isProfilePage) {
    if (user) {
      if (profileAuthView) profileAuthView.classList.add("hidden");
      if (profileLoggedInView) profileLoggedInView.classList.remove("hidden");

      try {
        await loadProfile(user);
        await loadMyPolls(user);
      } catch (error) {
        console.error(error);
      }
    } else {
      if (profileAuthView) profileAuthView.classList.remove("hidden");
      if (profileLoggedInView) profileLoggedInView.classList.add("hidden");
    }
    return;
  }

  if (user) {
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (userSnap.exists()) {
        showPollsView();
        await loadPolls();
      } else {
        showUserDetailsView();
      }
    } catch (error) {
      console.error("Profile check error:", error);
      showUserDetailsView();
    }
  } else {
    if (openCreatePollBtn) openCreatePollBtn.classList.add("hidden");
    hideVoteMessage();
    showPollsView();
    await loadPolls();
  }
});