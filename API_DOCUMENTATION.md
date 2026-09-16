# REST API DOCUMENTATION (`/api/v1`)
**Project:** AI Automation Labs Multi-Tenant HRMS & SaaS Platform  
**Master Source of Truth:** Master Developer Specification (37 Sections)  
**API Specification:** RESTful JSON with OpenAPI 3.1 Standards  

---

## 1. Authentication & Common Headers

All `/api/v1/*` requests require standard Bearer Authentication or active session cookies.

### Standard Request Headers
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
X-Tenant-ID: <OPTIONAL_OVERRIDE_VALIDATED_SERVER_SIDE>
Idempotency-Key: <UUID_FOR_SAFE_MUTATIONS>
```

### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "requestId": "req_01h7x8...",
    "timestamp": "2026-09-16T10:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 150,
      "totalPages": 8
    }
  }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "User lacks required permission: payroll.run:execute",
    "details": []
  },
  "metadata": {
    "requestId": "req_01h7x8...",
    "timestamp": "2026-09-16T10:00:00.000Z"
  }
}
```

---

## 2. Core API Endpoint Groups

### Authentication & Identity (`/api/auth/*`)
* `POST /api/auth/login` — User authentication with email/password; returns JWT and session cookie.
* `POST /api/auth/logout` — Invalidate user session and clear cookies.
* `POST /api/auth/reset-password` — Request password reset token via email.
* `POST /api/auth/verify-reset-token` — Complete password change using single-use crypto token.

### Employee Management (`/api/v1/employees`)
* `GET /api/v1/employees` — Paginated list of employees with search and department filtering.
* `POST /api/v1/employees` — Create new employee with auto-generated ID, identity, and bank details.
* `GET /api/v1/employees/:id` — Retrieve full employee profile (sensitive data masked for non-authorized roles).
* `PATCH /api/v1/employees/:id` — Update employee demographic and employment records.
* `DELETE /api/v1/employees/:id` — Soft-delete employee profile.

### Attendance & Time Tracking (`/api/v1/attendance`)
* `GET /api/v1/attendance` — Fetch daily attendance records for a specified date range.
* `POST /api/v1/attendance/punch` — Record raw immutable punch event (web/GPS/kiosk).
* `POST /api/attendance/regularize` — Submit attendance correction request for manager approval.

### Leave Management (`/api/v1/leave`)
* `GET /api/v1/leave` — Fetch leave balances, transaction history, and leave requests.
* `POST /api/leave/requests` — Submit a new leave application with policy validation.
* `POST /api/leave/approve` — Line Manager approval/rejection of pending leave requests.

### Payroll & Compliance (`/api/v1/payroll`)
* `GET /api/v1/payroll` — List payroll cycle runs and aggregate cost statistics.
* `POST /api/payroll/runs` — Calculate new 16-step payroll cycle for active employees.
* `POST /api/payroll/runs/:id/lock` — Lock and publish approved payroll cycle; generate payslips.
* `POST /api/payroll/runs/:id/override` — Apply audited manual adjustment with mandatory reason.
* `GET /api/payroll/payslips/:id` — Retrieve printable and downloadable payslip data.

### Recruitment / ATS (`/api/recruitment/*`)
* `GET /api/recruitment/requisitions` — List active job openings and candidate pipeline counts.
* `POST /api/recruitment/candidates` — Create candidate profile with resume upload and AI match scoring.
* `POST /api/recruitment/interviews` — Schedule candidate interview with scorecard.
* `POST /api/recruitment/offers` — Generate formal job offer with salary structure breakdown.

### Document Management & E-Sign (`/api/documents/*`)
* `GET /api/documents/templates` — List versioned document templates.
* `POST /api/documents/generate` — Generate merge-tagged HR letter from template.
* `POST /api/documents/sign` — Capture canvas signature strokes and apply SHA-256 digital certificate.

### Performance Management (`/api/performance/*`)
* `GET /api/performance/cycles` — List active appraisal review cycles.
* `POST /api/performance/goals` — Define OKRs and assign weighted scoring.
* `POST /api/performance/appraisals` — Submit self, manager, or 360 review ratings.

### Expense Management (`/api/expenses/*`)
* `GET /api/expenses/claims` — List submitted expense claims and receipt attachments.
* `POST /api/expenses/claims` — Submit new expense claim with category and receipt URL.
* `POST /api/expenses/approve` — L1 Manager or L2 Finance approval/rejection.

### Asset Management (`/api/assets/*`)
* `GET /api/assets` — Hardware and software asset inventory registry.
* `POST /api/assets/assign` — Allocate asset to employee with condition log.
* `POST /api/assets/return` — Process asset return inspection.

### Exit & Full and Final (`/api/exit/*`)
* `POST /api/exit/requests` — Employee resignation submission.
* `POST /api/exit/clearances` — IT, Admin, and Finance departmental clearance sign-offs.
* `GET /api/exit/fnf` — Compute Statutory Gratuity Act 1972 and generate F&F statement.

### AI Assistant & Co-Pilot (`/api/ai/*`)
* `POST /api/ai/assistant` — Query employee assistant for PTO balances and payslip explanations.
* `POST /api/ai/copilot` — HR Co-Pilot for natural language company policies and workforce analytics.

### Webhooks Subsystem (`/api/webhooks/*`)
* `GET /api/webhooks/subscriptions` — List registered webhook URLs and subscribed event types.
* `POST /api/webhooks/subscriptions` — Register new webhook endpoint with shared HMAC secret.
* `POST /api/webhooks/test` — Dispatch test ping event with HMAC-SHA256 signature.

### SaaS Super Admin (`/api/super-admin/*`)
* `GET /api/super-admin/tenants` — Fleet-wide tenant directory and health status.
* `POST /api/super-admin/impersonate` — Start audited support impersonation session.
