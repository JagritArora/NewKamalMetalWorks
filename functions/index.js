const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

initializeApp();

// Set once via: firebase functions:secrets:set TITAN_EMAIL_PASSWORD
// (paste contact@newkamalmetalworks.co.in's mailbox password when prompted
// -- Secret Manager stores it, this repo never does).
const titanEmailPassword = defineSecret("TITAN_EMAIL_PASSWORD");

// billing.html writes a doc to the "mail" collection shaped like
// { to: [...emails], message: { subject, html, attachments } } -- this is
// the replacement for the (now-deprecated, shutting down March 2027)
// "Trigger Email from Firestore" extension, kept doc-triggered so
// billing.html didn't need to change at all.
exports.sendMail = onDocumentCreated(
  { document: "mail/{mailId}", secrets: [titanEmailPassword], region: "asia-south1" },
  async function (event) {
    var snap = event.data;
    if (!snap) return;
    var data = snap.data();
    var message = data.message || {};

    var transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      auth: {
        user: "contact@newkamalmetalworks.co.in",
        pass: titanEmailPassword.value()
      }
    });

    try {
      await transporter.sendMail({
        from: "New Kamal Metal Works <contact@newkamalmetalworks.co.in>",
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

// Rate-card verification -- Save on the rate-card editor (billing.html)
// is gated behind a 6-digit code emailed to the signed-in master account.
// The code and its "verified" state live only here, written via the Admin
// SDK, which bypasses firestore.rules entirely -- clients can neither read
// nor write the rateCardVerify collection directly (see firestore.rules),
// so this check can't be short-circuited from devtools the way a purely
// client-side confirmation could be.
const RATE_CARD_CODE_TTL_MS = 10 * 60 * 1000; // how long an emailed code stays usable
const RATE_CARD_VERIFIED_TTL_MS = 5 * 60 * 1000; // how long a verified save-window stays open
const RATE_CARD_MAX_ATTEMPTS = 5;

function hashRateCardCode(code, uid) {
  return crypto.createHash("sha256").update(code + ":" + uid).digest("hex");
}

async function requireMasterWithEmail(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  var db = getFirestore();
  var profileSnap = await db.collection("profiles").doc(request.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== "master") {
    throw new HttpsError("permission-denied", "Master accounts only.");
  }
  var email = profileSnap.data().email || request.auth.token.email;
  if (!email) throw new HttpsError("failed-precondition", "No email on file for this account.");
  return { uid: request.auth.uid, email: email };
}

exports.requestRateCardCode = onCall(
  { region: "asia-south1" },
  async function (request) {
    var master = await requireMasterWithEmail(request);
    var db = getFirestore();
    var code = ("" + crypto.randomInt(0, 1000000)).padStart(6, "0");

    await db.collection("rateCardVerify").doc(master.uid).set({
      codeHash: hashRateCardCode(code, master.uid),
      sentAt: new Date(),
      attempts: 0,
      verifiedUntil: null
    });

    await db.collection("mail").add({
      to: [master.email],
      message: {
        subject: "Your rate-card verification code",
        html:
          "<p>Use this code to confirm the rate-card change you're about to make on the New Kamal Metal " +
          "Works billing tool:</p>" +
          "<p style=\"font-size:28px;font-weight:700;letter-spacing:4px;\">" + code + "</p>" +
          "<p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>"
      }
    });

    return { ok: true };
  }
);

exports.verifyRateCardCode = onCall(
  { region: "asia-south1" },
  async function (request) {
    var master = await requireMasterWithEmail(request);
    var code = ((request.data && request.data.code) || "").trim();
    if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the 6-digit code.");

    var db = getFirestore();
    var ref = db.collection("rateCardVerify").doc(master.uid);
    var snap = await ref.get();
    if (!snap.exists) throw new HttpsError("failed-precondition", "Request a code first.");
    var data = snap.data();

    var sentAt = data.sentAt && data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
    if (Date.now() - sentAt.getTime() > RATE_CARD_CODE_TTL_MS) {
      throw new HttpsError("deadline-exceeded", "That code expired -- request a new one.");
    }
    if ((data.attempts || 0) >= RATE_CARD_MAX_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "Too many attempts -- request a new code.");
    }

    if (hashRateCardCode(code, master.uid) !== data.codeHash) {
      await ref.update({ attempts: (data.attempts || 0) + 1 });
      throw new HttpsError("permission-denied", "That code isn't right.");
    }

    await ref.update({
      verifiedUntil: new Date(Date.now() + RATE_CARD_VERIFIED_TTL_MS),
      attempts: 0
    });
    return { ok: true };
  }
);

// GenAI billing assistant -- a master-only chat bot (Google Gemini, free
// tier) that can look up buyers/rate-cards/invoices and prepare a draft
// invoice for review. It never writes an invoice itself: propose_invoice
// only validates buyer/parts and returns numbers for the browser to show as
// a live preview on billing.html (same DOM the manual form uses), and
// confirm_generate just signals the browser to run that page's existing,
// pixel-exact PDF + Firestore generation flow -- so a bot-produced invoice
// is byte-for-byte the same code path as a manually-typed one.
// Set once via: firebase functions:secrets:set GEMINI_API_KEY
// (get a free key at https://aistudio.google.com/apikey)
const geminiApiKey = defineSecret("GEMINI_API_KEY");

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";

const BOT_SYSTEM_INSTRUCTION =
  "You are the billing assistant for New Kamal Metal Works, a metal parts manufacturer, used only by " +
  "the owner (master account). You help look up buyers, rate cards and past invoices, and prepare new " +
  "invoices. Always call list_buyers before propose_invoice. If there is exactly one buyer on file, use " +
  "it automatically without asking which buyer -- only ask when there's more than one and it's genuinely " +
  "ambiguous. Always call list_parts for the buyer to resolve part numbers -- never guess a rate. The " +
  "owner often pastes shorthand like \"329-461-37=4000\" or \"329-084 2500\" -- read the number after a " +
  "part number as that line's quantity, and match part numbers loosely (typos, a letter for a digit like " +
  "'o' for '0', missing dashes) against the real part numbers from list_parts, picking the closest match. " +
  "Always call propose_invoice before an invoice is generated, so the owner can see a preview on screen. " +
  "The app itself renders the proposed items as a table right under your reply, so do NOT also write out " +
  "a markdown table -- just a short line or two confirming the buyer and item count, then explicitly ask " +
  "the owner to confirm before you generate it. Only call confirm_generate after the owner has explicitly " +
  "confirmed (e.g. said \"yes\", \"generate it\", \"go ahead\") on a draft you already showed them this " +
  "way -- never call it unprompted, and never claim an invoice has been generated yourself, since the " +
  "browser performs the actual generation after confirm_generate. Keep replies concise.";

const BOT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "list_buyers",
        description: "List all buyers (customers) on file, with their id and name."
      },
      {
        name: "list_parts",
        description: "List the rate-card parts for a given buyer: part number, description, HSN code and rate.",
        parameters: {
          type: "OBJECT",
          properties: { buyerId: { type: "STRING", description: "Buyer document id, from list_buyers." } },
          required: ["buyerId"]
        }
      },
      {
        name: "recent_invoices",
        description: "List the most recently generated invoices.",
        parameters: {
          type: "OBJECT",
          properties: { limitCount: { type: "NUMBER", description: "Max invoices to return, default 10." } }
        }
      },
      {
        name: "lookup_invoice",
        description: "Look up one invoice by its invoice number.",
        parameters: {
          type: "OBJECT",
          properties: { invoiceNo: { type: "STRING" } },
          required: ["invoiceNo"]
        }
      },
      {
        name: "propose_invoice",
        description:
          "Validate a draft invoice and return it as a preview for the owner to review. Does NOT create " +
          "the invoice -- only checks the buyer/parts exist and computes totals.",
        parameters: {
          type: "OBJECT",
          properties: {
            buyerId: { type: "STRING" },
            vehicleNo: { type: "STRING" },
            poNo: { type: "STRING" },
            scheduleNo: { type: "STRING" },
            ewayBillNo: { type: "STRING" },
            termsOfDelivery: { type: "STRING" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { partNo: { type: "STRING" }, qty: { type: "NUMBER" } },
                required: ["partNo", "qty"]
              }
            }
          },
          required: ["buyerId", "items"]
        }
      },
      {
        name: "confirm_generate",
        description:
          "Signal that the owner confirmed the last propose_invoice draft should now actually be " +
          "generated. Call this only right after an explicit yes/confirm from the owner."
      }
    ]
  }
];

