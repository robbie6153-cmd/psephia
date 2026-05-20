import { auth, db, analytics } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { logEvent } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";

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
  escapeHtml,
  pollSortSelect
} from "./ui.js";

let countdownInterval = null;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function trackEvent(eventName, eventData = {}) {
  try {
    if (!analytics) return;
    logEvent(analytics, eventName, eventData);
  } catch (error) {
    console.error(`Analytics error for ${eventName}:`, error);
  }
}

function getDateFromFirestoreValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getEndsAtDate(pollData) {
  return getDateFromFirestoreValue(pollData?.closesAt);
}

function getCreatedAtDate(pollData) {
  return getDateFromFirestoreValue(pollData?.createdAt);
}

function getResultsExpiryDate(pollData) {
  const createdAtDate = getCreatedAtDate(pollData);
  const endsAtDate = getEndsAtDate(pollData);

  if (!endsAtDate) return null;

  let openDurationMs = ONE_DAY_MS;

  if (createdAtDate) {
    openDurationMs = endsAtDate.getTime() - createdAtDate.getTime();
  } else if (pollData?.originalDurationDays) {
    openDurationMs = Number(pollData.originalDurationDays) * ONE_DAY_MS;
  }

  if (!openDurationMs || openDurationMs < ONE_DAY_MS) {
    openDurationMs = ONE_DAY_MS;
  }

  return new Date(endsAtDate.getTime() + openDurationMs);
}

function getNextEliminationDate(pollData) {
  return getDateFromFirestoreValue(pollData?.nextEliminationAt);
}

export function hasPollEnded(pollData) {
  const endsAtDate = getEndsAtDate(pollData);
  if (!endsAtDate) return false;
  return Date.now() >= endsAtDate.getTime();
}

function isEliminatorPoll(pollData) {
  return pollData?.isEliminator === true;
}

function getLowestVotedOption(options, votes) {
  let lowestOption = options[0];
  let lowestVotes = typeof votes[lowestOption] === "number" ? votes[lowestOption] : 0;

  options.forEach((option) => {
    const count = typeof votes[option] === "number" ? votes[option] : 0;

    if (count < lowestVotes) {
      lowestVotes = count;
      lowestOption = option;
    }
  });

  return lowestOption;
}

async function processEliminatorPollIfNeeded(pollId, pollData) {
  if (!isEliminatorPoll(pollData)) return pollData;

  let options = Array.isArray(pollData.options) ? [...pollData.options] : [];
  if (options.length <= 5) return pollData;

  const nextEliminationDate = getNextEliminationDate(pollData);
  if (!nextEliminationDate) return pollData;

  if (Date.now() < nextEliminationDate.getTime()) return pollData;

  const votes = pollData.votes && typeof pollData.votes === "object" ? pollData.votes : {};
  const eliminatedOption = getLowestVotedOption(options, votes);

  options = options.filter((option) => option !== eliminatedOption);

  const eliminatedOptions = Array.isArray(pollData.eliminatedOptions)
    ? [...pollData.eliminatedOptions, eliminatedOption]
    : [eliminatedOption];

  const now = new Date();

  const updateData = {
    options,
    votes: {},
    userVotes: {},
    votedBy: [],
    eliminatedOptions,
    lastEliminatedOption: eliminatedOption,
    lastEliminatedAt: Timestamp.fromDate(now)
  };

  if (options.length > 5) {
    const nextRoundDate = new Date(now.getTime() + ONE_DAY_MS);
    updateData.nextEliminationAt = Timestamp.fromDate(nextRoundDate);
    updateData.closesAt = Timestamp.fromDate(nextRoundDate);
    updateData.eliminatorStatus = "active";
  } else {
    const finalClosesAt = new Date(now.getTime() + ONE_DAY_MS);
    updateData.nextEliminationAt = null;
    updateData.closesAt = Timestamp.fromDate(finalClosesAt);
    updateData.eliminatorStatus = "final";
  }

  await updateDoc(doc(db, "polls", pollId), updateData);

  return {
    ...pollData,
    ...updateData,
    options,
    votes: {},
    userVotes: {},
    votedBy: []
  };
}

