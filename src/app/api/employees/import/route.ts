import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import Papa from 'papaparse';

const MAX_ROWS = 2000;

// Normalise a header so "First Name", "first_name", "FIRSTNAME" and "firstName" all match.
const normKey = (h: string) => h.replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Column aliases (already normalised)
const COLS = {
  firstName: ['firstname', 'first', 'givenname'],
  middleName: ['middlename', 'middle'],
  lastName: ['lastname', 'last', 'surname', 'familyname'],
  workEmail: ['workemail', 'email', 'officialemail', 'emailid', 'officeemail'],
  employeeCode: ['employeecode', 'empcode', 'employeeid', 'empid', 'code'],
  personalEmail: ['personalemail'],
  mobilePhone: ['mobilephone', 'mobile', 'phone', 'phonenumber', 'mobilenumber', 'contactnumber'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  joiningDate: ['joiningdate', 'dateofjoining', 'doj', 'joindate', 'startdate'],
  employmentType: ['employmenttype', 'type'],
  legalEntity: ['legalentitycode', 'legalentity', 'company', 'companycode', 'entity'],
  branchCode: ['branchcode', 'branch', 'location', 'locationcode', 'branchlocation'],
  branchName: ['branchname', 'locationname'],
  branchCity: ['branchcity', 'city'],
  branchState: ['branchstate', 'state'],
  department: ['departmentcode', 'department', 'dept', 'deptcode', 'departmentname'],
  designation: ['designationcode', 'designation', 'designationtitle', 'title', 'jobtitle', 'role'],
  annualCtc: ['annualctc', 'ctc', 'annualsalary', 'salary'],
  taxRegime: ['taxregime', 'regime'],
  pan: ['pan', 'pannumber', 'panno'],
  aadhaar: ['aadhaar', 'aadhar', 'aadhaarnumber', 'aadharnumber'],
  uan: ['uan', 'uannumber'],
  bankAccount: ['bankaccount', 'accountnumber', 'bankaccountnumber', 'accountno'],
  bankName: ['bankname', 'bank'],
  ifsc: ['ifsc', 'ifsccode'],
} as const;

type ColKey = keyof typeof COLS;

function getter(row: Record<string, string>) {
  const normalised = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    const nk = normKey(k);
    if (!normalised.has(nk) || !normalised.get(nk)) normalised.set(nk, (v ?? '').toString().trim());
  }
  return (key: ColKey): string => {
    for (const alias of COLS[key]) {
      const v = normalised.get(alias);
      if (v) return v;
    }
    return '';
  };
}

// Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, and anything Date can parse (e.g. "15 Jan 2024").
function parseDate(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return validDate(+m[3], +m[2], +m[1]); // Indian format: day first
  if (/^\d+$/.test(s)) {
    // Excel serial date
    const serial = parseInt(s, 10);
    if (serial > 20000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return null;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function validDate(y: number, mo: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function normGender(g: string): string | null {
  const v = g.trim().toUpperCase();
  if (!v) return null;
  if (v === 'M' || v === 'MALE') return 'MALE';
  if (v === 'F' || v === 'FEMALE') return 'FEMALE';
  return 'OTHER';
}

const EMPLOYMENT_TYPES = ['FULL_TIME', 'CONTRACT', 'INTERN', 'PART_TIME'];

// Turn a free-text name like "Human Resources" into a code like "HUMAN_RESOURCES".
const toCode = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'GENERAL';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'employees:manage')) {
      return forbidden('Only HR or the company owner can bulk import employees.');
    }

    const body = await req.json().catch(() => ({}));
    const csvContent: string = typeof body.csvContent === 'string' ? body.csvContent : '';
    if (!csvContent.trim()) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    const parsed = Papa.parse<Record<string, string>>(csvContent.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    const rows = parsed.data.filter((r) => Object.values(r).some((v) => (v ?? '').toString().trim() !== ''));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found. The first line must be the column headers.' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows (${rows.length}). Import at most ${MAX_ROWS} at a time.` }, { status: 400 });
    }

    const headerKeys = new Set((parsed.meta.fields || []).map(normKey));
    const hasCol = (k: ColKey) => COLS[k].some((a) => headerKeys.has(a));
    const missing = (['firstName', 'lastName', 'workEmail'] as ColKey[]).filter((k) => !hasCol(k));
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required column(s): ${missing.join(', ')}. Found: ${(parsed.meta.fields || []).join(', ') || 'none'}` },
        { status: 400 },
      );
    }

    const tenantId = user.tenantId;
    const [entities, branches, departments, designations, structures, existingEmps] = await Promise.all([
      prisma.legalEntity.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.branchLocation.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.department.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.designation.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.salaryStructure.findMany({ where: { tenantId } }),
      prisma.employee.findMany({ where: { tenantId }, select: { workEmail: true, employeeCode: true } }),
    ]);

    if (entities.length === 0) {
      return NextResponse.json(
        { error: 'Set up your company (legal entity) first on the Employees page, then import.' },
        { status: 400 },
      );
    }

    // Lookup maps keyed by both code and name (upper-cased)
    const entityMap = new Map<string, string>();
    entities.forEach((e) => {
      entityMap.set(e.code.toUpperCase(), e.id);
      entityMap.set(e.name.toUpperCase(), e.id);
    });
    const branchMap = new Map<string, string>();
    branches.forEach((b) => {
      branchMap.set(b.code.toUpperCase(), b.id);
      branchMap.set(b.name.toUpperCase(), b.id);
    });
    const deptMap = new Map<string, string>();
    departments.forEach((d) => {
      deptMap.set(d.code.toUpperCase(), d.id);
      deptMap.set(d.name.toUpperCase(), d.id);
    });
    const desigMap = new Map<string, string>();
    designations.forEach((d) => {
      desigMap.set(d.code.toUpperCase(), d.id);
      desigMap.set(d.title.toUpperCase(), d.id);
    });
    const usedCodes = {
      branch: new Set(branches.map((b) => b.code.toUpperCase())),
      dept: new Set(departments.map((d) => d.code.toUpperCase())),
      desig: new Set(designations.map((d) => d.code.toUpperCase())),
    };
    const uniqueCode = (base: string, used: Set<string>) => {
      let code = base;
      let n = 2;
      while (used.has(code)) code = `${base}_${n++}`;
      used.add(code);
      return code;
    };

    const created = { branches: [] as string[], departments: [] as string[], designations: [] as string[] };

    // Find-or-create helpers. Values may be a code ("ENG") or a name ("Engineering").
    async function resolveBranch(value: string, legalEntityId: string, name: string, city: string, state: string) {
      const key = value.toUpperCase();
      const hit = branchMap.get(key) || (name ? branchMap.get(name.toUpperCase()) : undefined);
      if (hit) return hit;
      const label = name || value;
      const code = uniqueCode(toCode(value), usedCodes.branch);
      const b = await prisma.branchLocation.create({
        data: { tenantId, legalEntityId, name: label, code, city: city || label, state: state || '' },
      });
      branchMap.set(key, b.id);
      branchMap.set(code, b.id);
      branchMap.set(label.toUpperCase(), b.id);
      created.branches.push(`${label} (${code})`);
      return b.id;
    }
    async function resolveDept(value: string) {
      const key = value.toUpperCase();
      const hit = deptMap.get(key);
      if (hit) return hit;
      const code = uniqueCode(toCode(value), usedCodes.dept);
      const d = await prisma.department.create({ data: { tenantId, name: value, code } });
      deptMap.set(key, d.id);
      deptMap.set(code, d.id);
      created.departments.push(`${value} (${code})`);
      return d.id;
    }
    async function resolveDesig(value: string, departmentId: string) {
      const key = value.toUpperCase();
      const hit = desigMap.get(key);
      if (hit) return hit;
      const code = uniqueCode(toCode(value), usedCodes.desig);
      const d = await prisma.designation.create({ data: { tenantId, title: value, code, departmentId } });
      desigMap.set(key, d.id);
      desigMap.set(code, d.id);
      created.designations.push(`${value} (${code})`);
      return d.id;
    }

    // Employee code sequence: continue from the highest existing EMP-YYYY-NNNN number
    const year = new Date().getFullYear();
    const usedEmpCodes = new Set(existingEmps.map((e) => e.employeeCode.toUpperCase()));
    let seq = existingEmps.length;
    for (const e of existingEmps) {
      const m = e.employeeCode.match(/(\d+)$/);
      if (m) seq = Math.max(seq, parseInt(m[1], 10) % 1000000);
    }
    const nextEmpCode = () => {
      let code: string;
      do {
        seq += 1;
        code = `EMP-${year}-${String(seq).padStart(4, '0')}`;
      } while (usedEmpCodes.has(code.toUpperCase()));
      usedEmpCodes.add(code.toUpperCase());
      return code;
    };

    const existingEmails = new Set(existingEmps.map((e) => e.workEmail.toLowerCase()));
    const defaultStructure = structures.find((s) => s.isDefault) || structures[0];

    const errors: { row: number; email?: string; field?: string; message: string }[] = [];
    const successfulEmployees: { id: string; employeeCode: string; displayName: string | null; workEmail: string }[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 for 0-index, +1 for header
      const get = getter(rows[i]);

      const firstName = get('firstName');
      const lastName = get('lastName');
      const email = get('workEmail').toLowerCase();

      if (!firstName || !lastName || !email) {
        errors.push({ row: rowNum, email, message: 'First name, last name and work email are required' });
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        errors.push({ row: rowNum, email, field: 'workEmail', message: 'Work email is not a valid email address' });
        continue;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, email, field: 'workEmail', message: 'Duplicate work email in this file' });
        continue;
      }
      seenEmails.add(email);
      if (existingEmails.has(email)) {
        errors.push({ row: rowNum, email, field: 'workEmail', message: 'An employee with this email already exists' });
        continue;
      }

      const joiningRaw = get('joiningDate');
      const joiningDate = joiningRaw ? parseDate(joiningRaw) : new Date();
      if (!joiningDate) {
        errors.push({ row: rowNum, email, field: 'joiningDate', message: `Invalid joining date "${joiningRaw}" (use YYYY-MM-DD or DD/MM/YYYY)` });
        continue;
      }
      const dobRaw = get('dob');
      const dob = dobRaw ? parseDate(dobRaw) : null;
      if (dobRaw && !dob) {
        errors.push({ row: rowNum, email, field: 'dob', message: `Invalid date of birth "${dobRaw}" (use YYYY-MM-DD or DD/MM/YYYY)` });
        continue;
      }

      const ctcRaw = get('annualCtc').replace(/[,\s₹]/g, '');
      const annualCtc = ctcRaw ? parseFloat(ctcRaw) : NaN;
      if (ctcRaw && (!isFinite(annualCtc) || annualCtc < 0)) {
        errors.push({ row: rowNum, email, field: 'annualCtc', message: `Invalid annual CTC "${get('annualCtc')}"` });
        continue;
      }

      let employeeCode = get('employeeCode');
      if (employeeCode) {
        if (usedEmpCodes.has(employeeCode.toUpperCase())) {
          errors.push({ row: rowNum, email, field: 'employeeCode', message: `Employee code "${employeeCode}" is already in use` });
          continue;
        }
        usedEmpCodes.add(employeeCode.toUpperCase());
      }

      // Organisation mapping
      const entityVal = get('legalEntity');
      let legalEntityId = entityVal ? entityMap.get(entityVal.toUpperCase()) : entities[0].id;
      if (!legalEntityId && entities.length === 1) legalEntityId = entities[0].id; // only one company: use it
      if (!legalEntityId) {
        errors.push({
          row: rowNum,
          email,
          field: 'legalEntityCode',
          message: `Unknown company "${entityVal}". Use one of: ${entities.map((e) => e.code).join(', ')}`,
        });
        continue;
      }

      let branchLocationId: string, departmentId: string, designationId: string;
      try {
        const deptVal = get('department') || (departments[0]?.code ?? 'General');
        departmentId = await resolveDept(deptVal);
        const desigVal = get('designation') || (designations[0]?.code ?? 'Employee');
        designationId = await resolveDesig(desigVal, departmentId);
        const branchVal = get('branchCode') || get('branchName') || (branches[0]?.code ?? 'Head Office');
        branchLocationId = await resolveBranch(branchVal, legalEntityId, get('branchName'), get('branchCity'), get('branchState'));
      } catch (err: any) {
        errors.push({ row: rowNum, email, message: `Could not set up branch/department/designation: ${err.message}` });
        continue;
      }

      if (!employeeCode) employeeCode = nextEmpCode();

      const empType = get('employmentType').toUpperCase().replace(/[\s-]+/g, '_');
      const pan = get('pan').toUpperCase();
      const aadhaar = get('aadhaar').replace(/\s+/g, '');
      const uan = get('uan');
      const bankAccount = get('bankAccount').replace(/\s+/g, '');
      const bankName = get('bankName');
      const taxRegime = get('taxRegime').toUpperCase().replace(/[\s-]+/g, '_');

      try {
        const emp = await prisma.$transaction(async (tx) => {
          const createdEmp = await tx.employee.create({
            data: {
              tenantId,
              employeeCode: employeeCode!,
              firstName,
              middleName: get('middleName') || null,
              lastName,
              displayName: `${firstName} ${lastName}`,
              workEmail: email,
              personalEmail: get('personalEmail') || null,
              mobilePhone: get('mobilePhone') || null,
              gender: normGender(get('gender')),
              dob,
              joiningDate,
              employmentType: EMPLOYMENT_TYPES.includes(empType) ? empType : 'FULL_TIME',
              legalEntityId: legalEntityId!,
              branchLocationId,
              departmentId,
              designationId,
              status: 'ACTIVE',
            },
          });

          if (pan || aadhaar || uan) {
            await tx.employeeIdentity.create({
              data: {
                employeeId: createdEmp.id,
                panNumber: pan || null,
                aadhaarNumber: aadhaar || null,
                uanNumber: uan || null,
              },
            });
          }

          if (bankAccount && bankName) {
            await tx.employeeBank.create({
              data: {
                employeeId: createdEmp.id,
                accountHolderName: `${firstName} ${lastName}`,
                bankName,
                accountNumber: bankAccount,
                ifscCode: get('ifsc').toUpperCase(),
              },
            });
          }

          // Salary assignment only when a CTC was supplied and a salary structure exists
          if (defaultStructure && isFinite(annualCtc) && annualCtc > 0) {
            await tx.employeeSalaryAssignment.create({
              data: {
                tenantId,
                employeeId: createdEmp.id,
                structureId: defaultStructure.id,
                ctc: annualCtc,
                grossSalary: annualCtc / 12,
                netSalary: (annualCtc / 12) * 0.85,
                effectiveFrom: joiningDate,
                taxRegime: taxRegime === 'OLD' || taxRegime === 'OLD_REGIME' ? 'OLD_REGIME' : 'NEW_REGIME',
                isCurrent: true,
              },
            });
          }

          return createdEmp;
        });

        existingEmails.add(email);
        successfulEmployees.push({ id: emp.id, employeeCode: emp.employeeCode, displayName: emp.displayName, workEmail: emp.workEmail });
      } catch (err: any) {
        const msg: string = err?.code === 'P2002' ? 'Duplicate employee code or email' : err?.message || 'Database insert error';
        errors.push({ row: rowNum, email, message: msg });
      }
    }

    await createAuditLog({
      tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'BULK_IMPORT_EMPLOYEES',
      entityType: 'EMPLOYEE',
      afterState: {
        totalRows: rows.length,
        importedCount: successfulEmployees.length,
        failedCount: errors.length,
        created,
      },
    });

    return NextResponse.json({
      success: true,
      totalProcessed: rows.length,
      importedCount: successfulEmployees.length,
      failedCount: errors.length,
      errors,
      created,
      employees: successfulEmployees,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
