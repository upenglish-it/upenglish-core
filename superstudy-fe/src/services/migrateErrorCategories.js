/**
 * STUB: migrateErrorCategories
 *
 * This was a one-time migration utility that ran against Firebase Firestore
 * to re-classify errorCategory fields on exam questions using AI.
 *
 * In the migrated NestJS/MongoDB architecture, this migration has already been
 * completed during the data migration phase. This stub prevents Vite from
 * failing on the dynamic import() that reference this module from DashboardPage.
 *
 * If you need to re-classify errorCategories, implement a backend endpoint.
 */

export async function migrateErrorCategories(onStatus, dryRun = true, forceAll = false) {
    onStatus?.('⚠️ This migration has already been completed in the NestJS migration phase.');
    return { details: [], count: 0, skipped: 0 };
}

export async function applyMigrationResults(details, onStatus) {
    onStatus?.('⚠️ This migration has already been completed in the NestJS migration phase.');
}
