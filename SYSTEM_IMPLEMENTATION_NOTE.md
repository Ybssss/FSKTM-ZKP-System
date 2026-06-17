# FSKTM ZKP Symposium System - Detailed Implementation Note

This note maps the important implemented functions to their code locations and explains why the security and domain elements matter.

## Index of Contents

- [1. First important truth about the current ZKP implementation](#1-first-important-truth-about-the-current-zkp-implementation)
- [2. Main backend route map](#2-main-backend-route-map)
- [3. Authentication and security path](#3-authentication-and-security-path)
  - [3.1 Registration](#31-registration)
  - [3.2 Login challenge and proof verification](#32-login-challenge-and-proof-verification)
  - [3.3 No password storage](#33-no-password-storage)
  - [3.4 Device-bound sessions](#34-device-bound-sessions)
  - [3.5 Brute-force and bot resistance](#35-brute-force-and-bot-resistance)
  - [3.6 Device pairing and key transfer](#36-device-pairing-and-key-transfer)
- [4. User model and role design](#4-user-model-and-role-design)
- [5. User lifecycle and profile features](#5-user-lifecycle-and-profile-features)
  - [5.1 Admin user creation, update, reset](#51-admin-user-creation-update-reset)
  - [5.2 Inline user profile routes](#52-inline-user-profile-routes)
- [6. Scheduling, session batches, and conflict control](#6-scheduling-session-batches-and-conflict-control)
  - [6.1 Session batch master](#61-session-batch-master)
  - [6.2 Session creation and bulk scheduling](#62-session-creation-and-bulk-scheduling)
  - [6.3 Conflict prevention](#63-conflict-prevention)
- [7. Evaluation creation, submission, release, and supervisor logic](#7-evaluation-creation-submission-release-and-supervisor-logic)
  - [7.1 Automatic evaluation document generation](#71-automatic-evaluation-document-generation)
  - [7.2 Evaluation schema](#72-evaluation-schema)
  - [7.3 Evaluation submission](#73-evaluation-submission)
  - [7.4 Result publication rule](#74-result-publication-rule)
- [8. Historical vault, permission governance, and unlock flow](#8-historical-vault-permission-governance-and-unlock-flow)
  - [8.1 Permission model](#81-permission-model)
  - [8.2 Permission controller](#82-permission-controller)
- [9. Session materials and protected file access](#9-session-materials-and-protected-file-access)
- [10. Attendance and QR/PIN flow](#10-attendance-and-qrpin-flow)
  - [10.1 QR generation and verification](#101-qr-generation-and-verification)
  - [10.2 Attendance records and derived absence](#102-attendance-records-and-derived-absence)
- [11. Rubrics and scoring consistency](#11-rubrics-and-scoring-consistency)
- [12. Panel assignment and AI matching](#12-panel-assignment-and-ai-matching)
- [13. Frontend pages that matter most operationally](#13-frontend-pages-that-matter-most-operationally)
- [14. Why ZKP is important in this system specifically](#14-why-zkp-is-important-in-this-system-specifically)
  - [14.1 It removes password storage from a sensitive academic platform](#141-it-removes-password-storage-from-a-sensitive-academic-platform)
  - [14.2 It fits shared-device and lab-device usage better](#142-it-fits-shared-device-and-lab-device-usage-better)
  - [14.3 It reduces phishing and password reuse risk](#143-it-reduces-phishing-and-password-reuse-risk)
  - [14.4 It works well with strict result privacy](#144-it-works-well-with-strict-result-privacy)
- [15. Other important system elements besides ZKP](#15-other-important-system-elements-besides-zkp)
- [16. Demo and seeded data](#16-demo-and-seeded-data)
- [17. Final implementation summary](#17-final-implementation-summary)
- [18. Code navigation caveats](#18-code-navigation-caveats)

## 1. First important truth about the current ZKP implementation

The live login flow is not using a full zk-SNARK verification path today.

- The active backend login verification is a Schnorr-style zero-knowledge proof over `secp256k1` in `backend/src/controllers/authController.js:30`.
- The live login endpoint that uses it is `verifyDeviceProof` in `backend/src/controllers/authController.js:183`.
- The frontend proof generation that matches this backend logic is in `frontend/src/utils/zkp.js:21`.
- `snarkjs`, `plonk`, the verification key path, and `loadVerificationKey()` exist in `backend/src/controllers/authController.js:2`, `:12`, and `:17`, but the current login flow does not call them.
- `backend/src/services/zkpService.js:117` contains a `verifySnarkProof()` helper, but that is not the active login path either.

So, if you explain the real codebase accurately:

- the deployed authentication path is a challenge-response zero-knowledge proof style login;
- it avoids password transmission and server-side password storage;
- it is not yet a full production zk-SNARK verifier path end to end.

That distinction matters in presentation, documentation, and viva defense.

## 2. Main backend route map

All backend API modules are mounted in `backend/src/server.js:124-134`.

- `/api/auth` -> authentication, registration, device trust, pairing.
- `/api/users` -> user lifecycle, profile, profile image, assignments.
- `/api/evaluations` -> evaluation listing, submission, session-specific evaluation viewing.
- `/api/rubrics` -> rubric management.
- `/api/timetables` -> scheduling, session materials, batch print, document tickets, notes.
- `/api/session-batches` -> batch master records.
- `/api/feedback` -> historical vault permissions, unlock requests, access governance.
- `/api/attendance` -> attendance records and student attendance history.
- `/api/qr` -> QR/PIN attendance generation and verification.
- `/api/analytics` -> dashboard analytics.

The main frontend route map is in `frontend/src/App.jsx:48-130`.

## 3. Authentication and security path

### 3.1 Registration

Purpose:

- bind a user account to a public key;
- keep the private key only on the client device;
- avoid storing passwords on the server.

Important code:

- Admin user creation and registration code issuance:
  - `backend/src/controllers/userController.js:87`
- ZKP registration endpoint:
  - `backend/src/controllers/authController.js:58`
- Registration route:
  - `backend/src/routes/auth.js:10`
- Frontend register flow:
  - `frontend/src/contexts/AuthContext.jsx:154`
  - `frontend/src/pages/RegisterPage.jsx:14`
- Frontend key generation and export:
  - `frontend/src/utils/zkp.js:13`
  - `frontend/src/utils/zkp.js:58`

How it works:

- Admin creates the user and a `registrationCode`.
- Client generates a local keypair.
- Client sends only `publicKey` plus `registrationCode`.
- Server stores `zkpPublicKey` and flips `zkpRegistered = true`.

Why this matters:

- no password is created;
- no password hash exists to leak;
- user identity is bound to a cryptographic keypair instead of a shared secret.

### 3.2 Login challenge and proof verification

Important code:

- Challenge generation:
  - `backend/src/controllers/authController.js:151`
- Proof verification and session issue:
  - `backend/src/controllers/authController.js:183`
- Frontend login orchestration:
  - `frontend/src/contexts/AuthContext.jsx:82`
- Frontend challenge-aware proof generation:
  - `frontend/src/utils/zkp.js:21`
- Login page:
  - `frontend/src/pages/LoginPage.jsx:10`
  - `frontend/src/pages/LoginPage.jsx:137`

How it works:

- user enters `userId`;
- frontend requests a server challenge;
- frontend signs the challenge with the locally stored private key using the zero-knowledge style proof routine;
- backend verifies the proof against the stored public key;
- backend clears the used challenge and issues JWT plus device binding info.

Why the challenge is important:

- it prevents replay of an old proof;
- proof must match the current server challenge;
- expired or missing challenge is rejected.

### 3.3 No password storage

Important code:

- User schema fields:
  - `backend/src/models/User.js:54-63`

What is present:

- `zkpPublicKey`
- `zkpRegistered`
- `zkpChallenge`
- `zkpChallengeExpiry`
- `authenticatedDevices`

What is not present:

- no `password`
- no `passwordHash`
- no password reset token flow in the conventional sense

Why this matters:

- the database does not become a password-hash vault;
- password reuse attacks are removed from the core auth design;
- there is no password to phish, stuff, or brute force directly.

### 3.4 Device-bound sessions

Important code:

- device record update during login:
  - `backend/src/controllers/authController.js:247-265`
- JWT issuance:
  - `backend/src/controllers/authController.js:271-281`
- middleware check for active device:
  - `backend/src/middleware/auth.js:30`
  - `backend/src/middleware/auth.js:61-78`
- list/remove devices:
  - `backend/src/controllers/authController.js:498`
  - `backend/src/controllers/authController.js:516`
- frontend device management page:
  - `frontend/src/pages/DeviceManagementPage.jsx:19`

Why this matters:

- session validity is tied to a known device record, not only to a token string;
- removing or resetting a device invalidates the session at middleware level;
- a stolen old JWT is not enough if the associated device record is gone.

Important implementation note:

- JWT lifetime is set extremely long in `backend/src/controllers/authController.js:281`.
- Practical session control is therefore enforced mainly by device revocation, not by short token expiry.

### 3.5 Brute-force and bot resistance

Important code:

- rate limiter:
  - `backend/src/middleware/authChallengeProtection.js:9`
- reCAPTCHA requirement:
  - `backend/src/middleware/authChallengeProtection.js:24`
- token verification helper:
  - `backend/src/utils/recaptcha.js:41`
- auth route protection:
  - `backend/src/routes/auth.js:19-31`

Why this matters:

- challenge issuance is the public attack surface in a passwordless flow;
- rate limiting slows scripted challenge abuse;
- reCAPTCHA blocks automated challenge harvesting and login spam;
- this is how the system handles the brute-force style threat in practice.

### 3.6 Device pairing and key transfer

Important code:

- pairing request:
  - `backend/src/controllers/authController.js:306`
- temp key lookup:
  - `backend/src/controllers/authController.js:343`
- encrypted key submission:
  - `backend/src/controllers/authController.js:385`
- polling completion:
  - `backend/src/controllers/authController.js:430`
- pairing modal:
  - `frontend/src/components/DevicePairingModal.jsx:42-105`
- scanner:
  - `frontend/src/components/DeviceScanner.jsx:25-52`
- crypto helpers:
  - `frontend/src/utils/zkp.js:79`
  - `frontend/src/utils/zkp.js:96`
  - `frontend/src/utils/zkp.js:124`
  - `frontend/src/utils/zkp.js:166`

Why this matters:

- a new device can receive the private key without exposing it to the server in plaintext;
- the server stores only the encrypted transfer payload temporarily;
- transfer is time-bounded with pairing expiry.

Important codebase note:

- the live UI imports `frontend/src/utils/zkp.js`, not `frontend/src/services/zkp.js`.
- Active imports are in:
  - `frontend/src/contexts/AuthContext.jsx:8`
  - `frontend/src/pages/LoginPage.jsx:4`
  - `frontend/src/pages/DeviceManagementPage.jsx:4`
  - `frontend/src/components/DeviceScanner.jsx:11`
- `frontend/src/services/zkp.js` appears to be an older or alternate helper, not the live one.

## 4. User model and role design

Important code:

- `backend/src/models/User.js:1`

Core identity and role fields:

- `role` in `backend/src/models/User.js:8`
- `supervisorId` in `backend/src/models/User.js:29`
- `assignedStudents` in `backend/src/models/User.js:39`
- `assignedPanels` in `backend/src/models/User.js:45`
- `profileImageUrl` in `backend/src/models/User.js:21`
- `profession` and `expertiseTags` in `backend/src/models/User.js:20` and `:33`

What this means structurally:

- the system has three stored roles only: `admin`, `panel`, `student`;
- supervisor is not a separate stored role;
- supervisor behavior is realized by a `panel` or `admin` user being referenced as `student.supervisorId`.

Why this matters:

- it explains why SV is treated as a special entity in workflow without being a separate `role` enum;
- the same staff member can act as ordinary panel or fixed supervisor depending on context.

## 5. User lifecycle and profile features

### 5.1 Admin user creation, update, reset

Important code:

- create user:
  - `backend/src/controllers/userController.js:87`
- reset ZKP registration:
  - `backend/src/controllers/userController.js:235`
- update user:
  - `backend/src/controllers/userController.js:312`

Why it matters:

- this is the administrative identity provisioning path;
- it controls profession, expertise tags, supervisor assignment, research metadata, and registration reset.

### 5.2 Inline user profile routes

These are implemented directly in routes, not only in the controller.

Important code:

- get assigned/supervised students:
  - `backend/src/routes/user.js:31`
- update student abstract:
  - `backend/src/routes/user.js:83`
- update profile image:
  - `backend/src/routes/user.js:130`
- get current profile:
  - `backend/src/routes/user.js:191`
- update student research title:
  - `backend/src/routes/user.js:240`
- assign default panels:
  - `backend/src/routes/user.js:400`
- unassign default panel:
  - `backend/src/routes/user.js:482`

Why it matters:

- this is where profile image support, own-profile viewing, and student self-edit features really live;
- default panel assignment affects future scheduling, not already-created sessions.

## 6. Scheduling, session batches, and conflict control

### 6.1 Session batch master

Important code:

- batch schema:
  - `backend/src/models/SessionBatch.js:5-56`
- create batch:
  - `backend/src/controllers/sessionBatchController.js:61`
- auto-generate batch ID:
  - `backend/src/controllers/sessionBatchController.js:47`
- update batch and sync sessions:
  - `backend/src/controllers/sessionBatchController.js:182`

Why it matters:

- `SessionBatch` is the master record for batch metadata;
- batch edits must sync to `Timetable`, or dashboard and print outputs drift from the batch master.

### 6.2 Session creation and bulk scheduling

Important code:

- single-session payload normalization:
  - `backend/src/controllers/timetableController.js:431`
- create single timetable:
  - `backend/src/controllers/timetableController.js:484`
- create bulk timetables:
  - `backend/src/controllers/timetableController.js:560`
- existing/new batch ID logic:
  - `backend/src/controllers/timetableController.js:122`
  - `backend/src/controllers/timetableController.js:585-599`
- frontend scheduler page:
  - `frontend/src/pages/panel/TimetableManagementPage.jsx:60`
  - `frontend/src/pages/panel/TimetableManagementPage.jsx:278`
  - `frontend/src/pages/panel/TimetableManagementPage.jsx:483`

Why it matters:

- this is the operational center for building the symposium schedule;
- the recent batch ID contract fix is in this path;
- the page supports both existing-batch reuse and new-batch creation.

### 6.3 Conflict prevention

Important code:

- validation helpers:
  - `backend/src/utils/timetableValidation.js`
- schedule conflict enforcement:
  - `backend/src/controllers/timetableController.js:319`
- panel replacement timing rule constant and enforcement:
  - `backend/src/controllers/timetableController.js:49`
  - `backend/src/controllers/timetableController.js:310`
- batch time-frame update:
  - `backend/src/controllers/timetableController.js:768`

Why it matters:

- blocks overlapping panel assignments;
- blocks a student from being scheduled twice on the same day;
- enforces a minimum panel replacement window before session date.

## 7. Evaluation creation, submission, release, and supervisor logic

### 7.1 Automatic evaluation document generation

Important code:

- build evaluation docs when timetable is created:
  - `backend/src/utils/evaluationWorkflow.js:57`
- panel evaluations inserted with `formFiller: "Panel"`:
  - `backend/src/utils/evaluationWorkflow.js:86`
- supervisor evaluation inserted with `formFiller: "Supervisor"`:
  - `backend/src/utils/evaluationWorkflow.js:99`
- ensure missing supervisor evaluations:
  - `backend/src/utils/evaluationWorkflow.js:104`
  - `backend/src/utils/evaluationWorkflow.js:173`

Why it matters:

- the system always models the supervisor as an evaluator when a supervisor exists;
- this is where the "2 panels + 1 supervisor" structure is realized in code.

### 7.2 Evaluation schema

Important code:

- `backend/src/models/Evaluation.js:1`

Important fields:

- `status` -> `backend/src/models/Evaluation.js:23`
- `isUnlocked` -> `backend/src/models/Evaluation.js:29`
- `scores` -> `backend/src/models/Evaluation.js:55`
- `qualitativeFeedback` -> `backend/src/models/Evaluation.js:56`
- `totalMarks` -> `backend/src/models/Evaluation.js:57`
- `formFiller` -> `backend/src/models/Evaluation.js:63`
- `overallComments` -> `backend/src/models/Evaluation.js:69`

### 7.3 Evaluation submission

Important code:

- weighted total calculation:
  - `backend/src/controllers/evaluationController.js:19`
- get all evaluations:
  - `backend/src/controllers/evaluationController.js:35`
- submit evaluation:
  - `backend/src/controllers/evaluationController.js:169`
- panel evaluation page:
  - `frontend/src/pages/panel/EvaluationPage.jsx:94`
  - `frontend/src/pages/panel/EvaluationPage.jsx:300`
- frontend submit payload helper:
  - `frontend/src/utils/evaluationForm.js:130`

Why it matters:

- rubric scores are converted into `totalMarks`;
- qualitative and quantitative criteria are both supported;
- once submitted, evaluation becomes `COMPLETED` and re-locks unless explicitly unlocked.

### 7.4 Result publication rule

Important code:

- `PASS_THRESHOLD = 65`:
  - `backend/src/utils/evaluationWorkflow.js:5`
- `REQUIRED_EVALUATOR_COUNT = 3`:
  - `backend/src/utils/evaluationWorkflow.js:6`
- build final result status:
  - `backend/src/utils/evaluationWorkflow.js:191`
- hide raw marks from student:
  - `backend/src/utils/evaluationWorkflow.js:251`

What the code enforces:

- quantitative result is published only after enough completed evaluations exist;
- required count is effectively three;
- final average is computed only when publication condition is met;
- pass threshold is `>= 65`;
- student-facing payload removes `scores` and `totalMarks`;
- before publication, qualitative content is also removed from the student payload.

Why it matters:

- this is the exact implementation of the release policy;
- student sees outcome state, not raw evaluator marks.

## 8. Historical vault, permission governance, and unlock flow

### 8.1 Permission model

Important code:

- `backend/src/models/PermissionRequest.js:1`
- `scope` values:
  - `backend/src/models/PermissionRequest.js:34`
- `status` values:
  - `backend/src/models/PermissionRequest.js:68`

Scopes:

- `SINGLE_EVALUATION`
- `STUDENT_HISTORY`
- `UNLOCK_EVALUATION`

### 8.2 Permission controller

Important code:

- request single historical evaluation:
  - `backend/src/controllers/feedbackController.js:369`
- request full student history:
  - `backend/src/controllers/feedbackController.js:479`
- request unlock:
  - `backend/src/controllers/feedbackController.js:618`
- list my permissions:
  - `backend/src/controllers/feedbackController.js:717`
- respond approve/reject:
  - `backend/src/controllers/feedbackController.js:744`
- self-unlock after approval:
  - `backend/src/controllers/feedbackController.js:842`
- incoming requests:
  - `backend/src/controllers/feedbackController.js:915`
- withdraw permission:
  - `backend/src/controllers/feedbackController.js:963`
- admin all permissions:
  - `backend/src/controllers/feedbackController.js:1034`

Why it matters:

- it is the governance layer for privacy-sensitive historical evaluation access;
- it separates ownership, requester, student, current session, and approval state;
- rejection feedback is enforced for auditability.

## 9. Session materials and protected file access

Important code:

- session material access rule:
  - `backend/src/controllers/timetableController.js:143`
- upload document:
  - `backend/src/controllers/timetableController.js:990`
- delete document:
  - `backend/src/controllers/timetableController.js:1039`
- create short-lived view ticket:
  - `backend/src/controllers/timetableController.js:1071`
- stream with ticket:
  - `backend/src/controllers/timetableController.js:1115`
- frontend material opener:
  - `frontend/src/utils/authenticatedFile.js:40`

Why it matters:

- students, assigned panels, supervisors, and admins do not all have the same file rights;
- the system does not simply expose a raw file URL;
- it uses a short-lived signed ticket for protected viewing.

Storage abstraction:

- local storage service:
  - `backend/src/services/fileStorageService.js:41`
  - `backend/src/services/fileStorageService.js:96`
  - `backend/src/services/fileStorageService.js:129`
- Google Drive compatibility layer:
  - `backend/src/services/googleDriveService.js:8-12`

## 10. Attendance and QR/PIN flow

### 10.1 QR generation and verification

Important code:

- generate QR/PIN:
  - `backend/src/controllers/qrController.js:63`
- verify QR/PIN:
  - `backend/src/controllers/qrController.js:148`
- get current QR:
  - `backend/src/controllers/qrController.js:260`

Why it matters:

- attendance token is tied to a specific timetable session;
- only assigned student can redeem it;
- token expiry is enforced;
- duplicate attendance is handled safely.

### 10.2 Attendance records and derived absence

Important code:

- attendance schema:
  - `backend/src/models/Attendance.js:1`
- manual mark:
  - `backend/src/controllers/attendanceController.js:48`
- student attendance history:
  - `backend/src/controllers/attendanceController.js:144`
- derived absent record:
  - `backend/src/controllers/attendanceController.js:35`

Why it matters:

- completed sessions with no record are surfaced as absent in student history;
- this makes the attendance history more truthful than simply showing nothing.

## 11. Rubrics and scoring consistency

Important code:

- rubric schema:
  - `backend/src/models/Rubric.js:1`
- rubric listing route/controller:
  - `backend/src/controllers/rubricController.js:3`
  - `backend/src/routes/rubric.js:79`
- shared frontend helper:
  - `frontend/src/utils/evaluationForm.js:46`
  - `frontend/src/utils/evaluationForm.js:51`
  - `frontend/src/utils/evaluationForm.js:62`
  - `frontend/src/utils/evaluationForm.js:91`
  - `frontend/src/utils/evaluationForm.js:130`
- student rubric viewer:
  - `frontend/src/pages/student/StudentRubrics.jsx:14`
- panel evaluation page:
  - `frontend/src/pages/panel/EvaluationPage.jsx:94`

Why it matters:

- the same rubric logic is reused for display and submission;
- this reduces mismatch between what students see and what panels score against.

## 12. Panel assignment and AI matching

Important code:

- assign default panel:
  - `backend/src/controllers/matchingController.js:4`
- deterministic expertise scorer:
  - `backend/src/controllers/matchingController.js:212`
- Gemini recommendation overlay:
  - `backend/src/controllers/matchingController.js:296`
- final match endpoint:
  - `backend/src/controllers/matchingController.js:355`
- admin assignment page:
  - `frontend/src/pages/panel/PanelAssignmentPage.jsx:16`

Why it matters:

- panel recommendation is not random;
- it first computes deterministic overlap from stored expertise tags;
- AI recommendation boosts but does not replace the deterministic baseline;
- supervisor is excluded from the recommended external panel set where relevant.

## 13. Frontend pages that matter most operationally

Main operational pages:

- login:
  - `frontend/src/pages/LoginPage.jsx:10`
- registration:
  - `frontend/src/pages/RegisterPage.jsx:14`
- device management:
  - `frontend/src/pages/DeviceManagementPage.jsx:19`
- evaluation:
  - `frontend/src/pages/panel/EvaluationPage.jsx:94`
- historical vault:
  - `frontend/src/pages/panel/HistoricalFeedbackPage.jsx:99`
- session management:
  - `frontend/src/pages/panel/TimetableManagementPage.jsx:60`
- users/admin panel:
  - `frontend/src/pages/panel/UsersPage.jsx:93`
- student attendance:
  - `frontend/src/pages/student/AttendancePage.jsx:84`
- student rubric view:
  - `frontend/src/pages/student/StudentRubrics.jsx:14`

Why they matter:

- these pages expose the actual operational workflows used in demo and live use;
- if you are preparing slides or a system walkthrough, these are the screens to anchor the flow.

## 14. Why ZKP is important in this system specifically

This is not only a generic security upgrade. It is relevant to this symposium system for concrete reasons.

### 14.1 It removes password storage from a sensitive academic platform

The system handles:

- student identity;
- evaluation comments;
- progress judgments;
- historical academic records;
- protected uploaded materials.

Because no password or password hash is stored in the user model, the breach blast radius is reduced.

### 14.2 It fits shared-device and lab-device usage better

Students and panels may use:

- lab machines;
- shared office devices;
- temporary presentation environments.

The current design supports:

- trusted vs untrusted device behavior;
- local key deletion on logout for untrusted sessions;
- explicit device revocation by admin or user.

### 14.3 It reduces phishing and password reuse risk

A conventional password flow would inherit:

- weak password selection;
- password reuse across systems;
- phishing capture risk;
- hash theft risk.

This system instead uses:

- public-key registration;
- challenge-response proof;
- no password transmission;
- no password secret at rest on the server.

### 14.4 It works well with strict result privacy

This system already has a strong privacy model:

- role-based access control;
- permission-gated historical access;
- locked evaluation revisions;
- student result sanitization;
- protected material viewing via signed tickets.

ZKP complements that design by making the authentication layer privacy-preserving as well.

## 15. Other important system elements besides ZKP

If you need to explain the system beyond security, the most important elements are these:

1. Role model with supervisor as a special workflow identity, not a separate role.
2. Batch-based session scheduling with conflict prevention.
3. Automatic creation of evaluation records from timetable sessions.
4. Three-evaluator publication rule with pass threshold `65`.
5. Historical vault with permission scopes and approval trail.
6. Protected document access with signed short-lived tickets.
7. QR/PIN attendance with expiry and student-session binding.
8. AI-assisted panel recommendation built on stored expertise tags.
9. Admin-driven user provisioning and ZKP reset lifecycle.
10. Shared rubric logic across panel and student interfaces.

## 16. Demo and seeded data

Important code:

- rubric seed data:
  - `backend/src/scripts/seed.js:31`
  - `backend/src/scripts/seed.js:666`
- student and supervisor seeding:
  - `backend/src/scripts/seed.js:802`
  - `backend/src/scripts/seed.js:954`
- session and batch seed:
  - `backend/src/scripts/seed.js:1473`
  - `backend/src/scripts/seed.js:1542`
- evaluation seeding including supervisor records:
  - `backend/src/scripts/seed.js:1555`
  - `backend/src/scripts/seed.js:1560`
  - `backend/src/scripts/seed.js:1615`
- attendance seed:
  - `backend/src/scripts/seed.js:1617`
  - `backend/src/scripts/seed.js:1619`

Why it matters:

- demo quality depends heavily on the seed state;
- many workflow assumptions, especially three-evaluator result logic and historical access testing, rely on seeded records being coherent.

## 17. Final implementation summary

If you need one technically honest summary sentence:

This system is a batch-scheduled postgraduate evaluation platform that uses public-key-based zero-knowledge style passwordless authentication, device-bound JWT sessions, role-aware scheduling and evaluation workflows, supervisor-inclusive result publication logic, gated historical feedback access, and protected academic material handling.

## 18. Code navigation caveats

These points are important when you explain or debug the codebase:

1. `frontend/src/utils/zkp.js` is the active frontend ZKP helper. `frontend/src/services/zkp.js` is not the one imported by the live login and device pages.
2. The live backend authentication path uses `verifySchnorrProof()` in `backend/src/controllers/authController.js:30`, not `verifySnarkProof()` in `backend/src/services/zkpService.js:117`.
3. `frontend/src/components/DeviceScanner.jsx:47` calls `zkp.encryptKeyForSync(...)`, but the active helper currently exposes `encryptPayload()` in `frontend/src/utils/zkp.js:124`. If QR-based device transfer is being exercised, this area should be checked first.
