# AI AUTOMATION LABS HRMS — PRODUCTION DEPLOYMENT & OPERATIONS RUNBOOK
**Document Version:** 1.0.0  
**Target Release:** `v0.1.0-pilot` / `BUILD-COMPLETE-RC0`  
**Reference Specification:** `AI_Automation_Labs_HRMS_10_Day_Execution_Project_Plan(1).pdf`

---

## 1. Production Architecture Overview

The HRMS platform is structured as a full-stack Next.js application that can be deployed on modern cloud hosting platforms (Render, Railway, AWS ECS, or standard Docker hosts) backed by a managed PostgreSQL database.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloud Load Balancer                         │
│                  (HTTPS / SSL Auto-Renewal)                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Next.js 15 Full-Stack Service                   │
│   - App Router Pages & SSR Layouts                              │
│   - REST API Endpoints (/api/*)                                 │
│   - Calculation Engines (Payroll, Attendance, Leave, Docs)      │
│   - JWT Auth, Rate Limiter & Security Headers                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Managed Relational Database                     │
│      - PostgreSQL (Production) / SQLite dev.db (Local)         │
│      - 30+ Relational Tables with Multi-Tenant Isolation        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration

Create a production `.env` file (or configure environment variables in your cloud provider dashboard). **Never commit real secrets to Git.**

### Required Environment Variables

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Web server listening port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://hrms_user:StrongPassword@pg-host:5432/hrms_prod?schema=public` |
| `JWT_SECRET` | Secret key for JWT session tokens | `64-character-random-hex-string` |
| `NEXT_PUBLIC_APP_URL` | Production application base URL | `https://hrms.aiautomationlabs.com` |
| `ENCRYPTION_KEY` | 32-byte key for sensitive data fields | `32-character-random-key` |
| `SMTP_HOST` | Outgoing email server (optional live SMTP) | `email-smtp.ap-south-1.amazonaws.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `AKIA...` |
| `SMTP_PASS` | SMTP password | `Secret...` |
| `SMTP_FROM` | Sender email address | `noreply@aiautomationlabs.com` |

---

## 3. Database Migration & Provisioning Procedure

### Initial Database Setup (Production PostgreSQL)
1. Provision a PostgreSQL instance (v14+) on your cloud provider.
2. Set the `DATABASE_URL` environment variable.
3. Run the Prisma migration deploy command to apply all table schemas without data loss:
   ```bash
   npx prisma migrate deploy
   # OR for initial sync:
   npx prisma db push
   ```
4. Seed the initial tenant and system roles:
   ```bash
   npm run prisma:seed
   ```

---

## 4. Deployment Guides

### Option A: Render (`render.yaml`)
1. Connect the GitHub repository to Render.
2. Select **Blueprint** and reference `render.yaml`.
3. Render automatically executes `npm run render:build` which runs Prisma client generation, schema push, database seed, and `next build`.
4. Add environment variables in the Render dashboard.

### Option B: Railway (`railway.json`)
1. Create a new project on Railway.
2. Add a PostgreSQL plugin.
3. Link the repository. Railway will detect `railway.json` and build using `npm run build`.
4. Set the environment variables in Railway's Variables tab.

### Option C: Standalone Docker Deployment
Build and run the Docker container:
```bash
# 1. Build production image
docker build -t aial-hrms:latest .

# 2. Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env.production \
  --name hrms-app \
  aial-hrms:latest
```

---

## 5. Automated Backup & Disaster Recovery

### Creating a Snapshot Backup
Execute the standalone backup command:
```bash
npm run db:backup
```
- For SQLite: Generates a timestamped `.db` file in `backups/`.
- For PostgreSQL: Executes `pg_dump` and saves timestamped `.sql` in `backups/`.

### Testing Backup Integrity in an Isolated Sandbox
Verify that your backup is valid without touching live data:
```bash
npm run db:restore:test
```
This restores the latest snapshot to an isolated temporary sandbox (`prisma/sandbox_verify.db`), queries record counts across all models, verifies data integrity, and automatically removes the sandbox.

### Emergency Database Restore
To restore from a specific backup snapshot:
```bash
npx tsx scripts/backup-restore.ts restore backups/hrms_backup_YYYY-MM-DD.db
```

---

## 6. Rollback & Emergency Recovery Protocol

In the event of an unexpected runtime defect or bad deployment:

1. **Step 1 — Immediate Service Rollback:**
   - In Render/Railway/Docker, roll back to the previously tagged image (`v0.1.0-pilot`).
2. **Step 2 — Database State Check:**
   - If schema migration caused issues, restore the immediate pre-deployment database backup using `npx tsx scripts/backup-restore.ts restore <pre-deploy-backup>`.
3. **Step 3 — Run Validation Gate:**
   - Verify operational state using:
     ```bash
     npm test
     npm run audit:production
     ```
4. **Step 4 — Escalation Matrix:**
   - Tech Lead / DevOps Owner: Lead Architect
   - Database Admin: Infrastructure Team
   - Business Sign-Off: Product Owner / Founder

---

## 7. Pre-Release Acceptance Checklist

Before granting final production release sign-off:
- [x] All 19 Vitest test suites (57 tests) pass cleanly (`npm test`).
- [x] Phase 1 Core HRMS Acceptance Gate passes (`npm run test:gate`).
- [x] Phase 2 Advanced Modules Acceptance Gate passes (`npx tsx scripts/run-phase2-acceptance-gate.ts`).
- [x] Master Production Audit passes with 0 failures (`npm run audit:production`).
- [x] Database sandbox backup/restore verification passes (`npm run db:restore:test`).
- [x] Zero P0 or P1 defects open.
