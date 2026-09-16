# PROJECT IMPLEMENTATION PLAN
**Platform:** AI Automation Labs Multi-Tenant HRMS & SaaS Platform  
**Master Source of Truth:** Master Developer Specification (37 Sections)  
**Architecture:** Next.js 15 App Router + Prisma ORM + Tailwind CSS + PostgreSQL/SQLite  

---

## 1. Architectural Foundation & Execution Methodology

The implementation follows a **Database-First, Security-First, Domain-Driven Design** methodology adhering strictly to the 37 Authoritative Master Specification Sections. Every feature lifecycle follows the deterministic execution path:

$$\text{UI} \longrightarrow \text{API Router} \longrightarrow \text{RBAC / Data Scope Check} \longrightarrow \text{Domain Engine} \longrightarrow \text{Database Transaction} \longrightarrow \text{Audit Log} \longrightarrow \text{Event / Notification}$$

---

## 2. Comprehensive 37-Section Implementation Breakdown

### Section 1: Document Map & Master Reference
* **Database Models:** Dynamic metadata documentation tables.
* **API Endpoints:** Version and specification introspection `/api/v1/health`, `/api/v1/version`.
* **Business Logic:** Requirement mapping, schema integrity verification, semantic versioning.
* **Authorization:** Public version info; tenant-scoped diagnostic metadata for `SUPER_ADMIN`.
* **UI Screens:** System Diagnostics and Documentation Links.
* **Validation:** Semantic version checking (`v1.0.0`).
* **Audit Logging:** Logs all schema migration events and document revisions.
* **Notifications:** Alerts Super Admin on major release updates.
* **Background Jobs:** Automated schema integrity check.
* **Tests:** Acceptance gate 1 consistency tests.
* **Acceptance Criteria:** Document map remains 100% aligned with live database schema.

---

### Section 2: Roles and Permission Model
* **Database Models:** `Role`, `Permission`, `UserRole`, `RolePermission`.
* **API Endpoints:** `/api/v1/auth/roles`, `/api/v1/auth/permissions`, `/api/v1/auth/me`.
* **Business Logic:** 7 system roles (`SUPER_ADMIN`, `SUPPORT_ADMIN`, `TENANT_ADMIN`, `HR_MANAGER`, `PAYROLL_ADMIN`, `LINE_MANAGER`, `EMPLOYEE`), granular string permissions (`module.resource:action`), and data scopes (`OWN`, `DIRECT_REPORTS`, `DEPARTMENT`, `ENTIRE_TENANT`).
* **Authorization:** Super admin and tenant admin role assignment checks.
* **UI Screens:** Role assignment drawer, dynamic navigation based on actor permissions.
* **Validation:** Prevents elevation of privilege and circular role inheritance.
* **Audit Logging:** Every role assignment or permission change logged in `AuditLog`.
* **Notifications:** User notified via email/in-app upon role elevation.
* **Background Jobs:** Periodic stale session invalidation.
* **Tests:** `tests/rbac-permissions.test.ts`.
* **Acceptance Criteria:** Sensitive employee data (PAN, Aadhaar, Bank, CTC) strictly masked for unauthorized roles.

---

### Section 3: SaaS / Multi-Tenant Architecture
* **Database Models:** `Tenant`, `Subscription`, `SupportImpersonationLog`.
* **API Endpoints:** `/api/super-admin/tenants`, `/api/super-admin/impersonate`.
* **Business Logic:** Complete tenant isolation via `tenant_id` foreign keys, lifecycle state machine (`SIGNUP` → `TRIAL` → `ACTIVE` → `SUSPENDED` → `ARCHIVED`), and ticket-bound support impersonation.
* **Authorization:** `SUPER_ADMIN` only for platform-wide actions; strict tenant scoping for all tenant users.
* **UI Screens:** Super Admin Tenant Console (`/app/super-admin`), Impersonation Banner.
* **Validation:** Reject any incoming request with mismatched or forged tenant IDs.
* **Audit Logging:** Immutable `SupportImpersonationLog` tracking ticket ID, actor ID, and session duration.
* **Notifications:** Tenant admin alerted when support impersonation session starts/ends.
* **Background Jobs:** Daily trial expiration sweep and suspension triggers.
* **Tests:** `tests/tenant-isolation.test.ts`, `tests/saas-billing-entitlements.test.ts`.
* **Acceptance Criteria:** Zero cross-tenant data leakage across all 30+ relational entities.

---

### Section 4: Technology Stack Recommendation
* **Stack:** Next.js 15, React 19, TypeScript Strict, Tailwind CSS, Prisma 6.4, PostgreSQL / SQLite.
* **API Endpoints:** Next.js Route Handlers with standard JSON serialization.
* **Business Logic:** Pure TypeScript domain modules isolated in `src/lib/*`.
* **Authorization:** Server-side session verification via JWT tokens.
* **UI Components:** Reusable accessible components in `src/components/*`.
* **Validation:** Zod schemas for all payload validations.
* **Audit Logging:** Global error logging and transaction tracking.
* **Notifications:** Multi-provider notification dispatch engine.
* **Background Jobs:** BullMQ / Worker process simulation for async jobs.
* **Tests:** Vitest runner with TypeScript typecheck.
* **Acceptance Criteria:** 100% build pass rate with zero TypeScript errors.