function getEliminatorInfoHtml(pollData) {
  if (!isEliminatorPoll(pollData)) return "";

  const options = Array.isArray(pollData.options) ? pollData.options : [];
  const eliminatedOptions = Array.isArray(pollData.eliminatedOptions) ? pollData.eliminatedOptions : [];

  let html = `<p class="poll-eliminator-note"><strong>Eliminator poll:</strong>`;

  if (options.length > 5) {
    html += ` The option with the fewest votes will be removed after this round, then voting will reopen.`;
  } else {
    html += ` This poll has reached the final 5 choices.`;
  }

  html += `</p>`;

  if (eliminatedOptions.length > 0) {
    html += `<p class="poll-eliminated">Eliminated so far: ${escapeHtml(eliminatedOptions.join(", "))}</p>`;
  }

  return html;
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

    trackEvent("signup_complete", {
      username_length: username.length,
      country: country
    });

    if (detailsMessage) detailsMessage.textContent = "Details saved.";
    showPollsView();
    await loadPolls();
  } catch (error) {
    console.error("Save details error:", error);
    if (detailsMessage) detailsMessage.textContent = "Could not save your details.";
  }
}

function getTotalVotes(pollData) {
  const votes = pollData.votes && typeof pollData.votes === "object" ? pollData.votes : {};
  return Object.values(votes).reduce((total, count) => {
    return total + (typeof count === "number" ? count : 0);
  }, 0);
}

function sortPollDocs(pollDocs, currentUid) {
  const sortValue = pollSortSelect?.value || "longest";

  return pollDocs.sort((a, b) => {
    const pollA = a.data;
    const pollB = b.data;

    const endsA = getEndsAtDate(pollA)?.getTime() || 0;
    const endsB = getEndsAtDate(pollB)?.getTime() || 0;

    const votedA = currentUid && pollA.userVotes && pollA.userVotes[currentUid] ? 1 : 0;
    const votedB = currentUid && pollB.userVotes && pollB.userVotes[currentUid] ? 1 : 0;

    const totalA = getTotalVotes(pollA);
    const totalB = getTotalVotes(pollB);

    if (sortValue === "longest") return endsB - endsA;
    if (sortValue === "shortest") return endsA - endsB;
    if (sortValue === "voted") return votedB - votedA;
    if (sortValue === "not-voted") return votedA - votedB;
    if (sortValue === "popular") return totalB - totalA;

    return 0;
  });
}

