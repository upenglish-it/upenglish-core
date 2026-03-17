const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

// AI Proxy (2nd Gen Cloud Function)
const { aiProxy } = require("./aiProxy");
exports.aiProxy = aiProxy;

// Scheduled cleanup for orphaned images
const { cleanupOrphanedImages } = require("./cleanupOrphanedImages");
exports.cleanupOrphanedImages = cleanupOrphanedImages;

// Email queue processor — sends email on new mail_queue documents
const { processMailQueue } = require("./sendAssignmentEmail");
exports.processMailQueue = processMailQueue;

// Scheduled notifications (cron)
const { checkDeadlineExpired, monthlySkillReportReminder, checkExpiringAccounts, autoSubmitExpiredExams } = require("./scheduledNotifications");
exports.checkDeadlineExpired = checkDeadlineExpired;
exports.monthlySkillReportReminder = monthlySkillReportReminder;
exports.checkExpiringAccounts = checkExpiringAccounts;
exports.autoSubmitExpiredExams = autoSubmitExpiredExams;

exports.deleteUser = functions.https.onCall(async (data, context) => {
    // Check if requester is an admin
    // Since we use custom token claims for roles in this app (based on AuthContext/Firestore)
    // We should verify the user's role from Firestore to be safe if tokens aren't synced.
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Phải đăng nhập mới có thể thực hiện thao tác này."
        );
    }

    const callerUid = context.auth.uid;
    const callerSnap = await admin.firestore().collection('users').doc(callerUid).get();
    const callerData = callerSnap.data();

    if (!callerData || callerData.role !== 'admin') {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Chỉ Admin mới có quyền xóa người dùng."
        );
    }

    const targetUid = data.uid;
    if (!targetUid) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "UID người dùng cần xóa không hợp lệ."
        );
    }

    // Prevent admin from deleting themselves via this function
    if (targetUid === callerUid) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Bạn không thể tự xóa tài khoản của chính mình qua chức năng này."
        );
    }

    try {
        // Read user email before deletion (for whitelist cleanup)
        const targetSnap = await admin.firestore().collection('users').doc(targetUid).get();
        const targetEmail = targetSnap.exists ? (targetSnap.data().email || '').toLowerCase().trim() : '';

        // Delete from Firebase Auth
        try {
            await admin.auth().deleteUser(targetUid);
            console.log(`Successfully deleted user ${targetUid} from Firebase Auth.`);
        } catch (authError) {
            if (authError.code === 'auth/user-not-found') {
                console.log(`User ${targetUid} not found in Firebase Auth. Proceeding to delete from Firestore.`);
            } else {
                throw authError; // Re-throw other Auth errors
            }
        }

        // Delete from Firestore
        await admin.firestore().collection('users').doc(targetUid).delete();

        // Clean up whitelist entry so they can't auto-approve on re-login
        if (targetEmail) {
            try {
                await admin.firestore().collection('email_whitelist').doc(targetEmail).delete();
                console.log(`Cleaned up whitelist entry for ${targetEmail}`);
            } catch (wlErr) {
                // Not critical if whitelist entry doesn't exist
                console.log(`No whitelist entry to clean up for ${targetEmail}`);
            }
        }

        return {
            success: true,
            message: `Đã xóa thành công người dùng ${targetUid} khỏi hệ thống.`
        };
    } catch (error) {
        console.error("Error deleting user:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.changeUserEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Phải đăng nhập mới có thể thực hiện thao tác này."
        );
    }

    const callerUid = context.auth.uid;
    const callerSnap = await admin.firestore().collection('users').doc(callerUid).get();
    const callerData = callerSnap.data();

    if (!callerData || (callerData.role !== 'admin' && callerData.role !== 'staff')) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Chỉ Admin hoặc Nhân viên VP mới có quyền đổi email người dùng."
        );
    }

    const { uid, newEmail } = data;
    if (!uid || !newEmail) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Thiếu UID hoặc email mới."
        );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Email không hợp lệ."
        );
    }

    try {
        const normalizedEmail = newEmail.toLowerCase().trim();

        // Delete the existing Firebase Auth account (removes ALL provider links)
        await admin.auth().deleteUser(uid);
        console.log(`Deleted Auth user ${uid} to clear all provider links`);

        // Recreate with the SAME UID + new email (no provider attached)
        // When user signs in with Microsoft/Google, Firebase auto-links as trusted provider
        await admin.auth().createUser({
            uid: uid,
            email: normalizedEmail,
            emailVerified: true,
        });
        console.log(`Recreated Auth user ${uid} with email ${normalizedEmail}`);

        // Update Firestore user document
        await admin.firestore().collection('users').doc(uid).update({
            email: normalizedEmail
        });

        return {
            success: true,
            message: `Đã đổi email thành công sang ${newEmail}. Người dùng cần đăng nhập lại bằng provider phù hợp với email mới.`
        };
    } catch (error) {
        console.error("Error changing user email:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError("already-exists", "Email này đã được sử dụng bởi tài khoản khác.");
        }
        if (error.code === 'auth/invalid-email') {
            throw new functions.https.HttpsError("invalid-argument", "Email không hợp lệ.");
        }
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// Resolve email conflict: returns a custom token for the existing account
// so the client can sign in and then link the new OAuth provider.
exports.resolveEmailConflict = functions.https.onCall(async (data, context) => {
    const { email } = data;
    if (!email) {
        throw new functions.https.HttpsError("invalid-argument", "Email is required.");
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(email.toLowerCase().trim());
        const customToken = await admin.auth().createCustomToken(userRecord.uid);
        return { customToken };
    } catch (error) {
        console.error("resolveEmailConflict error:", error);
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError("not-found", "Không tìm thấy tài khoản.");
        }
        throw new functions.https.HttpsError("internal", error.message);
    }
});