---

### Section 5: Core Domain Model and Database
* **Database Models:** Complete 32-entity relational schema in `prisma/schema.prisma`.
* **API Endpoints:** Internal Prisma client access across all service modules.
* **Business Logic:** UUID primary keys, foreign key constraints, cascade rules, soft delete flags.
* **Authorization:** Database client wrapped with tenant scoping helpers.
* **UI Screens:** Database visualizers in admin panel.
* **Validation:** Database-level uniqueness constraints and check validations.
* **Audit Logging:** Database migration history tracking.
* **Notifications:** Database connection failure alerts.
* **Background Jobs:** Snapshot backup scripts and health checks.
* **Tests:** `prisma generate` validation, `scripts/backup-restore.ts`.
* **Acceptance Criteria:** Clean relational integrity with zero orphaned child records.

---

### Section 6: Authentication and Identity
* **Database Models:** `User`, `PasswordResetToken`, `Session`.
* **API Endpoints:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/reset-password`, `/api/auth/verify-reset-token`.
* **Business Logic:** Password hashing with bcrypt (10 rounds), HMAC-SHA256 JWT generation, account status validation, single-use reset tokens with 15-minute expiration.
* **Authorization:** Public login/reset endpoints protected with IP rate limiting.
* **UI Screens:** Login (`/app/login`), Password Reset, Password Request screens.
* **Validation:** Email format, password complexity (min 8 chars, numbers, symbols).
* **Audit Logging:** `USER_LOGIN_SUCCESS`, `USER_LOGIN_FAILED`, `PASSWORD_RESET_COMPLETED`.
* **Notifications:** Password reset link emails with one-time security codes.
* **Background Jobs:** Expired reset token cleanup cron.
* **Tests:** `tests/support-and-auth-reset.test.ts`, `tests/security-audit-rate-limit.test.ts`.
* **Acceptance Criteria:** Rate limiter blocks brute-force attacks after 5 failed attempts.

---

### Section 7: Organization & Employee Master
* **Database Models:** `LegalEntity`, `BranchLocation`, `Department`, `Designation`, `Grade`, `Employee`, `EmployeeIdentity`, `EmployeeBank`, `CustomFieldDefinition`, `EmployeeCustomField`.
* **API Endpoints:** `/api/v1/employees`, `/api/v1/employees/[id]`, `/api/organization/*`.
* **Business Logic:** Configurable ID generator `{COMPANY}-{BRANCH}-{YEAR}-{SEQ:4}`, employee status machine (`DRAFT` → `ACTIVE` → `PROBATION` → `CONFIRMED` → `NOTICE` → `EXITED`), custom fields validation.
* **Authorization:** HR Manager / Admin write access; Manager scoped direct report view; Employee read-only profile.
* **UI Screens:** Employee Directory (`/app/employees`), Employee Profile, Org Settings.
* **Validation:** Unique email, PAN format, Aadhaar format, IFSC code validation.
* **Audit Logging:** Detailed field-level diffs on employee profile edits.
* **Notifications:** Welcome email on employee creation with invitation link.
* **Background Jobs:** Daily probation confirmation review check.
* **Tests:** `scripts/run-acceptance-gate.ts` (Gates 1 & 2).
* **Acceptance Criteria:** Full employee profile creation with linked identity and banking records.

---

### Section 8: Attendance & Time Management
* **Database Models:** `ShiftPolicy`, `RawAttendancePunch`, `DailyAttendanceRecord`, `AttendanceRegularization`.
* **API Endpoints:** `/api/v1/attendance`, `/api/v1/attendance/punch`, `/api/attendance/regularize`.
* **Business Logic:** Immutable punch logging, shift grace periods (15 min), half-day thresholds (240 min), overtime calculation, regularization approval workflow.
* **Authorization:** Employee punch self-service; Manager regularization approval.
* **UI Screens:** Attendance Dashboard (`/app/attendance`), Web Punch Terminal, Regularization Modal.
* **Validation:** Geo-boundary verification, duplicate punch debounce.
* **Audit Logging:** Immutable raw punch append log; regularization approval audit.
* **Notifications:** Missing punch alerts and regularization approval notifications.
* **Background Jobs:** Midnight daily attendance aggregation processor.
* **Tests:** `tests/attendance.test.ts`, `scripts/run-acceptance-gate.ts` (Gate 4).
* **Acceptance Criteria:** Daily attendance accurately computes `PRESENT`, `HALF_DAY`, `LATE`, or `ABSENT`.

---

### Section 9: Leave Management
* **Database Models:** `LeaveType`, `LeavePolicy`, `LeaveLedger`, `LeaveRequest`.
* **API Endpoints:** `/api/v1/leave`, `/api/leave/requests`, `/api/leave/approve`.
* **Business Logic:** 8 standard leave types (CL, SL, EL, ML, PL, CO, LOP, WFH), double-entry transaction ledger (`ACCRUAL`, `CONSUMPTION`, `ENCASHMENT`, `LAPSE`), sandwich rule enforcement.
* **Authorization:** Employee apply; Line Manager / Backup Approver approve/reject.
* **UI Screens:** Leave Portal (`/app/leave`), Leave Balance Cards, Manager Approval Desk.
* **Validation:** Balance availability check, maximum consecutive days, documentary proof rules.
* **Audit Logging:** Every debit/credit recorded in immutable `LeaveLedger` with actor reference.
* **Notifications:** Email & in-app alerts on submission and status changes.
* **Background Jobs:** Monthly leave accrual cron job (1st of every month).
* **Tests:** `tests/leave-ledger.test.ts`, `scripts/run-acceptance-gate.ts` (Gate 5).
* **Acceptance Criteria:** Zero balance drift; approved leaves automatically mark attendance as `ON_LEAVE`.

---

### Section 10: Payroll & Statutory Compliance
* **Database Models:** `SalaryComponent`, `SalaryStructure`, `EmployeeSalaryAssignment`, `PayrollRun`, `PayrollItem`, `Payslip`, `StatutoryRuleSet`, `PayrollAdjustment`.
* **API Endpoints:** `/api/v1/payroll`, `/api/payroll/runs`, `/api/payroll/runs/[id]/lock`, `/api/payroll/runs/[id]/override`.
* **Business Logic:** Parameterized 16-step calculation pipeline: Gross earnings, LOP deductions, EPF (12% with ₹15,000 ceiling), ESI (0.75%/3.25% with ₹21,000 ceiling), Professional Tax state slabs, TDS (Old vs New Regime 115BAC), locking state machine, PDF payslip generation.
* **Authorization:** `PAYROLL_ADMIN` and `TENANT_ADMIN` only.
* **UI Screens:** Payroll Processing Center (`/app/payroll`), Run Details, Printable Payslip View.
* **Validation:** Mandatory override reasons, locked payroll immutable lock check.
* **Audit Logging:** `PAYROLL_RUN_CALCULATED`, `PAYROLL_RUN_LOCKED`, `PAYROLL_OVERRIDE_APPLIED`.
* **Notifications:** Monthly payslip publication alerts sent to employees.
* **Background Jobs:** Asynchronous bulk payslip PDF generation worker.
* **Tests:** `tests/payroll-engine.test.ts`, `scripts/run-acceptance-gate.ts` (Gate 6).
* **Acceptance Criteria:** Mathematical precision down to 2 decimal places with deterministic statutory deductions.

---

### Section 11: Recruitment / ATS
* **Database Models:** `JobRequisition`, `Candidate`, `Interview`, `CandidateOffer`.
* **API Endpoints:** `/api/recruitment/requisitions`, `/api/recruitment/candidates`, `/api/recruitment/offers`.
* **Business Logic:** Requisition lifecycle (`DRAFT` → `OPEN` → `CLOSED`), AI candidate match scoring (0–100%), interview stage progression, offer letter generation.
* **Authorization:** `RECRUITER`, `HR_MANAGER`, and assigned interviewers.
* **UI Screens:** Recruitment Kanban Board (`/app/recruitment`), Candidate Detail Drawer, Offer Creator.
* **Validation:** Duplicate candidate email/phone detection, offer salary within budget band.
* **Audit Logging:** Candidate stage transitions and offer approvals logged.
* **Notifications:** Interview invitation emails with calendar attachments.
* **Background Jobs:** Resume text extraction and AI scoring queue.
* **Tests:** `tests/ats-pipeline.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 1).
* **Acceptance Criteria:** Candidate offer acceptance seamlessly triggers new employee draft creation.

---

### Section 12: Onboarding
* **Database Models:** `OnboardingTemplate`, `OnboardingTask`, `OnboardingInstance`, `OnboardingItem`.
* **API Endpoints:** `/api/onboarding/tasks`, `/api/onboarding/verify`.
* **Business Logic:** Department/role task checklists, pre-boarding document submission, HR verification gates, automated IT provisioning triggers.
* **Authorization:** New Hire self-service task completion; HR Manager verification.
* **UI Screens:** Onboarding Checklist Hub (`/app/onboarding`), Document Verification Queue.
* **Validation:** Mandatory file attachments for certificate/identity tasks.
* **Audit Logging:** Task completion and HR verification timestamps recorded.
* **Notifications:** Daily reminder emails for pending onboarding tasks.
* **Background Jobs:** Auto-activation of employee profile upon 100% onboarding completion.
* **Tests:** `tests/onboarding.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 2).
* **Acceptance Criteria:** Structured onboarding flow tracks 100% completion before day-1 confirmation.

---

### Section 13: Document Management & E-Signature
* **Database Models:** `DocumentTemplate`, `EmployeeDocument`, `DocumentSignature`.
* **API Endpoints:** `/api/documents/generate`, `/api/documents/sign`, `/api/documents/verify`.
* **Business Logic:** Versioned templates with dynamic merge tags (`{{employee.name}}`, `{{salary.ctc}}`), built-in cryptographic e-signature with SHA-256 tamper hash and stroke capture.
* **Authorization:** HR Manager generate; Target employee view & sign.
* **UI Screens:** Document Hub (`/app/documents`), Digital Signature Canvas Pad.
* **Validation:** Template tag syntax check, cryptographic hash verification on view.
* **Audit Logging:** Immutable signature log with IP address, timestamp, and certificate ID.
* **Notifications:** "Document Pending Signature" email with direct secure link.
* **Background Jobs:** PDF stamping and storage upload pipeline.
* **Tests:** `tests/documents-esign.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 3).
* **Acceptance Criteria:** SHA-256 signature hash proves document integrity and rejects modified bytes.

---

### Section 14: Performance Management
* **Database Models:** `PerformanceCycle`, `PerformanceGoal`, `PerformanceAppraisal`.
* **API Endpoints:** `/api/performance/cycles`, `/api/performance/goals`, `/api/performance/appraisals`.
* **Business Logic:** Annual/quarterly review cycles, OKRs/KRAs, weighted scoring algorithm, self-appraisals, manager reviews, calibrated final ratings (1.0 to 5.0).
* **Authorization:** Employee self-review; Line Manager rating; HR calibration access.
* **UI Screens:** Performance Review Center (`/app/performance`), Goal Tracker, Appraisal Form.
* **Validation:** Goal weights must sum to exactly 100%.
* **Audit Logging:** Appraisal submission and rating modifications logged.
* **Notifications:** Review cycle open and submission reminder notifications.
* **Background Jobs:** Appraisal cycle closure and bell-curve calibration reporting.
* **Tests:** `tests/performance.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 4).
* **Acceptance Criteria:** Weighted scores computed deterministically with full review visibility controls.

---

### Section 15: Expense Management
* **Database Models:** `ExpenseClaim`, `ExpenseReceipt`.
* **API Endpoints:** `/api/expenses/claims`, `/api/expenses/approve`.
* **Business Logic:** Multi-category claims (Travel, Meals, Equipment), receipt attachment, dual-tier approval (L1 Manager → L2 Finance), payment status tracking (`REIMBURSED`, `PAYROLL_ADDON`).
* **Authorization:** Employee submit; Manager L1 approve; Finance L2 settle.
* **UI Screens:** Expense Claims Hub (`/app/expenses`), New Claim Modal, Approval Queue.
* **Validation:** Claim amount limits, mandatory receipt upload for claims $> ₹500$.
* **Audit Logging:** Approval stage transitions and payment settlement logs.
* **Notifications:** Manager alert on claim submission; Employee alert on reimbursement.
* **Background Jobs:** Direct integration routing to active payroll cycle.
* **Tests:** `tests/expenses.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 5).
* **Acceptance Criteria:** Approved claims seamlessly transition to Finance settlement or payroll add-on.

---

### Section 16: Asset Management
* **Database Models:** `Asset`, `AssetAssignment`.
* **API Endpoints:** `/api/assets`, `/api/assets/assign`, `/api/assets/return`.
* **Business Logic:** IT hardware and equipment tracking by serial number and asset tag, allocation history, condition inspection on return, integration with exit clearances.
* **Authorization:** IT Admin / HR write; Employee view assigned assets.
* **UI Screens:** Asset Register (`/app/assets`), Allocation Drawer, Return Condition Form.
* **Validation:** Serial number uniqueness, asset status check (`AVAILABLE` vs `ASSIGNED`).
* **Audit Logging:** Full handover and return audit trail.
* **Notifications:** Asset assignment confirmation email to employee.
* **Background Jobs:** Warranty and maintenance expiration alert cron.
* **Tests:** `scripts/run-phase2-acceptance-gate.ts` (Gate 6).
* **Acceptance Criteria:** Exit workflow blocks final clearance until all assigned assets are returned.

---

### Section 17: Employee Self-Service (ESS)
* **Database Models:** Aggregates core domain models.
* **API Endpoints:** `/api/v1/auth/me`, `/api/v1/attendance`, `/api/v1/leave`, `/api/v1/payroll`.
* **Business Logic:** Unified employee portal, real-time punch widget, leave balance cards, downloadable payslips, request tracking, privacy-preserving peer directory.
* **Authorization:** `EMPLOYEE` role scoped strictly to `OWN` data.
* **UI Screens:** Employee Self-Service Home (`/app/dashboard`), Profile, Directory.
* **Validation:** Client-side form validations and server-side identity enforcement.
* **Audit Logging:** Self-service profile updates and download requests.
* **Notifications:** In-app badge alerts for pending actions.
* **Background Jobs:** Live attendance summary calculation.
* **Tests:** ESS Integration tests in `tests/rbac-permissions.test.ts`.
* **Acceptance Criteria:** Sensitive PII (PAN, Aadhaar, CTC) hidden from peer directory.

---

### Section 18: Manager & HR Dashboards
* **Database Models:** Real-time domain aggregation queries.
* **API Endpoints:** `/api/dashboard/metrics`, `/api/dashboard/team`.
* **Business Logic:** Manager team view (present, on leave, pending approvals), HR company-wide view (total headcount, monthly payroll liability, turnover rate).
* **Authorization:** Role-adaptive rendering based on authenticated JWT scope.
* **UI Screens:** Unified Responsive Dashboard (`/app/dashboard`).
* **Validation:** Role-scoped query filtering.
* **Audit Logging:** Dashboard export events logged.
* **Notifications:** Daily morning manager digest.
* **Background Jobs:** Dashboard metrics caching in Redis.
* **Tests:** Dashboard UI verification tests.
* **Acceptance Criteria:** Instant live metrics reconciling with database records.

---

### Section 19: Exit Management & Full & Final (F&F) Settlement
* **Database Models:** `ExitRequest`, `DepartmentClearance`, `FnFSettlement`.
* **API Endpoints:** `/api/exit/requests`, `/api/exit/clearances`, `/api/exit/fnf`.
* **Business Logic:** Resignation submission, notice period calculation, 3-tier clearances (IT hardware, Admin assets, Finance loans), Statutory Gratuity Act 1972 calculation ($15 \times \text{Basic} \times \frac{\text{Years}}{26}$), F&F statement generation, account deactivation.
* **Authorization:** Employee submit; HR / Line Manager approve; Finance / IT clearance sign-off.
* **UI Screens:** Exit Portal (`/app/exit`), Clearance Checklist, F&F Settlement Sheet.
* **Validation:** F&F generation blocked until 100% clearances approved.
* **Audit Logging:** Resignation acceptance and final settlement sign-offs.
* **Notifications:** Exit clearance request notifications to IT, Admin, and Finance.
* **Background Jobs:** Automated account deactivation on last working date.
* **Tests:** `tests/exit-fnf.test.ts`, `scripts/run-phase2-acceptance-gate.ts` (Gate 7).
* **Acceptance Criteria:** Gratuity and leave encashment computed with exact statutory adherence.

---

### Section 20: Notifications & Communications
* **Database Models:** `Notification`, `NotificationPreference`.
* **API Endpoints:** `/api/notifications`, `/api/notifications/[id]/read`.
* **Business Logic:** Multi-channel dispatcher supporting in-app database alerts, transactional email adapters (SMTP/Resend), and WhatsApp Business API adapters.
* **Authorization:** Recipient user only.
* **UI Screens:** In-App Notification Bell & Drawer.
* **Validation:** Email format and phone number E.164 validation.
* **Audit Logging:** Message dispatch logs with provider response IDs.
* **Notifications:** Self-contained dispatch engine.
* **Background Jobs:** Asynchronous message queue worker with exponential retry.
* **Tests:** `tests/integrations-notifications.test.ts`.
* **Acceptance Criteria:** Reliable in-app delivery with real-time read/unread status toggling.

---

### Section 21: AI Layer
* **Database Models:** `AIInteractionLog`, `AIPolicyEmbedding`.
* **API Endpoints:** `/api/ai/assistant`, `/api/ai/copilot`, `/api/ai/match-resume`.
* **Business Logic:** Employee AI Assistant (leave balances, payslip explainer), HR Co-Pilot (policy RAG, headcount queries), ATS Resume Matcher, RBAC context enforcement, mandatory human confirmation prompts before mutations.
* **Authorization:** Model context scoped strictly to actor's RBAC role; salary/bank access blocked for unauthorized actors.
* **UI Screens:** AI Assistant Floating Widget, HR Co-Pilot Drawer (`/app/ai-copilot`).
* **Validation:** Strict prompt injection filters and PII redaction.
* **Audit Logging:** Every AI prompt, generated response, and confirmation event logged.
* **Notifications:** Alert HR if prompt injection or security boundary violation is detected.
* **Background Jobs:** Document vectorization and policy embeddings update cron.
* **Tests:** `tests/ai-gateway.test.ts`, `tests/ai-advanced-safety.test.ts`.
* **Acceptance Criteria:** AI never mutates database without explicit human confirmation; unauthorized salary queries strictly blocked.

---

### Section 22: API & Webhooks
* **Database Models:** `WebhookSubscription`, `WebhookDeliveryLog`, `ApiKey`.
* **API Endpoints:** `/api/v1/*`, `/api/webhooks/subscriptions`, `/api/webhooks/deliver`.
* **Business Logic:** RESTful `/api/v1` endpoints with Bearer auth, HMAC-SHA256 signed webhooks, replay protection timestamps, delivery retry logs.
* **Authorization:** Scoped API Keys and Tenant Admin session.
* **UI Screens:** Developer Settings & Webhook Manager.
* **Validation:** Webhook URL HTTPS validation, payload schema validation.
* **Audit Logging:** API key generation, revocation, and webhook delivery attempts.
* **Notifications:** Alert admin on repeated webhook delivery failures.
* **Background Jobs:** Webhook delivery worker with exponential backoff.
* **Tests:** `tests/api-v1.test.ts`, `tests/webhooks.test.ts`.
* **Acceptance Criteria:** HMAC-SHA256 signature enables receiving servers to verify payload authenticity.

---

### Section 23: Reports & Analytics
* **Database Models:** Domain tables aggregated in real time.
* **API Endpoints:** `/api/v1/reports`, `/api/v1/reports/export`.
* **Business Logic:** Standard reports: Master Employee Register, Monthly Attendance Master, Leave Balances, Statutory Payroll Registers (EPF, ESI, PT, TDS), Expense Claims. High-speed CSV/PDF streaming.
* **Authorization:** `HR_MANAGER`, `PAYROLL_ADMIN`, `TENANT_ADMIN`.
* **UI Screens:** Reports Center (`/app/reports`).
* **Validation:** Date range boundaries and filter parameters.
* **Audit Logging:** Report generation and data export audit logs.
* **Notifications:** Scheduled report delivery emails.
* **Background Jobs:** Large report streaming generation.
* **Tests:** `tests/reports-analytics.test.ts`.
* **Acceptance Criteria:** Instant streaming CSV export with accurate column headers.

---

### Section 24: SaaS Super Admin
* **Database Models:** `Tenant`, `Subscription`, `SupportTicket`, `SupportImpersonationLog`.
* **API Endpoints:** `/api/super-admin/tenants`, `/api/super-admin/impersonate`, `/api/support/tickets`.
* **Business Logic:** Multi-tenant fleet management, tenant creation, status toggle (`ACTIVE`, `SUSPENDED`, `TRIAL`), support impersonation with persistent audit.
* **Authorization:** `SUPER_ADMIN` role only.
* **UI Screens:** Super Admin Console (`/app/super-admin`).
* **Validation:** Protection against super-admin self-deletion or lockout.
* **Audit Logging:** `SUPER_ADMIN_TENANT_STATUS_CHANGE`, `SUPPORT_IMPERSONATION_START`.
* **Notifications:** Alert tenant admins when platform maintenance is scheduled.
* **Background Jobs:** Platform telemetry aggregation.
* **Tests:** `tests/saas-billing-entitlements.test.ts`.
* **Acceptance Criteria:** Complete multi-tenant oversight with audited support access.

---

### Section 25: Subscription & Trial
* **Database Models:** `Subscription`, `FeatureFlag`.
* **API Endpoints:** `/api/subscription/plans`, `/api/subscription/upgrade`.
* **Business Logic:** Starter, Growth, and Enterprise plans with employee count limits, 30-day trial calculator, feature flag entitlement checks.
* **Authorization:** `TENANT_ADMIN` for plan management.
* **UI Screens:** Subscription & Billing Settings.
* **Validation:** Plan upgrade/downgrade validation against current employee counts.
* **Audit Logging:** Subscription change logs.
* **Notifications:** Trial expiration warning emails (Day 25, 28, 30).
* **Background Jobs:** Daily subscription entitlement verification sweep.
* **Tests:** `tests/saas-billing-entitlements.test.ts`.
* **Acceptance Criteria:** Enforces employee seat limits and feature gates per plan tier.

---

### Section 26: Customization & Branding
* **Database Models:** `Tenant` (branding configuration JSON).
* **API Endpoints:** `/api/settings/branding`.
* **Business Logic:** Custom company logo, theme colors, favicon, mandatory "Powered by AI Automation Labs" attribution footer.
* **Authorization:** `TENANT_ADMIN`.
* **UI Screens:** Branding & Customization Panel (`/app/settings/branding`).
* **Validation:** Image upload format (PNG/SVG/JPEG) and color hex code format.
* **Audit Logging:** Branding modifications logged.
* **Notifications:** Notification on theme change.
* **Background Jobs:** Cache bust for tenant stylesheets.
* **Tests:** UI visual regression verification.
* **Acceptance Criteria:** Persistent branding reflected across header, sidebar, payslips, and letters.

---

### Section 27: Security, Privacy & Audit
* **Database Models:** `AuditLog`, `SecurityEvent`.
* **API Endpoints:** `/api/audit-logs`, `/api/security/events`.
* **Business Logic:** AES-256 encryption at rest, TLS 1.3 in transit, bcrypt password hashing, dynamic sliding-window rate limiting, timing-safe authentication comparisons, tamper-evident audit logs with before/after JSON diffs.
* **Authorization:** `TENANT_ADMIN` and `SUPER_ADMIN` for audit inspection.
* **UI Screens:** Audit Log Explorer (`/app/audit`).
* **Validation:** IP address extraction, request signature verification.
* **Audit Logging:** Self-logging audit trail.
* **Notifications:** Real-time security alert on brute-force detection.
* **Background Jobs:** Audit log archival and retention enforcement.
* **Tests:** `tests/security-audit-rate-limit.test.ts`.
* **Acceptance Criteria:** Immutable audit log stores complete JSON diffs for all sensitive mutations.

---

### Section 28: File Storage & Document Lifecycle
* **Database Models:** `StorageFile`, `EmployeeDocument`.
* **API Endpoints:** `/api/storage/upload`, `/api/storage/download/[id]`.
* **Business Logic:** Tenant-isolated storage path hierarchies (`/tenants/{tenant_id}/{module}/{year}/{file_id}`), pre-signed 15-minute expiring download URLs, MIME-type validation, malware scanner abstraction.
* **Authorization:** Actor must have read permission on the owning module entity.
* **UI Screens:** Document Upload & File Attachment Modals.
* **Validation:** File size caps (10MB default) and forbidden executable extensions (.exe, .sh, .bat).
* **Audit Logging:** File upload and download access logged.
* **Notifications:** Alert on rejected infected file upload attempt.
* **Background Jobs:** Expired temporary file cleanup cron.
* **Tests:** Storage tests in `tests/documents-esign.test.ts`.
* **Acceptance Criteria:** Direct object access blocked; signed URLs expire after 15 minutes.

---

### Section 29: Non-Functional Requirements
* **Database Models:** N/A (Applies to all models).
* **API Endpoints:** All API endpoints.
* **Business Logic:** P95 response $< 200\text{ms}$, ACID database transactions on leave/payroll writes (`prisma.$transaction`), Indian Rupee formatting (`₹1,50,000`), standardized `Asia/Kolkata` timezone representation.
* **Authorization:** N/A.
* **UI Screens:** All UI views with standardized INR number formatting.
* **Validation:** Transaction rollback on partial write failure.
* **Audit Logging:** Performance metric logging.
* **Notifications:** Sentry / Observability error alerting.
* **Background Jobs:** Database VACUUM and indexing cron.
* **Tests:** Performance benchmarks and transaction rollback tests.
* **Acceptance Criteria:** Zero concurrency race conditions on leave balance decrements.

---

### Section 30: UX / UI Screen Inventory
* **Database Models:** N/A.
* **API Endpoints:** Consumes all domain APIs.
* **Business Logic:** 19 dedicated responsive routes with standardized skeleton loading states, informative empty states with call-to-actions, user-friendly error boundaries, and mobile viewport optimizations.
* **Authorization:** Client-side role gating mirroring server RBAC permissions.
* **UI Screens:** Complete 19-route inventory (`/app/dashboard`, `/app/employees`, `/app/attendance`, `/app/leave`, `/app/payroll`, `/app/recruitment`, `/app/onboarding`, `/app/documents`, `/app/performance`, `/app/expenses`, `/app/assets`, `/app/exit`, `/app/reports`, `/app/super-admin`, `/app/audit`, `/app/ai-copilot`, etc.).
* **Validation:** Client-side HTML5 & React Hook Form validation.
* **Audit Logging:** Client navigation telemetry.
* **Notifications:** Toast notification center.
* **Background Jobs:** Client bundle optimization.
* **Tests:** UI browser verification.
* **Acceptance Criteria:** Responsive, accessible layouts across desktop and mobile viewports.

---

### Section 31: Detailed End-to-End Workflows
* **Database Models:** Cross-domain relational schemas.
* **API Endpoints:** Cross-domain API orchestration.
* **Business Logic:** 10 end-to-end business journeys:
  1. *Tenant Provisioning*
  2. *Employee Hiring & Activation*
  3. *Attendance Punch & Regularization*
  4. *Leave Double-Entry Lifecycle*
  5. *16-Step Payroll Run & Payslips*
  6. *ATS Requisition to Offer*
  7. *Performance Goal to Appraisal*
  8. *Expense Claim to Reimbursement*
  9. *Asset Handover to Exit Recovery*
  10. *Resignation to F&F Settlement*
* **Authorization:** Cross-role workflow state transitions.
* **UI Screens:** Integrated multi-screen workflow wizards.
* **Validation:** Prerequisite stage validation before transition.
* **Audit Logging:** End-to-end journey audit trails.
* **Notifications:** Multi-stage workflow transition emails.
* **Background Jobs:** Automated lifecycle state advancement.
* **Tests:** `scripts/run-acceptance-gate.ts`, `scripts/run-phase2-acceptance-gate.ts`.
* **Acceptance Criteria:** 14 / 14 Acceptance Gates pass cleanly.

---

### Section 32: QA & Acceptance Criteria
* **Database Models:** Test databases and seed fixtures.
* **API Endpoints:** Test runner endpoint suites.
* **Business Logic:** Automated test execution covering Unit, Integration, API, Security, Payroll, and AI test suites.
* **Authorization:** Testing all 7 system roles and cross-tenant boundaries.
* **UI Screens:** Automated browser test specs.
* **Validation:** Assertion validation on test results.
* **Audit Logging:** Test execution report output.
* **Notifications:** CI/CD test failure notifications.
* **Background Jobs:** GitHub Actions CI/CD matrix.
* **Tests:** 20 Test Files (59 Tests) passing in Vitest.
* **Acceptance Criteria:** 100% test pass rate with zero test regressions.

---

### Section 33: Deployment & DevOps
* **Infrastructure:** Docker containerization, Docker Compose, Render, Railway, GitHub Actions CI/CD.
* **API Endpoints:** Health probe endpoints `/api/health`.
* **Business Logic:** Automated database snapshot backups, sandbox restore verification CLI, production deployment runbooks.
* **Authorization:** Deployment access restricted to DevOps team.
* **UI Screens:** Platform Health Dashboard.
* **Validation:** Environment variable schema validation on startup.
* **Audit Logging:** Deployment audit log.
* **Notifications:** Deployment status Slack/Email alerts.
* **Background Jobs:** Automated database backup cron (`scripts/backup-restore.ts`).
* **Tests:** `npm run db:restore:test`.
* **Acceptance Criteria:** Successful automated backup creation and sandbox restore verification.

---

### Section 34: Development Plan / Phases
* **Phases:** Phase 1 (Core HR/Payroll), Phase 2 (Advanced Modules), Phase 3 (Scale, Mobile & Ecosystem Integrations).
* **API Endpoints:** Phased API release versions.
* **Business Logic:** Modular monolithic architecture allowing progressive module activation.
* **Authorization:** Feature flag gates per tenant.
* **UI Screens:** Progressive UI module enabling.
* **Validation:** Feature dependency validation.
* **Audit Logging:** Phase release milestone logs.
* **Notifications:** Release announcements.
* **Background Jobs:** Phase migration scripts.
* **Tests:** Phase 1 & Phase 2 master acceptance gates.
* **Acceptance Criteria:** All Phase 1 and Phase 2 requirements completed and verified.

---

### Section 35: Developer Coding Standards
* **Standards:** TypeScript Strict Mode, layered architecture (`src/lib` vs `src/app`), ESLint rules, Git conventional commits.
* **API Endpoints:** Standard JSON response format `{ success: true, data: { ... } }`.
* **Business Logic:** Pure functional business engines with dependency injection.
* **Authorization:** Middleware-level authorization enforcement.
* **UI Components:** Strict component props typing.
* **Validation:** Zod schemas for all request payloads.
* **Audit Logging:** Standard structured JSON logging with correlation IDs.
* **Notifications:** Standard error alerts.
* **Background Jobs:** Linter CI checks.
* **Tests:** Static analysis and type checking in CI.
* **Acceptance Criteria:** Zero TypeScript `any` types on critical business paths.

---

### Section 36: Open Issues / Future Extensions
* **Future Domains:** Native Mobile Apps, Biometric IoT Hardware Push Adapters, Enterprise SSO (SAML 2.0 / Okta / Azure AD), External E-Sign Providers (DocuSign / Aadhaar eSign).
* **API Endpoints:** Extensible webhook and API adapter contracts.
* **Business Logic:** Provider interface abstractions allowing plug-and-play integrations.
* **Authorization:** External identity token exchange.
* **UI Screens:** Integration Marketplace & Settings.
* **Validation:** Third-party payload verification.
* **Audit Logging:** External integration sync logs.
* **Notifications:** Integration failure alerts.
* **Background Jobs:** External data synchronization workers.
* **Tests:** `tests/integrations-notifications.test.ts`.
* **Acceptance Criteria:** Modular provider abstractions allow future hardware/SaaS drop-ins without core refactoring.

---

### Section 37: Regulatory / Reference Notes
* **Acts & Compliance:** EPF Act 1952, ESI Act 1948, Payment of Gratuity Act 1972, Maternity Benefit Act 2017, Income Tax Act 1961 (Section 115BAC New Regime), Digital Personal Data Protection Act 2023 (DPDP), IT Act 2000 Section 65B.
* **API Endpoints:** Statutory export endpoints (EPF ECR, ESIC Monthly, TDS 24Q).
* **Business Logic:** Parameterized calculation formulas, tax slabs, and statutory ceiling limits stored in versioned rulesets (`StatutoryRuleSet`).
* **Authorization:** `PAYROLL_ADMIN` and `TENANT_ADMIN` only.
* **UI Screens:** Statutory Compliance & Tax Configuration Panels.
* **Validation:** Statutory floor and ceiling validations.
* **Audit Logging:** Statutory ruleset update audit trail.
* **Notifications:** Annual statutory revision reminders.
* **Background Jobs:** Fiscal year-end rollforward processing.
* **Tests:** `tests/payroll-engine.test.ts`, `tests/exit-fnf.test.ts`.
* **Acceptance Criteria:** Strict mathematical compliance with Indian statutory labor laws.
