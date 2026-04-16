import { auth, db } from "./firebase.js";
import {
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

import {
  pollsDiv,
  submitPollBtn,
  pollQuestion,
  pollCategory,
  pollDuration,
  extraOptions,
  firstNameInput,
  lastNameInput,
  countryInput,
  usernameInput,
  detailsMessage,
  saveDetailsBtn,
  myPollsList,
  deleteProfileMessage,
  getSelectedCategory,
  getCurrentPollView,
  resetOptionCount,
  showPollsView,
  showUserDetailsView,
  showVoteMessage,
  hideVoteMessage,
  escapeHtml
} from "./ui.js";

let countdownInterval = null;

export function getEndsAtDate(pollData) {
  if (!pollData?.closesAt) return null;
  if (typeof pollData.closesAt.toDate === "function") return pollData.closesAt.toDate();
  const date = new Date(pollData.closesAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasPollEnded(pollData) {
  const endsAtDate = getEndsAtDate(pollData);
  if (!endsAtDate) return false;
  return Date.now() >= endsAtDate.getTime();
}

export function formatTimeRemainingFromMs(ms) {
  if (ms <= 0) return "Voting has ended";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `Voting on this ends in ${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} minute${minutes !== 1 ? "s" : ""} and ${seconds} second${seconds !== 1 ? "s" : ""}`;
}

export function getTimeRemainingText(targetDate) {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "0 minutes";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds`;
}

export function getPollResultsHtml(pollData) {
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

export function startCountdownUpdater() {
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

export async function saveUserDetails() {
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

export async function loadPolls() {
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

      if ((p.category || "Politics") !== getSelectedCategory()) return;

      const options = Array.isArray(p.options) ? p.options : [];
      const selectedOption =
        currentUid && p.userVotes && typeof p.userVotes === "object"
          ? p.userVotes[currentUid] || null
          : null;

      const endsAtDate = getEndsAtDate(p);
      const pollEnded = hasPollEnded(p);

      let showThisPoll = false;

      if (getCurrentPollView() === "open") {
        showThisPoll = !pollEnded;
      } else if (getCurrentPollView() === "results") {
        if (pollEnded && endsAtDate) {
          const resultsExpiryTime = endsAtDate.getTime() + 24 * 60 * 60 * 1000;
          showThisPoll = now.getTime() < resultsExpiryTime;
        }
      }

      if (!showThisPoll) return;

      hasVisiblePolls = true;

      let timerHtml = "";

      if (getCurrentPollView() === "open") {
        timerHtml = endsAtDate
          ? `<p class="poll-timer" data-end-time="${endsAtDate.getTime()}" data-timer-type="open">${escapeHtml(formatTimeRemainingFromMs(endsAtDate.getTime() - Date.now()))}</p>`
          : `<p class="poll-timer">No end time set</p>`;
      }

      if (getCurrentPollView() === "results" && endsAtDate) {
        const resultsExpiryDate = new Date(endsAtDate.getTime() + 24 * 60 * 60 * 1000);
        timerHtml = `<p class="poll-timer" data-end-time="${resultsExpiryDate.getTime()}" data-timer-type="results">Results disappear in ${escapeHtml(getTimeRemainingText(resultsExpiryDate))}</p>`;
      }

      let contentHtml = "";

      if (getCurrentPollView() === "results") {
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
      pollsDiv.innerHTML = getCurrentPollView() === "open"
        ? "<p>No open polls in this category yet.</p>"
        : "<p>No recent results in this category yet.</p>";
    }

    startCountdownUpdater();
  } catch (error) {
    console.error("Load polls error:", error);
    pollsDiv.innerHTML = "<p>Could not load polls.</p>";
  }
}

export async function voteOnPoll(pollId, option) {
  const user = auth.currentUser;

  if (!user) {
    showVoteMessage("You must be signed in to vote.", true);
    return;
  }

  try {
    await user.reload();

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

export async function loadMyPolls(user) {
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

export function attachMyPollMenuEvents() {
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

export async function deleteProfilePollData(user) {
  if (!user) return false;

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

    return true;
  } catch (error) {
    console.error("Delete profile poll data error:", error);
    if (deleteProfileMessage) {
      deleteProfileMessage.textContent = "Could not delete profile data.";
    }
    return false;
  }
}

export function initPollEvents() {
  if (saveDetailsBtn) {
    saveDetailsBtn.addEventListener("click", saveUserDetails);
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
        resetOptionCount();

        hideVoteMessage();
        showPollsView();
        await loadPolls();
      } catch (error) {
        console.error("Error creating poll:", error);
        alert("There was a problem creating the poll.");
      }
    });
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
}