export async function loadPolls() {
  if (!pollsDiv) return;

  try {
    const snap = await getDocs(query(
      collection(db, "polls"),
      orderBy("createdAt", "desc"),
      limit(30)
    ));

    pollsDiv.innerHTML = "";

    if (snap.empty) {
      pollsDiv.innerHTML = "<p>No polls yet.</p>";
      return;
    }

    const currentUid = auth.currentUser?.uid || null;
    const now = new Date();
    let hasVisiblePolls = false;

    const processedPollDocs = [];

    for (const docItem of snap.docs) {
      const p = docItem.data();

      processedPollDocs.push({
        id: docItem.id,
        data: p
      });
    }

    const sortedPollDocs = sortPollDocs(processedPollDocs, currentUid);

    for (const docItem of sortedPollDocs) {
      let p = docItem.data;

      if ((p.category || "Politics") !== getSelectedCategory()) continue;

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
          const resultsExpiryDate = getResultsExpiryDate(p);
          showThisPoll = resultsExpiryDate && now.getTime() < resultsExpiryDate.getTime();
        }
      }

      if (!showThisPoll) continue;

      hasVisiblePolls = true;

      let timerHtml = "";

      if (getCurrentPollView() === "open") {
        timerHtml = endsAtDate
          ? `<p class="poll-timer" data-end-time="${endsAtDate.getTime()}" data-timer-type="open">${escapeHtml(formatTimeRemainingFromMs(endsAtDate.getTime() - Date.now()))}</p>`
          : `<p class="poll-timer">No end time set</p>`;
      }

      if (getCurrentPollView() === "results" && endsAtDate) {
        const resultsExpiryDate = getResultsExpiryDate(p);
        timerHtml = resultsExpiryDate
          ? `<p class="poll-timer" data-end-time="${resultsExpiryDate.getTime()}" data-timer-type="results">Results disappear in ${escapeHtml(getTimeRemainingText(resultsExpiryDate))}</p>`
          : "";
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
          ${getEliminatorInfoHtml(p)}
          ${timerHtml}
          ${contentHtml}
        </div>
      `;
    }

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

    let selectedPoll = pollSnap.data();
    selectedPoll = await processEliminatorPollIfNeeded(pollId, selectedPoll);

    if (hasPollEnded(selectedPoll)) {
      showVoteMessage("Voting on this poll has ended.", true);
      await loadPolls();
      return;
    }

    const currentOptions = Array.isArray(selectedPoll.options) ? selectedPoll.options : [];
    if (!currentOptions.includes(option)) {
      showVoteMessage("This option is no longer available.", true);
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

    trackEvent("vote_submitted", {
      poll_id: pollId,
      category: selectedPoll.category || "Unknown",
      option_text_length: option.length,
      option_count: currentOptions.length
    });

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

    const processedDocs = [];

    for (const pollDoc of snap.docs) {
      const poll = pollDoc.data();
      processedDocs.push({ pollDoc, poll });
    }

    const myDocs = processedDocs.filter(({ poll }) => {
      return poll.createdByUid === user.uid && !hasPollEnded(poll);
    });

    if (myDocs.length === 0) {
      myPollsList.innerHTML = "<p>You have no active polls.</p>";
      return;
    }

    myDocs.forEach(({ pollDoc, poll }) => {
      const pollId = pollDoc.id;

      const pollEl = document.createElement("div");
      pollEl.className = "my-poll-card";

      pollEl.innerHTML = `
        <div class="my-poll-top">
          <div>
            <h3>${escapeHtml(poll.question || "Untitled poll")}</h3>
            <p><strong>Category:</strong> ${escapeHtml(poll.category || "Other")}</p>
            ${isEliminatorPoll(poll) ? `<p><strong>Type:</strong> Eliminator poll</p>` : ""}
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

      const isEliminator = options.length > 5;

      if (isEliminator) {
        alert("Polls with more than 5 choices will be eliminator polls, where the one with the fewest votes will be removed after 24 hours and the poll reopened.");
      }

      try {
        const createdAt = new Date();

        const firstClosesAt = isEliminator
          ? new Date(createdAt.getTime() + ONE_DAY_MS)
          : new Date(createdAt.getTime() + durationDays * ONE_DAY_MS);

        const user = auth.currentUser;

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
          alert("Please complete your profile details before creating a poll.");
          showUserDetailsView();
          return;
        }

        const creatorData = userDoc.data();

        const wantsEmailNotification = confirm(
          "Do you wish to be notified by email of your poll results?"
        );

        const pollData = {
          question,
          category,
          options,
          createdAt: Timestamp.fromDate(createdAt),
          closesAt: Timestamp.fromDate(firstClosesAt),
          createdBy: creatorData.username || "Anonymous",
          createdByUid: user.uid,
          votes: {},
          userVotes: {},
          votedBy: [],
          isEliminator,
          eliminatorStatus: isEliminator ? "active" : "none",
          eliminatedOptions: [],
          originalDurationDays: durationDays,
          notifyCreatorByEmail: wantsEmailNotification,
          creatorEmail: user.email || "",
          resultsEmailSent: false
        };

        if (isEliminator) {
          pollData.nextEliminationAt = Timestamp.fromDate(firstClosesAt);
        }

        const newPollRef = await addDoc(collection(db, "polls"), pollData);

        trackEvent("poll_created", {
          poll_id: newPollRef.id,
          category: category,
          option_count: options.length,
          duration_days: durationDays,
          is_eliminator: isEliminator
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
      hideVoteMessage();
      await voteOnPoll(pollId, option);
    });
  }
}