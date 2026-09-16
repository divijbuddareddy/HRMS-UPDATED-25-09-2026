# AI AUTOMATION LABS HRMS — ARCHITECTURAL DECISION LOG (ADR)
**Project:** AI Automation Labs HRMS  
**Version:** 1.0.0  
**Date:** September 15, 2026  
**Reference Document:** `AI_Automation_Labs_HRMS_10_Day_Execution_Project_Plan(1).pdf`

---

## 1. Context & Objectives

This Decision Log captures the key architectural decisions, rationale, and operational constraints governing the implementation of the AI Automation Labs HRMS platform during the 10-day execution sprint.

---

## 2. Record of Architectural Decisions

### ADR-001: Next.js 15 Monolithic App Router Architecture
- **Decision:** Build as a unified Next.js 15 full-stack application with TypeScript, React 19, Tailwind CSS, and Prisma ORM.
- **Rationale:** Minimizes operational complexity for small teams, eliminates microservice network overhead, guarantees fast development iterations, and provides seamless server-side API routes alongside client components.
- **Status:** APPROVED & ACTIVE.

### ADR-002: Strict Multi-Tenant Schema-Level Boundary Isolation
- **Decision:** Every database table (with the exception of global system lookup tables) MUST include a foreign key `tenantId` linked to `Tenant.id` with cascading deletes.
- **Rationale:** Ensures strict tenant isolation and prevents cross-tenant data leaks.
- **Status:** APPROVED & ACTIVE.

### ADR-003: Double-Entry Ledger for Leave Balances
- **Decision:** Do NOT maintain mutable balance counters that are updated in-place. Instead, maintain an immutable transaction table `LeaveLedger` recording `OPENING`, `ACCRUAL`, `CONSUMPTION`, `REVERSAL`, and `ADJUSTMENT`. Current balance is derived dynamically as `SUM(days)`.
- **Rationale:** Eliminates reconciliation drift, guarantees an audit trail for every leave transaction, and satisfies statutory compliance.
- **Status:** APPROVED & ACTIVE.

### ADR-004: Parameterized Indian Statutory Payroll Engine
- **Decision:** Store statutory contribution rules (EPF, ESI, Professional Tax, TDS slabs) in versioned configuration objects (`DEFAULT_STATUTORY_CONFIG` & `StatutoryRuleSet`), rather than hardcoding numbers throughout application code.
- **Rationale:** Indian tax rules and wage ceilings update annually. Parameterization allows seamless updates without touching core calculation algorithms.
- **Status:** APPROVED & ACTIVE.

### ADR-005: Deterministic Payroll Lifecycle & Immutability Lock
- **Decision:** Payroll runs transition through a strict state machine: `DRAFT` → `CALCULATED` → `REVIEW` → `APPROVED` → `LOCKED` → `PUBLISHED`.
- **Rationale:** Once marked `LOCKED`, the system permanently prevents silent recalculation or modifications to payslips, ensuring banking and tax integrity.
- **Status:** APPROVED & ACTIVE.

### ADR-006: Cryptographic SHA-256 Checksum for Legal Documents
- **Decision:** Calculate and store a SHA-256 hash of the rendered HTML content for all generated employment letters (Offer Letter, Appointment Letter, Relieving Letter) and bind it to digital signature strokes.
- **Rationale:** Guarantees tamper-evident document integrity without requiring expensive proprietary e-sign vendor lock-in for internal workflows.
- **Status:** APPROVED & ACTIVE.

### ADR-007: Safe Sandbox Database Backup & Restore Automation
- **Decision:** Implement database backup snapshots and automated verification in an isolated temporary sandbox (`sandbox_verify.db`), ensuring zero risk to the primary development or production database.
- **Rationale:** Satisfies Day 0, Day 7, and Day 10 disaster recovery criteria safely.
- **Status:** APPROVED & ACTIVE.
