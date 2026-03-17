/**
 * Send Assignment Email — Cloud Function (v1 Firestore Trigger)
 * ─────────────────────────────────────────────────────────────
 * Listens for new documents in `mail_queue` collection.
 * Sends email via Gmail SMTP using Nodemailer.
 * Updates document status to 'sent' or 'error'.
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// SMTP config from environment variables (set in functions/.env)
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "sUPerStudy";

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: SMTP_EMAIL,
                pass: SMTP_PASSWORD,
            },
        });
    }
    return transporter;
}

exports.processMailQueue = functions
    .region("asia-southeast1")
    .firestore.document("mail_queue/{docId}")
    .onCreate(async (snap, context) => {
        const mailData = snap.data();

        if (!mailData.to || !mailData.subject) {
            console.error("Missing required fields (to, subject)");
            await snap.ref.update({ status: "error", error: "Missing to or subject", processedAt: admin.firestore.FieldValue.serverTimestamp() });
            return;
        }

        try {
            const transport = getTransporter();

            await transport.sendMail({
                from: `"${SMTP_FROM_NAME}" <${SMTP_EMAIL}>`,
                to: mailData.to,
                subject: mailData.subject,
                html: mailData.html || mailData.message || "",
            });

            await snap.ref.update({
                status: "sent",
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`Email sent to ${mailData.to}: ${mailData.subject}`);
        } catch (error) {
            console.error(`Error sending email to ${mailData.to}:`, error.message);
            await snap.ref.update({
                status: "error",
                error: error.message,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
