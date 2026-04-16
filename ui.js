import { auth } from "./firebase.js";

export const isProfilePage = window.location.pathname.endsWith("profile.html");

// ===== COMMON =====
export const appPage = document.querySelector(".app-page");

// ===== APP PAGE ELEMENTS =====
export const pollsView = document.getElementById("pollsView");
export const createPollView = document.getElementById("createPollView");
export const openCreatePollBtn = document.getElementById("openCreatePollBtn");
export const cancelCreatePollBtn = document.getElementById("cancelCreatePollBtn");
export const submitPollBtn = document.getElementById("submitPollBtn");

export const userDetailsView = document.getElementById("userDetailsView");
export const firstNameInput = document.getElementById("firstName");
export const lastNameInput = document.getElementById("lastName");
export const countryInput = document.getElementById("country");
export const usernameInput = document.getElementById("username");
export const saveDetailsBtn = document.getElementById("saveDetailsBtn");
export const detailsMessage = document.getElementById("detailsMessage");

export const voteMessage = document.getElementById("voteMessage");
export const voteMessageText = document.getElementById("voteMessageText");
export const closeVoteMessageBtn = document.getElementById("closeVoteMessageBtn");

export const pollQuestion = document.getElementById("pollQuestion");
export const pollCategory = document.getElementById("createPollCategory");
export const pollDuration = document.getElementById("pollDuration");
export const addOptionBtn = document.getElementById("addOptionBtn");
export const extraOptions = document.getElementById("extraOptions");

export const pollsDiv = document.getElementById("polls");
export const pollsCard = document.getElementById("pollsCard");
export const categoryTabs = document.querySelectorAll(".category-tab[data-category]");
export const openPollsTab = document.getElementById("openPollsTab");
export const resultsPollsTab = document.getElementById("resultsPollsTab");

// ===== PROFILE PAGE ELEMENTS =====
export const profileAuthView = document.getElementById("profileAuthView");
export const profileLoggedInView = document.getElementById("profileLoggedInView");

export const emailInput = document.getElementById("email");
export const passwordInput = document.getElementById("password");
export const signUpBtn = document.getElementById("signUpBtn");
export const loginBtn = document.getElementById("loginBtn");
export const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
export const switchAccountBtn = document.getElementById("switchAccountBtn");
export const logoutBtn = document.getElementById("logoutBtn");
export const loginMessage = document.getElementById("loginMessage");

export const profileFirstName = document.getElementById("profileFirstName");
export const profileLastName = document.getElementById("profileLastName");
export const profileCountry = document.getElementById("profileCountry");
export const profileUsername = document.getElementById("profileUsername");
export const editDetailsBtn = document.getElementById("editDetailsBtn");
export const saveProfileDetailsBtn = document.getElementById("saveProfileDetailsBtn");
export const profileMessage = document.getElementById("profileMessage");
export const myPollsList = document.getElementById("myPollsList");
export const deleteProfileBtn = document.getElementById("deleteProfileBtn");
export const deleteProfileMessage = document.getElementById("deleteProfileMessage");

// ===== STATE =====
let selectedCategory = "Politics";
let currentPollView = "open";
let optionCount = 2;

export function getSelectedCategory() {
  return selectedCategory;
}

export function setSelectedCategory(category) {
  selectedCategory = category;
}

export function getCurrentPollView() {
  return currentPollView;
}

export function setCurrentPollView(view) {
  currentPollView = view;

  if (pollsCard) {
    pollsCard.classList.toggle("mode-open", view === "open");
    pollsCard.classList.toggle("mode-results", view === "results");
  }

  if (openPollsTab) openPollsTab.classList.toggle("active", view === "open");
  if (resultsPollsTab) resultsPollsTab.classList.toggle("active", view === "results");
}

export function resetOptionCount() {
  optionCount = 2;
}

export function incrementOptionCount() {
  if (optionCount >= 5) return optionCount;
  optionCount += 1;
  return optionCount;
}

export function getOptionCount() {
  return optionCount;
}

