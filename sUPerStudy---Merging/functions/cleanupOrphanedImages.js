const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Scheduled Cloud Function: Dọn dẹp hình orphan trong context_images/ và option_images/
 * Chạy mỗi tuần vào Chủ nhật lúc 3h sáng (Asia/Ho_Chi_Minh).
 * 
 * Logic:
 * 1. List tất cả file trong context_images/ và option_images/
 * 2. Scan tất cả documents trong grammar_questions, exam_questions, exams (sections) để tìm URLs được reference
 * 3. File nào tồn tại > 24h mà không được reference → xoá
 */
exports.cleanupOrphanedImages = functions
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .pubsub.schedule("every sunday 03:00")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async () => {
        console.log("🧹 Starting orphaned image cleanup...");

        try {
            // === Step 1: Collect all referenced URLs from Firestore ===
            const referencedUrls = new Set();

            // 1a. grammar_questions: context field (HTML) + variations options (option_images)
            const grammarQSnap = await db.collection("grammar_questions").get();
            grammarQSnap.forEach(doc => {
                const data = doc.data();
                extractUrls(data.context, referencedUrls);
                // Options in variations
                (data.variations || []).forEach(v => {
                    if (!v || !v.options) return;
                    v.options.forEach(opt => {
                        if (opt && typeof opt === "string" && (opt.includes("option_images") || opt.includes("context_images"))) {
                            referencedUrls.add(opt);
                        }
                    });
                });
            });

            // 1b. exam_questions: same structure as grammar_questions
            const examQSnap = await db.collection("exam_questions").get();
            examQSnap.forEach(doc => {
                const data = doc.data();
                extractUrls(data.context, referencedUrls);
                (data.variations || []).forEach(v => {
                    if (!v || !v.options) return;
                    v.options.forEach(opt => {
                        if (opt && typeof opt === "string" && (opt.includes("option_images") || opt.includes("context_images"))) {
                            referencedUrls.add(opt);
                        }
                    });
                });
            });

            // 1c. exams: sections[].context field (HTML with possible images)
            const examsSnap = await db.collection("exams").get();
            examsSnap.forEach(doc => {
                const data = doc.data();
                (data.sections || []).forEach(s => {
                    extractUrls(s.context, referencedUrls);
                });
            });

            console.log(`📋 Found ${referencedUrls.size} referenced image URLs in Firestore`);

            // === Step 2: List all files in context_images/ and option_images/ ===
            const prefixes = ["context_images/", "option_images/"];
            let totalDeleted = 0;
            let totalChecked = 0;
            const now = Date.now();
            const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

            for (const prefix of prefixes) {
                const [files] = await bucket.getFiles({ prefix });

                for (const file of files) {
                    totalChecked++;
                    const [metadata] = await file.getMetadata();
                    const createdAt = new Date(metadata.timeCreated).getTime();

                    // Skip files less than 1 week old (give time for saves)
                    if (now - createdAt < ONE_WEEK_MS) {
                        continue;
                    }

                    // Check if this file's public URL is referenced
                    const fileName = file.name; // e.g. "context_images/12345_abc.webp"
                    const isReferenced = [...referencedUrls].some(url =>
                        url.includes(encodeURIComponent(fileName)) || url.includes(fileName)
                    );

                    if (!isReferenced) {
                        try {
                            await file.delete();
                            totalDeleted++;
                            console.log(`🗑️ Deleted orphan: ${fileName}`);
                        } catch (err) {
                            console.error(`Error deleting ${fileName}:`, err.message);
                        }
                    }
                }
            }

            console.log(`✅ Cleanup complete: checked ${totalChecked} files, deleted ${totalDeleted} orphans`);
        } catch (error) {
            console.error("❌ Cleanup error:", error);
        }

        return null;
    });

/**
 * Extract Firebase Storage URLs from HTML content and add to the set.
 */
function extractUrls(html, urlSet) {
    if (!html || typeof html !== "string") return;
    // Match Firebase Storage URLs for context_images or option_images
    const regex = /https:\/\/firebasestorage\.googleapis\.com[^"'\s)<>]*(?:context_images|option_images)[^"'\s)<>]*/g;
    const matches = html.match(regex) || [];
    matches.forEach(url => urlSet.add(url));
}