async function runBotTool(name, args) {
  var db = getFirestore();

  // Gemini's functionResponse.response field must be a JSON object, not a
  // bare array -- list-shaped results are wrapped under "items".
  if (name === "list_buyers") {
    var buyersSnap = await db.collection("buyers").get();
    return { items: buyersSnap.docs.map(function (d) { return { id: d.id, name: d.data().name }; }) };
  }

  if (name === "list_parts") {
    var partsSnap = await db.collection("buyers").doc(args.buyerId).collection("parts").get();
    return {
      items: partsSnap.docs.map(function (d) {
        var p = d.data();
        return { partNo: d.id, description: p.description, hsn: p.hsn, rate: p.rate, poNo: p.poNo || "" };
      })
    };
  }

  if (name === "recent_invoices") {
    var invSnap = await db.collection("invoices").orderBy("createdAt", "desc").limit(args.limitCount || 10).get();
    return {
      items: invSnap.docs.map(function (d) {
        var inv = d.data();
        return { invoiceNo: inv.invoiceNo, date: inv.date, buyer: inv.buyer && inv.buyer.name, net: inv.net, status: inv.status };
      })
    };
  }

  if (name === "lookup_invoice") {
    var q = await db.collection("invoices").where("invoiceNo", "==", args.invoiceNo).limit(1).get();
    if (q.empty) return { found: false };
    var found = q.docs[0].data();
    return {
      found: true,
      invoiceNo: found.invoiceNo,
      date: found.date,
      buyer: found.buyer && found.buyer.name,
      net: found.net,
      status: found.status
    };
  }

  if (name === "propose_invoice") {
    var buyerSnap = await db.collection("buyers").doc(args.buyerId).get();
    if (!buyerSnap.exists) {
      return { ok: false, error: "Unknown buyerId \"" + args.buyerId + "\" -- call list_buyers first." };
    }
    var buyer = buyerSnap.data();
    var items = [];
    var suppliedItems = args.items || [];
    for (var i = 0; i < suppliedItems.length; i++) {
      var wanted = suppliedItems[i];
      var partSnap = await db.collection("buyers").doc(args.buyerId).collection("parts").doc(wanted.partNo).get();
      if (!partSnap.exists) {
        return { ok: false, error: "Unknown part \"" + wanted.partNo + "\" for this buyer -- call list_parts first." };
      }
      var part = partSnap.data();
      items.push({
        partNo: wanted.partNo,
        qty: wanted.qty,
        description: part.description,
        hsn: part.hsn,
        poNo: part.poNo || "",
        rate: part.rate,
        amount: wanted.qty * part.rate
      });
    }
    if (!items.length) return { ok: false, error: "No valid items given." };
    var subtotal = items.reduce(function (sum, it) { return sum + it.amount; }, 0);
    var igst = subtotal * 0.18;

    // If the owner didn't give a PO explicitly, fall back to whichever PO
    // numbers are on file for these items' rate-card entries -- joined,
    // in case the items span more than one PO.
    var draftPoNo = args.poNo || "";
    if (!draftPoNo) {
      var seenPo = {};
      var itemPos = [];
      items.forEach(function (it) {
        if (it.poNo && !seenPo[it.poNo]) { seenPo[it.poNo] = true; itemPos.push(it.poNo); }
      });
      draftPoNo = itemPos.join(", ");
    }

    return {
      ok: true,
      draft: {
        buyerId: args.buyerId,
        buyerName: buyer.name,
        vehicleNo: args.vehicleNo || "",
        poNo: draftPoNo,
        scheduleNo: args.scheduleNo || "",
        ewayBillNo: args.ewayBillNo || "",
        termsOfDelivery: args.termsOfDelivery || "",
        items: items,
        subtotal: subtotal,
        igst: igst,
        net: subtotal + igst
      }
    };
  }

  if (name === "confirm_generate") return { ok: true };

  return { error: "Unknown tool \"" + name + "\"." };
}

