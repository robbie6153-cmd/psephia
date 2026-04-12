import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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
  runTransaction
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

const emailInput = document.getElementById("email");
const sendLinkBtn = document.getElementById("sendLink");
const logoutBtn = document.getElementById("logout");
const statusText = document.getElementById("status");
const loginMessage = document.getElementById("loginMessage");

const yourDetailsCard = document.getElementById("yourDetails");
const firstNameInput = document.getElementById("firstName");
const surnameInput = document.getElementById("surname");
const countryInput = document.getElementById("country");
const usernameInput = document.getElementById("username");
const saveProfileBtn = document.getElementById("saveProfile");
const profileMessage = document.getElementById("profileMessage");

const createPollCard = document.getElementById("createPoll");
const questionInput = document.getElementById("question");
const option1Input = document.getElementById("option1");
const option2Input = document.getElementById("option2");
const createBtn = document.getElementById("create");
const pollsDiv = document.getElementById("polls");
const pollsCard = document.getElementById("pollsCard");

window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  menu.classList.toggle("show");
};

document.addEventListener("click", (event) => {
  const menu = document.getElementById("dropdownMenu");
  const wrapper = document.querySelector(".menu-wrapper");

  if (wrapper && !wrapper.contains(event.target)) {
    menu.classList.remove("show");
  }
});

const actionCodeSettings = {
  url: window.location.origin + window.location.pathname,
  handleCodeInApp: true
};

sendLinkBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    loginMessage.textContent = "Please enter your email address.";
    return;
  }

  sendLinkBtn.disabled = true;
  loginMessage.textContent = "Sending your email link...";

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);

    loginMessage.innerHTML = `
      We have sent you an email link so you can sign in or create your account.<br><br>
      It may take up to a minute to arrive.<br>
      Please check your junk or spam folder if you do not see it.
    `;
  } catch (error) {
    console.error("Email link error:", error);
    loginMessage.textContent = `Could not send email link: ${error.code || ""} ${error.message || ""}`;
  } finally {
    sendLinkBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = window.localStorage.getItem("emailForSignIn");

  if (!email) {
    email = window.prompt("Please confirm your email address");
  }

  if (email) {
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        window.localStorage.removeItem("emailForSignIn");
        loginMessage.textContent = "You are now signed in.";
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((error) => {
        loginMessage.textContent = "Error: " + error.message;
        console.error(error);
      });
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    statusText.textContent = "Logged in: " + user.email;
    logoutBtn.style.display = "inline-block";
    sendLinkBtn.style.display = "none";
    emailInput.style.display = "none";
    pollsCard.style.display = "block";

    await checkProfile(user.uid);
    loadPolls();
  } else {
    statusText.textContent = "Not logged in";
    logoutBtn.style.display = "none";
    sendLinkBtn.style.display = "inline-block";
    emailInput.style.display = "block";

    yourDetailsCard.style.display = "none";
    createPollCard.style.display = "none";
    pollsCard.style.display = "none";
    pollsDiv.innerHTML = "";
  }
});

async function checkProfile(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();

      if (
        userData.firstName &&
        userData.surname &&
        userData.country &&
        userData.username
      ) {
        yourDetailsCard.style.display = "none";
        createPollCard.style.display = "block";
      } else {
        yourDetailsCard.style.display = "block";
        createPollCard.style.display = "none";

        firstNameInput.value = userData.firstName || "";
        surnameInput.value = userData.surname || "";
        countryInput.value = userData.country || "";
        usernameInput.value = userData.username || "";
      }
    } else {
      yourDetailsCard.style.display = "block";
      createPollCard.style.display = "none";
    }
  } catch (error) {
    console.error(error);
  }
}

saveProfileBtn.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    profileMessage.textContent = "You must be logged in.";
    return;
  }

  const firstName = firstNameInput.value.trim();
  const surname = surnameInput.value.trim();
  const country = countryInput.value.trim();
  const usernameRaw = usernameInput.value.trim();

  if (!firstName || !surname || !country || !usernameRaw) {
    profileMessage.textContent = "Please complete all fields.";
    return;
  }

  const username = usernameRaw.toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    profileMessage.textContent =
      "Username must be 3 to 20 characters and use only letters, numbers, or underscores.";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const usernameRef = doc(db, "usernames", username);

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const usernameSnap = await transaction.get(usernameRef);

      const existingUserData = userSnap.exists() ? userSnap.data() : null;
      const currentUsername = existingUserData?.username || null;

      if (usernameSnap.exists()) {
        const usernameOwner = usernameSnap.data().uid;

        if (usernameOwner !== user.uid) {
          throw new Error("That username is already taken. Please use another.");
        }
      }

      transaction.set(
        userRef,
        {
          email: user.email,
          firstName,
          surname,
          country,
          username,
          createdAt: existingUserData?.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );

      transaction.set(usernameRef, {
        uid: user.uid,
        username: username,
        updatedAt: Timestamp.now()
      });

      if (currentUsername && currentUsername !== username) {
        const oldUsernameRef = doc(db, "usernames", currentUsername);
        transaction.delete(oldUsernameRef);
      }
    });

    profileMessage.textContent = "Details saved.";
    yourDetailsCard.style.display = "none";
    createPollCard.style.display = "block";
  } catch (error) {
    profileMessage.textContent = error.message || "Could not save details.";
    console.error(error);
  }
});

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

  try {
    await addDoc(collection(db, "polls"), {
      question,
      options: [option1, option2],
      createdAt: Timestamp.now(),
      createdBy: user.uid
    });

    questionInput.value = "";
    option1Input.value = "";
    option2Input.value = "";

    loadPolls();
  } catch (error) {
    alert("Error creating poll: " + error.message);
    console.error(error);
  }
});

async function loadPolls() {
  try {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    pollsDiv.innerHTML = "";

    snap.forEach((docItem) => {
      const p = docItem.data();

      pollsDiv.innerHTML += `
        <div class="poll">
          <strong>${escapeHtml(p.question || "")}</strong><br>
          ${escapeHtml(p.options?.[0] || "")}<br>
          ${escapeHtml(p.options?.[1] || "")}
        </div>
      `;
    });

    if (!snap.size) {
      pollsDiv.innerHTML = "<p>No polls yet.</p>";
    }
  } catch (error) {
    console.error(error);
    pollsDiv.innerHTML = "<p>Could not load polls.</p>";
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}