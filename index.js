const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const db = admin.firestore();

const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");

exports.sendPollResultEmails = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: [emailUser, emailPass]
  },
  async () => {
    const transporter = nodemailer.createTransport({
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser.value(),
        pass: emailPass.value()
      }
    });

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

      options.forEach((option) => {
        const count = typeof votes[option] === "number" ? votes[option] : 0;
        resultsText += `${option}: ${count} vote${count === 1 ? "" : "s"}\n`;
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

      await transporter.sendMail({
        from: '"Psephia" <robtechuk@hotmail.com>',
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