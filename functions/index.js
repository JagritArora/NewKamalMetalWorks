const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const nodemailer = require("nodemailer");

initializeApp();

// Set once via: firebase functions:secrets:set GMAIL_APP_PASSWORD
// (paste the 16-character App Password from the project's local .env file
// when prompted -- Secret Manager stores it, this repo never does).
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// billing.html writes a doc to the "mail" collection shaped like
// { to: [...emails], message: { subject, html, attachments } } -- this is
// the replacement for the (now-deprecated, shutting down March 2027)
// "Trigger Email from Firestore" extension, kept doc-triggered so
// billing.html didn't need to change at all.
exports.sendMail = onDocumentCreated(
  { document: "mail/{mailId}", secrets: [gmailAppPassword], region: "asia-south1" },
  async function (event) {
    var snap = event.data;
    if (!snap) return;
    var data = snap.data();
    var message = data.message || {};

    var transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "kamal.jagrit93@gmail.com",
        pass: gmailAppPassword.value()
      }
    });

    try {
      await transporter.sendMail({
        from: "New Kamal Metal Works <kamal.jagrit93@gmail.com>",
        to: data.to,
        subject: message.subject,
        html: message.html,
        attachments: message.attachments
      });
      await snap.ref.set(
        { delivery: { state: "SUCCESS", endTime: new Date().toISOString() } },
        { merge: true }
      );
    } catch (err) {
      await snap.ref.set(
        {
          delivery: {
            state: "ERROR",
            error: String((err && err.message) || err),
            endTime: new Date().toISOString()
          }
        },
        { merge: true }
      );
      throw err;
    }
  }
);
