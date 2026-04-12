import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "psephia-9807e.firebaseapp.com",
  projectId: "psephia-9807e",
  storageBucket: "psephia-9807e.firebasestorage.app",
  messagingSenderId: "1085776731080",
  appId: "1:1085776731080:web:ef9dade729d7f043b7befd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const firstNameInput = document.getElementById("firstName");
const surnameInput = document.getElementById("surname");
const countryInput = document.getElementById("country");
const usernameInput = document.getElementById("username");
const saveProfileBtn = document.getElementById("saveProfile");
const profileMessage = document.getElementById("profileMessage");

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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "app.html";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.firstName && data.surname && data.country && data.username) {
      window.location.href = "app.html";
    }
  }
});

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
    profileMessage.textContent = "Username must be 3 to 20 characters and use only letters, numbers, or underscores.";
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
          throw new Error("That name has already been taken.");
        }
      }

      transaction.set(userRef, {
        email: user.email,
        firstName,
        surname,
        country,
        username,
        createdAt: existingUserData?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      }, { merge: true });

      transaction.set(usernameRef, {
        uid: user.uid,
        username,
        updatedAt: Timestamp.now()
      });

      if (currentUsername && currentUsername !== username) {
        const oldUsernameRef = doc(db, "usernames", currentUsername);
        transaction.delete(oldUsernameRef);
      }
    });

    profileMessage.textContent = "Details saved.";
    setTimeout(() => {
      window.location.href = "app.html";
    }, 700);
  } catch (error) {
    profileMessage.textContent = error.message || "Could not save details.";
  }
});