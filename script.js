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

const appPage = document.querySelector(".app-page");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signUpBtn = document.getElementById("signUpBtn");
const loginBtn = document.getElementById("loginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const logoutBtn = document.getElementById("logout");
const statusText = document.getElementById("status");
const loginMessage = document.getElementById("loginMessage");

const createPollCard = document.getElementById("createPoll");
const questionInput = document.getElementById("question");
const option1Input = document.getElementById("option1");
const option2Input = document.getElementById("option2");
const createBtn = document.getElementById("create");
const pollsDiv = document.getElementById("polls");
const pollsCard = document.getElementById("pollsCard");
const voteMessage = document.getElementById("voteMessage");

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

signUpBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

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

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

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

forgotPasswordBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

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
      url: window.location.origin + "/app.html"
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

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!user.emailVerified) {
      statusText.textContent = "Email not verified";
      logoutBtn.style.display = "none";
      signUpBtn.style.display = "inline-block";
      loginBtn.style.display = "inline-block";
      forgotPasswordBtn.style.display = "inline-block";
      emailInput.style.display = "block";
      passwordInput.style.display = "block";
      createPollCard.style.display = "none";
      pollsCard.style.display = "none";
      pollsDiv.innerHTML = "";
      hideVoteMessage();
      appPage.style.display = "block";
      return;
    }

    const hasProfile = await userHasProfile(user.uid);

    if (!hasProfile) {
      window.location.replace("create-account.html");
      return;
    }

    statusText.textContent = "Logged in: " + user.email;
    logoutBtn.style.display = "inline-block";
    signUpBtn.style.display = "none";
    loginBtn.style.display = "none";
    forgotPasswordBtn.style.display = "none";
    emailInput.style.display = "none";
    passwordInput.style.display = "none";

    createPollCard.style.display = "block";
    pollsCard.style.display = "block";

    await loadPolls();
    appPage.style.display = "block";
  } else {
    statusText.textContent = "Not logged in";
    logoutBtn.style.display = "none";
    signUpBtn.style.display = "inline-block";
    loginBtn.style.display = "inline-block";
    forgotPasswordBtn.style.display = "inline-block";
    emailInput.style.display = "block";
    passwordInput.style.display = "block";
    createPollCard.style.display = "none";
    pollsCard.style.display = "none";
    pollsDiv.innerHTML = "";
    hideVoteMessage();
    appPage.style.display = "block";
  }
});

async function userHasProfile(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();

    return !!(
      userData.firstName &&
      userData.surname &&
      userData.country &&
      userData.username
    );
  } catch (error) {
    console.error("Profile check error:", error);
    return false;
  }
}

createBtn.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in.");
    return;
  }

  const question = questionInput.value.trim();
  const option1 = option1Input.value.trim();
  const option2 = option2Input.value.trim();

  if (!question || !option1 || !option2) {
    alert("Please complete the question and both options.");
    return;
  }

  const votesObject = {};
  votesObject[option1] = 0;
  votesObject[option2] = 0;

  try {
    await addDoc(collection(db, "polls"), {
      question,
      options: [option1, option2],
      createdAt: Timestamp.now(),
      createdBy: user.uid,
      votes: votesObject,
      votedBy: [],
      userVotes: {}
    });

    questionInput.value = "";
    option1Input.value = "";
    option2Input.value = "";

    hideVoteMessage();
    await loadPolls();
  } catch (error) {
    console.error("Create poll error:", error);
    alert("Error creating poll: " + error.message);
  }
});

async function loadPolls() {
  try {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    pollsDiv.innerHTML = "";

    if (snap.empty) {
      pollsDiv.innerHTML = "<p>No polls yet.</p>";
      return;
    }

    const currentUid = auth.currentUser?.uid || null;

    snap.forEach((docItem) => {
      const p = docItem.data();
      const options = Array.isArray(p.options) ? p.options.slice(0, 2) : [];
      const selectedOption =
        currentUid && p.userVotes && typeof p.userVotes === "object"
          ? p.userVotes[currentUid] || null
          : null;

      const optionRows = options.map((option) => {
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

      pollsDiv.innerHTML += `
        <div class="poll">
          <strong>${escapeHtml(p.question || "")}</strong><br>
          ${optionRows}
        </div>
      `;
    });
  } catch (error) {
    console.error("Load polls error:", error);
    pollsDiv.innerHTML = "<p>Could not load polls.</p>";
  }
}

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
      votes: votes,
      votedBy: votedBy,
      userVotes: userVotes
    });

    showVoteMessage("Your vote has been received.", false);
    await loadPolls();
  } catch (error) {
    console.error("Voting error:", error);
    showVoteMessage("There was a problem submitting your vote.", true);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}