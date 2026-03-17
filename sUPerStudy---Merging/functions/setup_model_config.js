/**
 * Setup script: Pushes model config from .env to Firestore app_config/ai_models
 * Run once: node functions/setup_model_config.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize with default credentials
admin.initializeApp();
const db = admin.firestore();

function loadEnv() {
    const envPath = path.resolve(__dirname, "../.env");
    if (!fs.existsSync(envPath)) {
        console.error("❌ .env file not found at", envPath);
        process.exit(1);
    }
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

async function main() {
    const env = loadEnv();

    // Extract only model-related keys
    const modelKeys = Object.keys(env).filter(k =>
        k.match(/^(FREE|STANDARD|PREMIUM)_(MODEL_|MEDIA_)/) || k === "FREE_MEDIA_ENABLED"
    );

    const modelConfig = {};
    for (const key of modelKeys) {
        modelConfig[key] = env[key];
    }

    console.log("📋 Model config to push to Firestore:");
    console.log(JSON.stringify(modelConfig, null, 2));

    await db.collection("app_config").doc("ai_models").set(modelConfig, { merge: true });
    console.log("✅ Model config saved to Firestore app_config/ai_models");

    process.exit(0);
}

main().catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});
