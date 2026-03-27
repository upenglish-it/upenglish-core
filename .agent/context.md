# Current Project Context & Objectives

## The Mission: IELTS Platform Migration & Centralization
We are actively migrating the legacy Firestore/Firebase frontend-heavy logic of the SuperStudy application into a robust, service-oriented **NestJS + MongoDB monorepo** architecture. 

The core architectural mandate is to centralize identity and data governance within a master `isms` database. The `isms` database acts as the absolute source of truth for all dependent services, primarily `superstudy` and `superlms`.

## The Architectural Rules of Engagement

1. **The Single Source of Truth (`isms`)**: 
   - Core user data (Admin, Teacher, Student accounts, permissions) lives exclusively in the `isms` database.
   - The `superstudy` local database MUST ingest, synchronize, or reference this data. 
   - **CRITICAL:** Direct modification of core user data from within `superstudy` into the `isms` dataset is strictly prohibited.

2. **Technology Stack:**
   - **Backend:** NestJS (Strictly typed, service-level abstraction, DTO-driven validation).
   - **Database:** MongoDB (via Mongoose/TypeORM, strong relational mapping to legacy Firestore structures).
   - **Frontend:** ReactJS (Migrating from AuthContext direct-Firestore queries to unified API calls).

3. **Technical Mandates & Code Standards:**
   - **Cross-Database Safety:** Robust error boundaries must be implemented for cross-database queries to prevent `superstudy` from failing if `isms` is unreachable.
   - **Strict Abstraction:** All backend logic resides in Injectable NestJS Services. Controllers only handle HTTP routing and delegation.
   - **Unified Authentication:** Auth flows (login, permissions) are strictly derived from the `isms` core records.

4. **The "Definition of Done" (E2E Verification)**:
   - No migration task or feature is considered complete until it is verified end-to-end in the browser using the Subagent extension. We must guarantee that NestJS API changes function exactly as expected in the React UI context.

## Current Migration Focus Areas
* **Authentication:** Moving `AuthContext` away from Firebase to unified login flows via NestJS.
* **Component Entity Management:** Replacing direct Firestore calls in areas like `TeacherGrammarPage` and lesson duplication services, ensuring legacy `_id` mappings transition smoothly to standard `id` conventions.
* **Reporting & Analytics:** Refactoring features like the `Report Period Service` to use backend MongoDB aggregations rather than processing on the React client.
* **Module Synchronization:** Updating legacy features (Accounts, Activity Logs, Announcements, Tasks) to ensure they perfectly mirror the centralized state of `isms`.
