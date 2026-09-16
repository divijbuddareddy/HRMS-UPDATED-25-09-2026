# AI Automation Labs — Multi-Tenant HRMS & SaaS Platform

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-indigo.svg)](https://www.prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-cyan.svg)](https://tailwindcss.com)
[![Vitest](https://img.shields.io/badge/Vitest-3.2-yellow.svg)](https://vitest.dev)
[![Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()

> A full-stack, enterprise-grade, multi-tenant Human Resource Management System (HRMS) and SaaS platform engineered according to the **37-Section Master Developer Specification**.

---

## 🌟 Key Features

* **Multi-Tenant SaaS Architecture:** Logical tenant isolation via `tenant_id` foreign keys, 30-day trial quotas, subscription tiers (Starter, Growth, Enterprise), and audited support impersonation.
* **Granular RBAC & Data Scopes:** 7 system roles (`SUPER_ADMIN`, `SUPPORT_ADMIN`, `TENANT_ADMIN`, `HR_MANAGER`, `PAYROLL_ADMIN`, `LINE_MANAGER`, `EMPLOYEE`), granular string permissions (`module.resource:action`), and dynamic data filtering (`OWN`, `DIRECT_REPORTS`, `DEPARTMENT`, `ENTIRE_TENANT`).
* **Organization & Employee Master:** Hierarchical organization structure (Legal Entities, Branches, Departments, Designations, Grades), pattern-based Employee ID engine (`{COMPANY}-{BRANCH}-{YEAR}-{SEQ:4}`), and dynamic custom fields.
* **Attendance & Time Management:** Immutable punch event sourcing, shift policies, 15-minute grace windows, overtime, and manager regularization approval workflows.
* **Double-Entry Leave Ledger:** Immutable debit/credit ledger (`ACCRUAL`, `CONSUMPTION`, `ENCASHMENT`, `LAPSE`), 8 standard leave types (CL, SL, EL, ML, PL, CO, LOP, WFH), and sandwich rule enforcement.
* **Deterministic Payroll & Statutory Compliance:** Parameterized 16-step calculation pipeline: EPF (12% with ₹15,000 ceiling), ESI (0.75%/3.25% with ₹21,000 ceiling), Professional Tax state slabs, TDS (Old vs New Regime 115BAC), payroll locking, and printable payslips.
* **Recruitment & ATS:** Job requisitions, candidate pipeline Kanban, AI resume match scoring, interview scheduling, and offer letter generation.
* **Employee Onboarding Playbook:** Department/role task checklists, pre-boarding document collection, HR verification gates, and automated employee activation.
* **Document Management & E-Signature:** Versioned HR letter templates with merge tags, canvas stroke capture, and built-in SHA-256 tamper-evident digital signatures.
* **Performance Management (OKRs & 360 Reviews):** Review cycles, weighted goal calculations, self/manager appraisals, and calibrated ratings (1.0 to 5.0).
* **Expense Management:** Multi-category claims, receipt attachments, dual-tier approval (L1 Manager → L2 Finance), and direct payroll reimbursement integration.
* **Asset Management:** IT hardware/software inventory, serial tracking, allocation and return history, condition inspection, and exit clearance recovery.
* **Exit Management & Full & Final (F&F):** Resignation workflow, 3-tier departmental clearances (IT, Admin, Finance), Statutory Gratuity Act 1972 calculation ($15 \times \text{Basic} \times \frac{\text{Years}}{26}$), and F&F statement generation.
* **AI Layer & Co-Pilot:** Assistive Employee Assistant (leave/payslip Q&A), HR Co-Pilot (policy RAG, headcount queries), ATS Resume Matcher, RBAC context enforcement, and human-in-the-loop confirmation prompts.
* **API & Webhooks:** RESTful `/api/v1` endpoints with Bearer auth, HMAC-SHA256 signed webhooks, and delivery audit logs.
* **Security & Auditability:** AES-256 encryption at rest, TLS 1.3 in transit, sliding-window rate limiting, timing-safe authentication, and immutable audit logs capturing complete JSON diffs.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Server Actions, Route Handlers) |
| **Language** | TypeScript 5.8 (Strict Mode) |
| **Styling** | Tailwind CSS 3.4, Lucide Icons, Headless UI |
| **ORM & Database** | Prisma ORM 6.4 + PostgreSQL (production) / SQLite (sandbox/local) |
| **Authentication** | HMAC-SHA256 signed JWTs with httpOnly cookies & Bcrypt hashing |
| **Testing** | Vitest 3.2.7 + Custom Master Acceptance Gate Test Suites |
| **Containerization** | Docker, Docker Compose, Multi-stage production build |

---

## 🚀 Quick Start

### 1. Prerequisites
* Node.js 18.x or 20.x
* npm 9+ or pnpm 8+

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/divijbuddareddy/HRMS-UPDATED-15-09-2026.git
cd HRMS-UPDATED-15-09-2026

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

### 4. Database Setup & Seeding
```bash
# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma db push

# Seed master multi-tenant data & demo accounts
npm run db:seed
```

### 5. Running the Application
```bash
# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Execute all test suites and master acceptance gates:

```bash
# Run all 20 Vitest test suites (59 tests)
npm test

# Run Phase 1 Core Acceptance Gate (6/6 Gates)
npx tsx scripts/run-acceptance-gate.ts

# Run Phase 2 Advanced Modules Acceptance Gate (8/8 Gates)
npx tsx scripts/run-phase2-acceptance-gate.ts

# Run Complete Production Readiness Audit (12/12 Gates)
npx tsx scripts/run-production-audit.ts

# Verify Database Backup & Sandbox Restore
npm run db:restore:test
```

---

## 👥 Default Demo Credentials

| Role | Email | Password | Scope / Permissions |
|---|---|---|---|
| **Super Admin** | `superadmin@aiautomationlabs.com` | `Super@Admin2026!` | Platform Scope: All Tenants & Impersonation |
| **Tenant Admin** | `admin@acme.com` | `Admin@Acme2026!` | Tenant Scope: Full Acme Corp Administration |
| **HR Manager** | `hr@acme.com` | `HR@Acme2026!` | Org Master, Employees, ATS, Onboarding, Documents |
| **Payroll Admin** | `payroll@acme.com` | `Payroll@Acme2026!` | Salary Structures, Payroll Runs, TDS, Payslips |
| **Line Manager** | `manager@acme.com` | `Manager@Acme2026!` | Team Attendance, Leave Approval, L1 Expenses, Reviews |
| **Employee** | `employee@acme.com` | `Emp@Acme2026!` | Self-Service Punch, Leave Requests, Payslips, Claims |

---

## 📚 Documentation Index

* [`PROJECT_IMPLEMENTATION_PLAN.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/PROJECT_IMPLEMENTATION_PLAN.md) — 37-Section Implementation Plan
* [`IMPLEMENTATION_GAP_REPORT.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/IMPLEMENTATION_GAP_REPORT.md) — Complete Gap Analysis Matrix
* [`ACCEPTANCE_TEST_REPORT.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/ACCEPTANCE_TEST_REPORT.md) — Master Acceptance Test Results
* [`ARCHITECTURE.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/ARCHITECTURE.md) — System Architecture & Data Flow
* [`API_DOCUMENTATION.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/API_DOCUMENTATION.md) — REST API `/api/v1` Documentation
* [`DATABASE_DOCUMENTATION.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/DATABASE_DOCUMENTATION.md) — Prisma Schema & ERD
* [`SECURITY.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/SECURITY.md) — RBAC, Isolation & Encryption Specifications
* [`DEPLOYMENT.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/DEPLOYMENT.md) — Docker & Production Deployment Manual
* [`TESTING.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/TESTING.md) — Testing Strategy & Acceptance Criteria
* [`AI_ARCHITECTURE.md`](file:///c:/Users/divij/OneDrive/Desktop/HRMS/AI_ARCHITECTURE.md) — AI Gateway, RAG & Safety Guardrails
