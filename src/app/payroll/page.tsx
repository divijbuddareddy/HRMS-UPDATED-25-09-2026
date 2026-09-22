'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Banknote,
  Calculator,
  Lock,
  CheckCircle,
  FileSpreadsheet,
  Edit3,
  ShieldCheck,
  Building,
  Printer,
  X,
  TrendingUp,
  AlertCircle,
  Download,
  FileText,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { downloadPayslipPDF } from '@/lib/payroll/payslip-pdf';

export default function PayrollPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [structures, setStructures] = useState<any[]>([]);
  const [statutoryRules, setStatutoryRules] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'RUNS' | 'STRUCTURES' | 'STATUTORY'>('RUNS');
  const [loading, setLoading] = useState(true);

  // Month / year selector
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [calculating, setCalculating] = useState(false);

  // Override modal
  const [overrideItem, setOverrideItem] = useState<any | null>(null);
  const [overrideComp, setOverrideComp] = useState('SPECIAL_ALLOWANCE');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Create Structure modal
  const [isCreateStructureOpen, setIsCreateStructureOpen] = useState(false);
  const [creatingStructure, setCreatingStructure] = useState(false);
  const [structureForm, setStructureForm] = useState({
    name: '',
    code: '',
    description: '',
    isDefault: false,
    components: [
      { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * CTC' },
      { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * BASIC' },
      { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA' },
      { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
      { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '200' },
      { name: 'Provident Fund (Employer)', code: 'PF_ER', componentType: 'EMPLOYER_CONTRIBUTION', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
    ],
  });

  const handleAddComponent = () => {
    setStructureForm({
      ...structureForm,
      components: [
        ...structureForm.components,
        {
          name: 'Custom Allowance',
          code: `ALLOWANCE_${structureForm.components.length + 1}`,
          componentType: 'EARNING',
          calculationType: 'FORMULA',
          valueOrFormula: '0.05 * CTC',
        },
      ],
    });
  };

  const handleRemoveComponent = (idx: number) => {
    setStructureForm({
      ...structureForm,
      components: structureForm.components.filter((_, i) => i !== idx),
    });
  };

  const handleUpdateComponent = (idx: number, field: string, val: any) => {
    const updated = [...structureForm.components];
    updated[idx] = { ...updated[idx], [field]: val };
    setStructureForm({ ...structureForm, components: updated });
  };

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStructure(true);
    try {
      const res = await fetch('/api/payroll/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(structureForm),
      });
      if (res.ok) {
        setIsCreateStructureOpen(false);
        setStructureForm({
          name: '',
          code: '',
          description: '',
          isDefault: false,
          components: [
            { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * CTC' },
            { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * BASIC' },
            { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA' },
            { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
            { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '200' },
            { name: 'Provident Fund (Employer)', code: 'PF_ER', componentType: 'EMPLOYER_CONTRIBUTION', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
          ],
        });
        await fetchPayroll();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create salary structure');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingStructure(false);
    }
  };

  // Payslip modal
  const [viewPayslip, setViewPayslip] = useState<any | null>(null);

  const handleDownloadPDF = (item: any) => {
    const earningsBreakdown = JSON.parse(item.earningsBreakdown || '{}');
    const deductionsBreakdown = JSON.parse(item.deductionsBreakdown || '{}');
    downloadPayslipPDF({
      companyName: 'AI AUTOMATION LABS LLP',
      companyAddress: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
      companyTaxInfo: 'PAN: AAACA1234F | GSTIN: 29AAACA1234F1Z5 | TAN: BLRA12345B',
      payslipNumber: item.payslip?.payslipNumber || `PS-${selectedRun?.cycle?.year || runYear}${String(selectedRun?.cycle?.month || runMonth).padStart(2, '0')}-${item.employee?.employeeCode}`,
      month: selectedRun?.cycle?.month || runMonth,
      year: selectedRun?.cycle?.year || runYear,
      employee: {
        firstName: item.employee?.firstName || '',
        lastName: item.employee?.lastName || '',
        employeeCode: item.employee?.employeeCode || '',
        designation: item.employee?.designation?.title || 'Engineer',
        department: item.employee?.department?.name || 'Engineering',
        dateOfJoining: item.employee?.dateOfJoining ? new Date(item.employee.dateOfJoining).toLocaleDateString('en-IN') : '01-Apr-2024',
        bankName: item.employee?.bank?.bankName || 'HDFC Bank',
        accountNumber: item.employee?.bank?.accountNumber ? `XXXXXX${item.employee.bank.accountNumber.slice(-4)}` : 'XXXXXX4321',
        ifscCode: item.employee?.bank?.ifscCode || 'HDFC0001234',
        panNumber: item.employee?.identity?.panNumber || 'ABCDE1234F',
        uanNumber: item.employee?.identity?.uan || '101234567890',
        taxRegime: item.taxRegime || 'NEW',
      },
      payableDays: item.payableDays || 30,
      lopDays: item.lopDays || 0,
      earningsBreakdown,
      deductionsBreakdown,
      grossEarnings: item.grossEarnings || 0,
      totalDeductions: item.totalDeductions || 0,
      netSalary: item.netSalary || 0,
    });
  };

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const [rRes, sRes, stRes] = await Promise.all([
        fetch('/api/payroll/runs'),
        fetch('/api/payroll/structures'),
        fetch('/api/payroll/statutory-rules'),
      ]);

      if (rRes.ok) {
        const rData = await rRes.json();
        setRuns(rData.runs || []);
        if (rData.runs?.[0]) setSelectedRun(rData.runs[0]);
      }
      if (sRes.ok) setStructures((await sRes.json()).structures || []);
      if (stRes.ok) setStatutoryRules(await stRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, []);

  const handleRunPayroll = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: runMonth, year: runYear }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchPayroll();
        setSelectedRun(data.run);
      } else {
        alert(data.error || 'Payroll calculation failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleAction = async (action: 'APPROVE' | 'LOCK' | 'PUBLISH') => {
    if (!selectedRun) return;
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchPayroll();
      } else {
        const d = await res.json();
        alert(d.error || `Failed to ${action.toLowerCase()} payroll run`);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideItem) return;
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRun.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollItemId: overrideItem.id,
          componentCode: overrideComp,
          newAmount: overrideAmount,
          reason: overrideReason,
        }),
      });
      if (res.ok) {
        setOverrideItem(null);
        await fetchPayroll();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save component override');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <DashboardLayout title="Payroll & Indian Statutory Compliance" subtitle="Deterministic calculation, EPF/ESI/PT/TDS compliance, lock and payslips">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('RUNS')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'RUNS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Payroll Runs & Payslips
          </button>
          <button
            onClick={() => setActiveTab('STRUCTURES')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'STRUCTURES' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Salary Structures
          </button>
          <button
            onClick={() => setActiveTab('STATUTORY')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'STATUTORY' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Indian Statutory Rules (EPF/ESI/PT/TDS)
          </button>
        </div>

        {/* Tab 1: Runs & Payslips */}
        {activeTab === 'RUNS' && (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Cycle:</span>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(parseInt(e.target.value))}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={runYear}
                    onChange={(e) => setRunYear(parseInt(e.target.value))}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>

                <button
                  disabled={calculating}
                  onClick={handleRunPayroll}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {calculating ? 'Calculating...' : 'Run / Recalculate Payroll'}
                </button>
              </div>

              {selectedRun && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      selectedRun.status === 'LOCKED' || selectedRun.status === 'PUBLISHED'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : selectedRun.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedRun.status}
                  </span>

                  {selectedRun.status === 'CALCULATED' && (
                    <button
                      onClick={() => handleAction('APPROVE')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg"
                    >
                      Approve Run
                    </button>
                  )}

                  {selectedRun.status === 'APPROVED' && (
                    <button
                      onClick={() => handleAction('LOCK')}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium rounded-lg flex items-center gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Lock & Generate Payslips
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Run Financial Summary Cards */}
            {selectedRun && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Employees</span>
                  <span className="text-2xl font-bold text-slate-900">{selectedRun.totalEmployees}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Processed in batch</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Gross Pay</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatINR(selectedRun.totalGrossPay)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Earnings</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Deductions</span>
                  <span className="text-2xl font-bold text-rose-600">{formatINR(selectedRun.totalDeductions)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">PF + ESI + PT + TDS</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs text-slate-500 block">Total Net Payout</span>
                  <span className="text-2xl font-bold text-purple-700">{formatINR(selectedRun.totalNetPay)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Bank transfer total</span>
                </div>
              </div>
            )}

            {/* Payroll Calculation Register Table */}
            {selectedRun && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800">
                    Cycle {selectedRun.cycle?.month}/{selectedRun.cycle?.year} Register
                  </span>
                  <span className="text-slate-500 font-mono">Formula & Statutory Compliant</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Payable Days</th>
                        <th className="py-3 px-4">Gross Earned</th>
                        <th className="py-3 px-4">PF (EE)</th>
                        <th className="py-3 px-4">PT</th>
                        <th className="py-3 px-4">TDS (Tax)</th>
                        <th className="py-3 px-4">Net Salary</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedRun.items?.map((item: any) => {
                        const deductions = JSON.parse(item.deductionsBreakdown || '{}');
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 font-sans">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {item.employee?.firstName} {item.employee?.lastName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {item.employee?.employeeCode} • {item.taxRegime}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {item.payableDays}d
                              {item.unpaidLopDays > 0 && (
                                <span className="ml-1 text-[10px] text-rose-600">({item.unpaidLopDays}d LOP)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                              {formatINR(item.grossEarnings)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['PF_EE'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['PT'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {formatINR(deductions['TDS'] || 0)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-purple-700">
                              {formatINR(item.netSalary)}
                            </td>
                            <td className="py-3 px-4 text-right font-sans">
                              <div className="flex justify-end gap-1.5">
                                {!['LOCKED', 'PUBLISHED'].includes(selectedRun.status) && (
                                  <button
                                    onClick={() => {
                                      setOverrideItem(item);
                                      setOverrideAmount(String(item.grossEarnings));
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                  >
                                    <Edit3 className="h-3 w-3" /> Override
                                  </button>
                                )}
                                <button
                                  onClick={() => setViewPayslip(item)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                  title="Preview Payslip"
                                >
                                  <FileText className="h-3 w-3" /> View
                                </button>
                                <button
                                  onClick={() => handleDownloadPDF(item)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                  title="Download PDF Document"
                                >
                                  <Download className="h-3 w-3" /> PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Salary Structures */}
        {activeTab === 'STRUCTURES' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Salary & CTC Structure Templates ({structures.length})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define modular earning allowances, deduction formulas, and statutory components for compensation packages.
                </p>
              </div>
              <button
                onClick={() => setIsCreateStructureOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add New Salary Structure
              </button>
            </div>

            {structures.map((s) => (
              <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">Code: {s.code} • {s._count?.assignments || 0} Employees Assigned</p>
                  </div>
                  {s.isDefault && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                      Default Template
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {s.components?.map((c: any) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{c.name}</span>
                        <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{c.componentType}</span>
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">Formula: {c.valueOrFormula}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Versioned Statutory Rules */}
        {activeTab === 'STATUTORY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* EPF Rules */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Employees' Provident Fund (EPF)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employee PF Contribution:</span>
                  <span className="font-mono font-bold">12.00% of Basic</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer EPS Split:</span>
                  <span className="font-mono font-bold">8.33% (Cap ₹1,250)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer EPF Split:</span>
                  <span className="font-mono font-bold">3.67% of Basic</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Wage Ceiling:</span>
                  <span className="font-mono font-bold">₹15,000 / month</span>
                </div>
              </div>
            </div>

            {/* ESI Rules */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Employee State Insurance (ESI)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Wage Threshold:</span>
                  <span className="font-mono font-bold">₹21,000 / month Gross</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employee ESI Rate:</span>
                  <span className="font-mono font-bold">0.75% of Gross</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Employer ESI Rate:</span>
                  <span className="font-mono font-bold">3.25% of Gross</span>
                </div>
              </div>
            </div>

            {/* Professional Tax */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                State-wise Professional Tax (PT)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Karnataka:</span>
                  <span className="font-mono font-bold">₹200 / month (&gt;= ₹25,000)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Maharashtra:</span>
                  <span className="font-mono font-bold">₹200 / month (₹300 in Feb)</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Delhi:</span>
                  <span className="font-mono font-bold">Nil (₹0)</span>
                </div>
              </div>
            </div>

            {/* Income Tax Slabs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                Income Tax Regimes (FY 2026-27)
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>New Regime Std Deduction:</span>
                  <span className="font-mono font-bold">₹75,000</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Old Regime Std Deduction:</span>
                  <span className="font-mono font-bold">₹50,000 + 80C/80D/HRA</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                  <span>Health & Edu Cess:</span>
                  <span className="font-mono font-bold">4.00%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Component Override Modal */}
        {overrideItem && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-emerald-600" />
                  Manual Component Override
                </h3>
                <button onClick={() => setOverrideItem(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Overriding salary for <strong>{overrideItem.employee?.firstName} {overrideItem.employee?.lastName}</strong> ({overrideItem.employee?.employeeCode}). All overrides are audited.
              </div>

              <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Component to Override</label>
                  <select
                    value={overrideComp}
                    onChange={(e) => setOverrideComp(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="SPECIAL_ALLOWANCE">Special Allowance (Earnings)</option>
                    <option value="BASIC">Basic (Earnings)</option>
                    <option value="HRA">HRA (Earnings)</option>
                    <option value="TDS">TDS Income Tax (Deduction)</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">New Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Audit Reason for Override *</label>
                  <textarea
                    rows={3}
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="e.g. One-time performance adjustment authorized by Finance Lead"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOverrideItem(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    Save Override
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payslip Modal View / Printable */}
        {viewPayslip && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 my-8 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">AI AUTOMATION LABS LLP</h2>
                  <p className="text-xs text-slate-500">100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038</p>
                  <p className="text-xs text-slate-500 font-mono">PAN: AAACA1234F • GSTIN: 29AAACA1234F1Z5</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-full uppercase tracking-wider block mb-1">
                    Payslip
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedRun?.cycle?.month}/{selectedRun?.cycle?.year}
                  </span>
                </div>
              </div>

              {/* Employee & Bank Info */}
              <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <div>Name: <strong>{viewPayslip.employee?.firstName} {viewPayslip.employee?.lastName}</strong></div>
                  <div>Emp Code: <strong className="font-mono">{viewPayslip.employee?.employeeCode}</strong></div>
                  <div>Designation: <strong>{viewPayslip.employee?.designation?.title || 'Engineer'}</strong></div>
                  <div>Department: <strong>{viewPayslip.employee?.department?.name || 'Engineering'}</strong></div>
                </div>
                <div>
                  <div>Payable Days: <strong className="font-mono">{viewPayslip.payableDays}</strong></div>
                  <div>Bank Name: <strong>HDFC Bank</strong></div>
                  <div>Account: <strong className="font-mono">XXXXXX{viewPayslip.employee?.bank?.accountNumber?.slice(-4) || '1234'}</strong></div>
                  <div>Tax Regime: <strong className="font-mono">{viewPayslip.taxRegime}</strong></div>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800">Earnings</div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1">
                    {Object.entries(JSON.parse(viewPayslip.earningsBreakdown || '{}')).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between py-1 text-slate-700">
                        <span>{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-slate-900 border-t border-slate-200">
                      <span>Gross Earnings</span>
                      <span className="font-mono text-emerald-700">{formatINR(viewPayslip.grossEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800">Deductions</div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1">
                    {Object.entries(JSON.parse(viewPayslip.deductionsBreakdown || '{}')).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between py-1 text-slate-700">
                        <span>{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">{formatINR(v)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-slate-900 border-t border-slate-200">
                      <span>Total Deductions</span>
                      <span className="font-mono text-rose-700">{formatINR(viewPayslip.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payout Callout */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-xs text-emerald-800 font-semibold block">NET TAKE-HOME SALARY</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono">{formatINR(viewPayslip.netSalary)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPDF(viewPayslip)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="h-4 w-4" /> Download PDF Document
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewPayslip(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Salary Structure Modal */}
        {isCreateStructureOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Create New Salary Structure</h3>
                    <p className="text-xs text-slate-500">
                      Configure custom CTC component formulas, deductions, and statutory compliance rules
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateStructureOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Template Presets */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-600" /> Quick Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStructureForm({
                        ...structureForm,
                        name: 'Tech Standard CTC Structure',
                        code: `TECH_CTC_${Date.now().toString().slice(-4)}`,
                        description: 'Standard 50% Basic, 40% HRA, Special Allowance & EPF/PT structure',
                        components: [
                          { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * CTC' },
                          { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * BASIC' },
                          { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA' },
                          { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
                          { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '200' },
                          { name: 'Provident Fund (Employer)', code: 'PF_ER', componentType: 'EMPLOYER_CONTRIBUTION', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
                        ],
                      });
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    Tech Standard CTC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStructureForm({
                        ...structureForm,
                        name: 'Executive Leadership CTC Structure',
                        code: `EXEC_CTC_${Date.now().toString().slice(-4)}`,
                        description: 'Executive structure with performance pay & car lease allowance',
                        components: [
                          { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * CTC' },
                          { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * BASIC' },
                          { name: 'Executive Allowance', code: 'EXEC_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.20 * CTC' },
                          { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA - EXEC_ALLOWANCE' },
                          { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC' },
                          { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '200' },
                        ],
                      });
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    Executive Leadership
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateStructure} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Structure Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sales CTC Structure 2026"
                      value={structureForm.name}
                      onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Unique Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SALES_CTC_2026"
                      value={structureForm.code}
                      onChange={(e) => setStructureForm({ ...structureForm, code: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:bg-white text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Applicable for Sales and Field Operations with variable compensation"
                    value={structureForm.description}
                    onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:bg-white text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={structureForm.isDefault}
                    onChange={(e) => setStructureForm({ ...structureForm, isDefault: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="isDefault" className="font-semibold text-slate-700 cursor-pointer">
                    Set as Default Structure for New Employees
                  </label>
                </div>

                {/* Modular Components List */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-xs">Salary Components & Formulas ({structureForm.components.length})</span>
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Component
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {structureForm.components.map((comp, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Component Name</label>
                            <input
                              type="text"
                              required
                              value={comp.name}
                              onChange={(e) => handleUpdateComponent(idx, 'name', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Code</label>
                            <input
                              type="text"
                              required
                              value={comp.code}
                              onChange={(e) => handleUpdateComponent(idx, 'code', e.target.value.toUpperCase())}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                            <select
                              value={comp.componentType}
                              onChange={(e) => handleUpdateComponent(idx, 'componentType', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <option value="EARNING">EARNING</option>
                              <option value="DEDUCTION">DEDUCTION</option>
                              <option value="STATUTORY">STATUTORY</option>
                              <option value="EMPLOYER_CONTRIBUTION">EMPLOYER CONTRIBUTION</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Formula / Value</label>
                              <input
                                type="text"
                                required
                                value={comp.valueOrFormula}
                                onChange={(e) => handleUpdateComponent(idx, 'valueOrFormula', e.target.value)}
                                placeholder="e.g. 0.50 * CTC"
                                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg mt-3 transition-colors"
                              title="Delete Component"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateStructureOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingStructure}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {creatingStructure ? 'Saving...' : 'Create Salary Structure'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
