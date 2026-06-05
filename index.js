
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

const db = admin.firestore();

const resendApiKey = defineSecret("RESEND_API_KEY");

exports.sendPollResultEmails = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: [resendApiKey]
  },
  async () => {
    const resend = new Resend(resendApiKey.value());
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("polls")
      .where("notifyCreatorByEmail", "==", true)
      .where("resultsEmailSent", "==", false)
      .where("closesAt", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("No poll result emails to send.");
      return;
    }

    for (const pollDoc of snapshot.docs) {
      const poll = pollDoc.data();

      if (!poll.creatorEmail) {
        await pollDoc.ref.update({ resultsEmailSent: true });
        continue;
      }

      const votes = poll.votes || {};
      const options = Array.isArray(poll.options) ? poll.options : [];

      let resultsText = "";

   const totalVotes = Object.values(votes).reduce(
  (sum, count) => sum + (typeof count === "number" ? count : 0),
  0
);

options.forEach((option) => {
  const count = typeof votes[option] === "number" ? votes[option] : 0;

  const percentage =
    totalVotes > 0
      ? Math.round((count / totalVotes) * 100)
      : 0;

  resultsText += `${option}: ${percentage}%\n`;
});

      const emailBody = `
Your Psephia poll has ended.

Poll:
${poll.question}

Results:
${resultsText}

View your polls here:
https://psephia.com/app.html

Thank you for using Psephia.
`;

      await resend.emails.send({
  from: "Psephia <noreply@psephia.com>",
  to: poll.creatorEmail,
  subject: "Your Psephia poll results are ready",
  text: emailBody
});

      await pollDoc.ref.update({
        resultsEmailSent: true,
        resultsEmailSentAt: admin.firestore.Timestamp.now()
      });

      console.log(`Email sent for poll ${pollDoc.id}`);
    }
  }
);
exports.deleteExpiredPolls = onSchedule(
  {
    schedule: "every 60 minutes"
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("polls")
      .where("deleteAfter", "<=", now)
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log("No expired polls to delete.");
      return;
    }

    const batch = db.batch();

    snapshot.docs.forEach((pollDoc) => {
      batch.delete(pollDoc.ref);
    });

    await batch.commit();

    console.log(`Deleted ${snapshot.size} expired polls.`);
  }
);