exports.chatWithBot = onCall(
  { secrets: [geminiApiKey], region: "asia-south1" },
  async function (request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");

    var db = getFirestore();
    var profileSnap = await db.collection("profiles").doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data().role !== "master") {
      throw new HttpsError("permission-denied", "This assistant is only available to master accounts.");
    }

    var message = ((request.data && request.data.message) || "").trim();
    if (!message) throw new HttpsError("invalid-argument", "Empty message.");
    var history = (request.data && request.data.history) || [];
    var pendingDraft = request.data && request.data.pendingDraft;

    var contents = history.map(function (turn) {
      return { role: turn.role === "bot" ? "model" : "user", parts: [{ text: turn.text }] };
    });

    // Re-inject the last shown draft as a synthetic prior tool call/response
    // so Gemini still has the structured numbers in context on the follow-up
    // turn where the owner just says "yes, generate it" -- the plain-text
    // history alone wouldn't carry that back.
    if (pendingDraft) {
      contents.push({
        role: "model",
        parts: [{ functionCall: { name: "propose_invoice", args: { buyerId: pendingDraft.buyerId, items: pendingDraft.items } } }]
      });
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: "propose_invoice", response: { ok: true, draft: pendingDraft } } }]
      });
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    var draft = pendingDraft || null;
    var action = null;
    var finalText = "";

    for (var turn = 0; turn < 6; turn++) {
      var resp = await fetch(GEMINI_URL + "?key=" + geminiApiKey.value(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contents,
          tools: BOT_TOOLS,
          systemInstruction: { parts: [{ text: BOT_SYSTEM_INSTRUCTION }] }
        })
      });

      if (!resp.ok) {
        var errBody = await resp.text();
        console.error("Gemini error", resp.status, errBody);
        throw new HttpsError("internal", "Gemini " + resp.status + ": " + errBody.slice(0, 300));
      }

      var data = await resp.json();
      var candidate = data.candidates && data.candidates[0];
      var parts = (candidate && candidate.content && candidate.content.parts) || [];
      var functionCalls = parts.filter(function (p) { return p.functionCall; });

      if (!functionCalls.length) {
        finalText = parts.map(function (p) { return p.text || ""; }).join("");
        break;
      }

      contents.push({ role: "model", parts: parts });

      var responseParts = [];
      for (var i = 0; i < functionCalls.length; i++) {
        var call = functionCalls[i].functionCall;
        var result;
        try {
          result = await runBotTool(call.name, call.args || {});
        } catch (toolErr) {
          console.error("Tool error", call.name, toolErr);
          throw new HttpsError("internal", "Tool " + call.name + " failed: " + String((toolErr && toolErr.message) || toolErr));
        }
        if (call.name === "propose_invoice" && result && result.ok) draft = result.draft;
        if (call.name === "confirm_generate" && result && result.ok) action = "generate";
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return { reply: finalText || "Done.", draft: draft, action: action };
  }
);