// ===== MENU =====
export function closeMenu() {
  const menu = document.getElementById("dropdownMenu");
  if (menu) menu.classList.remove("show");
}

export function toggleMenu() {
  const menu = document.getElementById("dropdownMenu");
  if (menu) menu.classList.toggle("show");
}

export function initMenu() {
  window.closeMenu = closeMenu;
  window.toggleMenu = toggleMenu;

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("dropdownMenu");
    const topBar = document.querySelector(".top-bar");
    if (menu && topBar && !topBar.contains(event.target)) {
      menu.classList.remove("show");
    }
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".poll-menu-dropdown.show").forEach((menu) => {
      menu.classList.remove("show");
    });
  });
}

// ===== APP VIEW HELPERS =====
export function showPollsView() {
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

export function showCreatePollView() {
  if (!auth.currentUser) {
    alert("You must be logged in to create a poll.");
    return false;
  }

  if (userDetailsView) userDetailsView.classList.add("hidden");
  if (pollsView) pollsView.classList.add("hidden");
  if (createPollView) createPollView.classList.remove("hidden");
  if (openCreatePollBtn) openCreatePollBtn.classList.add("hidden");
  return true;
}

export function showUserDetailsView() {
  if (pollsView) pollsView.classList.add("hidden");
  if (createPollView) createPollView.classList.add("hidden");
  if (openCreatePollBtn) openCreatePollBtn.classList.add("hidden");
  if (userDetailsView) userDetailsView.classList.remove("hidden");
}

// ===== HELPERS =====
export function showVoteMessage(message, isError = false) {
  if (!voteMessage) return;

  if (voteMessageText) {
    voteMessageText.textContent = message;
  } else {
    voteMessage.textContent = message;
  }

  voteMessage.style.display = "block";
  voteMessage.style.background = isError ? "#fff3f3" : "#f3fff5";
  voteMessage.style.color = isError ? "#b00020" : "#146c2e";
  voteMessage.style.border = isError ? "1px solid #e0b4b4" : "1px solid #b7dfc1";
}

export function hideVoteMessage() {
  if (!voteMessage) return;

  voteMessage.style.display = "none";

  if (voteMessageText) {
    voteMessageText.textContent = "";
  } else {
    voteMessage.textContent = "";
  }
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// ===== PROFILE HELPERS =====
export function setProfileInputsDisabled(disabled) {
  if (!profileFirstName) return;
  profileFirstName.disabled = disabled;
  profileLastName.disabled = disabled;
  profileCountry.disabled = disabled;
  profileUsername.disabled = disabled;
}

// ===== INIT =====
export function initUi(loadPollsCallback) {
  initMenu();

  if (closeVoteMessageBtn) {
    closeVoteMessageBtn.addEventListener("click", () => {
      hideVoteMessage();
    });
  }

  if (openPollsTab) {
    openPollsTab.addEventListener("click", () => {
      hideVoteMessage();
      setCurrentPollView("open");
      loadPollsCallback();
    });
  }

  if (resultsPollsTab) {
    resultsPollsTab.addEventListener("click", () => {
      hideVoteMessage();
      setCurrentPollView("results");
      loadPollsCallback();
    });
  }

  if (openCreatePollBtn) {
    openCreatePollBtn.addEventListener("click", () => {
      hideVoteMessage();
      showCreatePollView();
    });
  }

  if (cancelCreatePollBtn) {
    cancelCreatePollBtn.addEventListener("click", () => {
      hideVoteMessage();
      showPollsView();
    });
  }

  if (addOptionBtn) {
    addOptionBtn.addEventListener("click", () => {
      if (!extraOptions || getOptionCount() >= 5) return;

      const nextOptionNumber = incrementOptionCount();

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Option ${nextOptionNumber}`;
      input.className = "poll-option";
      extraOptions.appendChild(input);
    });
  }

  categoryTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      hideVoteMessage();
      setSelectedCategory(tab.dataset.category || "Politics");
      categoryTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadPollsCallback();
    });
  });
}