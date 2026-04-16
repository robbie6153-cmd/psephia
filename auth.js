import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  isSignInWithEmailLink,
  signInWithEmailLink,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

import {
  isProfilePage,
  appPage,
  profileAuthView,
  profileLoggedInView,
  emailInput,
  passwordInput,
  signUpBtn,
  loginBtn,
  forgotPasswordBtn,
  switchAccountBtn,
  logoutBtn,
  loginMessage,
  profileFirstName,
  profileLastName,
  profileCountry,
  profileUsername,
  editDetailsBtn,
  saveProfileDetailsBtn,
  profileMessage,
  deleteProfileBtn,
  deleteProfileMessage,
  setProfileInputsDisabled,
  showPollsView,
  showUserDetailsView,
  hideVoteMessage,
  initUi
} from "./ui.js";

import {
  loadPolls,
  loadMyPolls,
  deleteProfilePollData,
  initPollEvents
} from "./polls.js";

// ===== EMAIL LINK SIGN-IN =====
async function handleEmailLinkSignIn() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;

  let email = localStorage.getItem("emailForSignIn");

  if (!email) {
    email = prompt("Please confirm your email:");
  }

  if (!email) return;

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem("emailForSignIn");
    window.history.replaceState({}, document.title, "profile.html");
  } catch (error) {
    console.error("Sign-in error:", error);
    if (loginMessage) {
      loginMessage.textContent = "Link expired. Please request a new one.";
    }
  }
}

async function handleManualLoginMode() {
  const params = new URLSearchParams(window.location.search);
  const isManualMode = params.get("manual") === "1";

  if (!isManualMode) return;

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Manual mode sign-out error:", error);
  }
}

// ===== PROFILE HELPERS =====
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

    if (saveProfileDetailsBtn) {
      saveProfileDetailsBtn.classList.add("hidden");
    }

    if (profileMessage) {
      profileMessage.textContent = "";
    }
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
    if (profileMessage) {
      profileMessage.textContent = "Please complete all fields.";
    }
    return;
  }

  try {
    await updateDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      country,
      username
    });

    if (profileMessage) {
      profileMessage.textContent = "Details saved successfully.";
    }

    setProfileInputsDisabled(true);

    if (saveProfileDetailsBtn) {
      saveProfileDetailsBtn.classList.add("hidden");
    }
  } catch (error) {
    console.error("Save profile error:", error);
    if (profileMessage) {
      profileMessage.textContent = "Could not save details.";
    }
  }
}

async function deleteProfile(user) {
  if (!user) return;

  const confirmed = confirm(
    "Are you sure you want to delete your profile? This will permanently delete your profile and any polls you have created, and your votes will be discounted."
  );

  if (!confirmed) return;

  try {
    const cleaned = await deleteProfilePollData(user);
    if (!cleaned) return;

    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Delete profile error:", error);
    if (deleteProfileMessage) {
      deleteProfileMessage.textContent =
        "Could not delete profile. You may need to log in again before deleting.";
    }
  }
}

