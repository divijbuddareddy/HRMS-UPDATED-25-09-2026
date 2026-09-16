# DEPLOYMENT & DEVOPS RUNBOOK
**Project:** AI Automation Labs Multi-Tenant HRMS & SaaS Platform  
**Master Source of Truth:** Master Developer Specification (37 Sections)  
**Target Environments:** Docker, Docker Compose, Render, Railway, AWS ECS  

---

## 1. Environment Variables Configuration

Create a `.env` file from `.env.example` with the following production keys:

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Database Connection (PostgreSQL 16)
DATABASE_URL="postgresql://hrms_user:SecurePassword2026@postgres:5432/hrms_production?schema=public&sslmode=prefer"

# Authentication & Security Secrets
JWT_SECRET="e98a31c51478f2...[GENERATE_64_CHAR_HEX_KEY]"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
COOKIE_SECRET="7a1b3c9f20e4..."

# Redis & BullMQ Queues
REDIS_URL="redis://:RedisPassword2026@redis:6379"

# Object Storage (S3 / Cloudflare R2)
S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="<ACCESS_KEY>"
S3_SECRET_ACCESS_KEY="<SECRET_KEY>"
S3_BUCKET_NAME="ai-automation-labs-hrms-storage"
S3_REGION="auto"

# AI Gateway
OPENAI_API_KEY="sk-proj-..."
AI_MODEL="gpt-4o-mini"
```

---

## 2. Docker Production Deployment

### Building the Production Docker Image
```bash
docker build -t ai-automation-labs-hrms:latest .
```

### Running with Docker Compose
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 3. Database Migration & Automated Seed

```bash
# Execute production database migrations
npx prisma migrate deploy

# Seed production tenant configurations and default statutory rulesets
npx tsx scripts/seed.ts
```

---

## 4. Automated Backup & Disaster Recovery Verification

The platform includes an automated backup and sandbox restore verification CLI tool (`scripts/backup-restore.ts`):

```bash
# Run automated backup and sandbox restore test
npm run db:restore:test
```

### Automated Backup Strategy
* **Daily Full Backups:** Compressed database snapshot created daily at 02:00 UTC and replicated to off-site cloud storage.
* **Point-in-Time Recovery (PITR):** Write-Ahead Logging (WAL) enabled on PostgreSQL providing sub-5-minute recovery granularity.
* **RPO / RTO Targets:** Recovery Point Objective (RPO) $< 1\text{ hour}$; Recovery Time Objective (RTO) $< 4\text{ hours}$.
