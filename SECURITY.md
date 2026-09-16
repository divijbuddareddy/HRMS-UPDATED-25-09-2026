# SECURITY & PRIVACY SPECIFICATION
**Project:** AI Automation Labs Multi-Tenant HRMS & SaaS Platform  
**Master Source of Truth:** Master Developer Specification (37 Sections)  
**Security Standard:** Zero-Trust, Defense-in-Depth, OWASP Top 10 Compliance  

---

## 1. Authentication & Session Management

* **Password Security:** All passwords are encrypted using `bcrypt` with a work factor of 10+ rounds. Plaintext passwords are never logged, cached, or returned in API responses.
* **Token Architecture:** Authentication utilizes HMAC-SHA256 signed JWTs stored in `httpOnly`, `secure`, `SameSite=Lax` cookies with strict expiration (15-minute access token, 7-day refresh token).
* **Single-Use Password Reset:** Reset tokens are generated using cryptographically secure random bytes (`crypto.randomBytes(32)`), hashed in the database, valid for 15 minutes, and invalidated immediately upon first consumption.
* **Brute-Force & Rate Limiting:** Dynamic sliding-window rate limiter restricts public auth endpoints to a maximum of 5 failed attempts per IP address in a 15-minute window before triggering temporary account lockouts.

---

## 2. Role-Based Access Control (RBAC) & Data Scopes

The platform enforces a dual-layered authorization model:

### Layer 1: Granular String Permissions
Every action requires an explicit machine-readable permission key:
* `employee.profile:read`
* `employee.profile:write`
* `attendance.punch:record`
* `leave.request:approve`
* `payroll.run:execute`
* `payroll.run:override`
* `documents.template:write`
* `super_admin.tenant:manage`

### Layer 2: Hierarchical Data Scopes
Permissions are evaluated in the context of the user's data boundary:
* `OWN` — Actor can only view/modify their own personal records.
* `DIRECT_REPORTS` — Line managers can only view/approve records belonging to their assigned direct subordinates.
* `DEPARTMENT` — Department heads can access records within their assigned department branch.
* `ENTIRE_TENANT` — HR Managers and Tenant Admins have organization-wide visibility within their tenant.

---

## 3. Sensitive PII Protection & Field-Level Masking

Government identity numbers, bank account numbers, and compensation breakdowns are classified as sensitive PII and are automatically masked for non-authorized viewers:

* **PAN:** Masked as `••••••••1A` (Only last 2 characters visible).
* **Aadhaar:** Masked as `••••••••1234` (Only last 4 digits visible).
* **Bank Account:** Masked as `••••••••5678` (Only last 4 digits visible).
* **CTC / Salary:** Redacted completely (`₹••••••`) unless the actor holds `payroll.salary:view_sensitive` permissions.

---

## 4. Multi-Tenant Cryptographic & Logical Isolation

* **Tenant Resolution:** The tenant context is strictly derived from the authenticated JWT session on the server. Client-provided `tenant_id` headers or body parameters are ignored or validated for exact match.
* **Database Queries:** Every query executed via Prisma ORM includes mandatory `where: { tenantId }` filtering.
* **Adversarial Verification:** Automated test suites (`tests/tenant-isolation.test.ts`) actively attempt cross-tenant IDOR access, ensuring zero cross-tenant leakage.

---

## 5. Tamper-Evident Audit Logging

All state-mutating operations across the platform are captured in an immutable `AuditLog` table:
* **Captured Fields:** `id`, `tenantId`, `actorId`, `ipAddress`, `action`, `entityName`, `entityId`, `beforeState` (JSON diff), `afterState` (JSON diff), `timestamp`.
* **Immutability:** Audit records cannot be updated or deleted via API endpoints.