// ===== AUTH BUTTONS =====
function initAuthButtons() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "profile.html?manual=1";
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
  }

  if (switchAccountBtn) {
    switchAccountBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "profile.html?manual=1";
      } catch (error) {
        console.error("Switch account error:", error);
      }
    });
  }

  if (signUpBtn) {
    signUpBtn.addEventListener("click", async () => {
      const email = emailInput?.value.trim() || "";
      const password = passwordInput?.value.trim() || "";

      if (!email || !password) {
        if (loginMessage) {
          loginMessage.textContent = "Please enter both email and password.";
        }
        return;
      }

      if (password.length < 6) {
        if (loginMessage) {
          loginMessage.textContent = "Password must be at least 6 characters.";
        }
        return;
      }

      if (loginMessage) {
        loginMessage.textContent = "Creating account...";
      }

      try {
        await signOut(auth).catch(() => {});
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);
        await signOut(auth);

        if (loginMessage) {
          loginMessage.innerHTML =
            "Account created successfully.<br><br>Please verify your email before logging in.";
        }
      } catch (error) {
        console.error("Create account error:", error);

        if (loginMessage) {
          if (error.code === "auth/email-already-in-use") {
            loginMessage.textContent = "An account with this email already exists.";
          } else if (error.code === "auth/invalid-email") {
            loginMessage.textContent = "Please enter a valid email address.";
          } else if (error.code === "auth/weak-password") {
            loginMessage.textContent = "Password is too weak.";
          } else {
            loginMessage.textContent = error.message || "Could not create account.";
          }
        }
      }
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = emailInput?.value.trim() || "";
      const password = passwordInput?.value.trim() || "";

      if (!email || !password) {
        if (loginMessage) {
          loginMessage.textContent = "Please enter both email and password.";
        }
        return;
      }

      if (loginMessage) {
        loginMessage.textContent = "Logging in...";
      }

      try {
        await signOut(auth).catch(() => {});
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user && user.emailVerified === false) {
          await signOut(auth);
          if (loginMessage) {
            loginMessage.textContent = "Please verify your email before logging in.";
          }
          return;
        }

        if (loginMessage) {
          loginMessage.textContent = "Login successful.";
        }

        window.location.href = "app.html";
      } catch (error) {
        console.error("Login error:", error);
        if (loginMessage) {
          if (error.code === "auth/invalid-credential") {
            loginMessage.textContent = "Incorrect email or password.";
          } else {
            loginMessage.textContent = error.message || "Could not log in.";
          }
        }
      }
    });
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async () => {
      const email = emailInput?.value.trim() || "";

      if (!email) {
        if (loginMessage) {
          loginMessage.textContent = "Enter your email address first.";
        }
        return;
      }

      if (loginMessage) {
        loginMessage.textContent = "Sending password reset email...";
      }

      try {
        await sendPasswordResetEmail(auth, email, {
          url: `${window.location.origin}/profile.html?manual=1`
        });

        if (loginMessage) {
          loginMessage.innerHTML =
            "We have sent you a password reset email.<br><br>Please use the newest email if you requested more than one reset link.";
        }
      } catch (error) {
        console.error("Password reset error:", error);
        if (loginMessage) {
          loginMessage.textContent =
            error.message || "Could not send password reset email.";
        }
      }
    });
  }

  if (editDetailsBtn) {
    editDetailsBtn.addEventListener("click", () => {
      setProfileInputsDisabled(false);

      if (saveProfileDetailsBtn) {
        saveProfileDetailsBtn.classList.remove("hidden");
      }

      if (profileMessage) {
        profileMessage.textContent = "";
      }
    });
  }

  if (saveProfileDetailsBtn) {
    saveProfileDetailsBtn.addEventListener("click", async () => {
      if (auth.currentUser) {
        await saveProfileDetails(auth.currentUser);
      }
    });
  }

  if (deleteProfileBtn) {
    deleteProfileBtn.addEventListener("click", async () => {
      if (auth.currentUser) {
        await deleteProfile(auth.currentUser);
      }
    });
  }
}

// ===== AUTH STATE =====
function initAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (appPage) {
      appPage.classList.remove("hidden-until-ready");
      appPage.style.visibility = "visible";
    }

    if (isProfilePage) {
      if (profileAuthView) {
        profileAuthView.classList.remove("hidden");
      }

      if (user) {
        if (profileLoggedInView) {
          profileLoggedInView.classList.remove("hidden");
        }

        try {
          await loadProfile(user);
          await loadMyPolls(user);
        } catch (error) {
          console.error("Profile page auth error:", error);
        }
      } else {
        if (profileLoggedInView) {
          profileLoggedInView.classList.add("hidden");
        }
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
      hideVoteMessage();
      showPollsView();
      await loadPolls();
    }
  });
}

// ===== START APP =====
async function initApp() {
  try {
    await handleManualLoginMode();
    await handleEmailLinkSignIn();
  } catch (error) {
    console.error("Startup auth init error:", error);
  }

  try {
    initUi(loadPolls);
  } catch (error) {
    console.error("UI init error:", error);
  }

  try {
    initPollEvents();
  } catch (error) {
    console.error("Poll init error:", error);
  }

  try {
    initAuthButtons();
  } catch (error) {
    console.error("Auth button init error:", error);
  }

  try {
    initAuthState();
  } catch (error) {
    console.error("Auth state init error:", error);
  }
}

initApp();