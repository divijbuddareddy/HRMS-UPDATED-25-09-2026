# SYSTEM ARCHITECTURE & DATA FLOW
**Project:** AI Automation Labs Multi-Tenant HRMS & SaaS Platform  
**Master Source of Truth:** Master Developer Specification (37 Sections)  

---

## 1. High-Level Modular Monolith Architecture

The platform is designed as a **clean, modular monolith** utilizing Next.js 15 App Router, React Server Components (RSC), and Prisma ORM.

```mermaid
graph TD
    Client[Web Browser / Mobile Viewport] -->|HTTPS / TLS 1.3| NextJS[Next.js 15 Application Server]
    
    subgraph NextJS [Next.js 15 Application Server]
        Middleware[Auth & Tenant Middleware]
        AppRouter[App Router / SSR Pages]
        APIRouter[REST API Router /api/v1]
        
        subgraph DomainEngine [Domain Business Logic - src/lib]
            RBACEngine[RBAC & Scope Engine]
            PayrollEngine[16-Step Payroll Engine]
            AttendanceEngine[Attendance & Punch Engine]
            LeaveEngine[Double-Entry Leave Ledger]
            ATSEngine[ATS & Candidate Pipeline]
            OnboardingEngine[Onboarding Checklist Engine]
            DocEngine[Document & E-Sign Engine]
            PerfEngine[Performance & OKR Engine]
            ExpenseEngine[Dual-Tier Expense Engine]
            AssetEngine[Asset Lifecycle Engine]
            ExitEngine[Exit & Gratuity Engine]
            AIGateway[AI Gateway & RAG Engine]
            WebhookEngine[HMAC Webhook Dispatcher]
            AuditEngine[Before/After Audit Logger]
        end
    end
    
    NextJS -->|Prisma ORM Client| DB[(PostgreSQL 16 / SQLite Database)]
    NextJS -->|Cache & Rate Limit| Redis[(Redis / BullMQ Cache & Queues)]
    NextJS -->|Signed URLs| ObjectStorage[(S3 / R2 Object Storage)]
    AIGateway -->|Context Gated API| LLM[LLM Provider / Embeddings]
    WebhookEngine -->|Signed HTTPS POST| ExternalHooks[Tenant Webhook Receivers]
```

---

## 2. Request Lifecycle & Security-First Middleware Pipeline

Every HTTP request must pass through an immutable, multi-stage security pipeline before reaching business logic:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> Stage1[1. Rate Limiting Check]
    Stage1 -->|Pass| Stage2[2. Authentication JWT Verification]
    Stage2 -->|Valid Token| Stage3[3. Server-Side Tenant Resolution]
    Stage3 --> Stage4[4. RBAC Permission String Check]
    Stage4 -->|Authorized| Stage5[5. Data Scope Hierarchy Check]
    Stage5 --> Stage6[6. Payload Validation via Zod Schema]
    Stage6 -->|Valid| Stage7[7. Domain Engine Execution]
    Stage7 --> Stage8[8. Database Transaction via Prisma]
    Stage8 --> Stage9[9. Immutable Audit Log Write]
    Stage9 --> Resp[JSON Response with Correlation ID]
    
    Stage1 -->|Exceeded| Block1[429 Rate Limit Exceeded]
    Stage2 -->|Invalid| Block2[401 Unauthorized]
    Stage4 -->|Denied| Block3[403 Forbidden]
    Stage5 -->|Out of Scope| Block4[403 Scope Violation]
    Stage6 -->|Invalid Payload| Block5[400 Bad Request]
```

---

## 3. Multi-Tenant Data Isolation Architecture

Logical tenant isolation is strictly enforced at every level of the application stack:

1. **Database Layer:** Every tenant-owned entity includes a mandatory `tenant_id` foreign key with composite indexing (`@@index([tenant_id])`).
2. **Prisma Client Middleware:** Data access queries automatically scope all operations (`findMany`, `create`, `update`, `delete`) using the authenticated user's `tenant_id`.
3. **Storage Isolation:** S3 storage keys are partitioned by tenant: `/tenants/{tenant_id}/{module}/{year}/{file_id}`.
4. **Cache & Queues:** Redis cache keys and BullMQ job payloads are namespaced: `tenant:{tenant_id}:{key}`.
5. **AI Gateway:** Embeddings and document retrieval strictly filter vectors by `tenant_id`.

---

## 4. Domain Engine Interoperability

```mermaid
sequenceDiagram
    autonumber
    actor Employee
    actor Manager
    participant App as Web Dashboard
    participant API as Route Handlers
    participant Attendance as Attendance Engine
    participant Leave as Leave Ledger
    participant Payroll as Payroll Engine
    participant Audit as Audit System

    Employee->>App: Submits 2-Day Leave Request
    App->>API: POST /api/leave/requests
    API->>Leave: Validate Balance & Deduct Provisional
    Leave-->>API: Request Created (PENDING)
    
    Manager->>App: Approves Leave Request
    App->>API: POST /api/leave/approve
    API->>Leave: Commit Debit Transaction (ACCRUAL -> CONSUMPTION)
    Leave->>Attendance: Mark DailyAttendanceRecord as ON_LEAVE
    Leave->>Audit: Write Leave Approval Audit Entry
    
    Note over Payroll: End-of-Month Payroll Cycle Run
    Payroll->>Attendance: Fetch Monthly Payable Days & LOP Absences
    Payroll->>Leave: Fetch Approved Paid Leaves & Encashments
    Payroll->>Payroll: Execute 16-Step Statutory Calculation (EPF/ESI/TDS)
    Payroll->>Audit: Lock Payroll Run & Generate Immutable Payslips
```
