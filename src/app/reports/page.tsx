'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Briefcase,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
} from 'lucide-react';

const REPORT_TYPES = [
  { id: 'EMPLOYEE_MASTER', name: 'Employee Master Directory', icon: Users, desc: 'Full profile, hierarchy, statutory IDs, and status' },
  { id: 'ATTENDANCE_SUMMARY', name: 'Attendance & Overtime Records', icon: Calendar, desc: 'Daily punch logs, hours worked, late and overtime metrics' },
  { id: 'LEAVE_LEDGER', name: 'Leave Ledger & Accrual Balance', icon: Layers, desc: 'Credit, debit, opening balance and consumption history' },
  { id: 'PAYROLL_STATUTORY', name: 'Payroll & Statutory Tax Compliance', icon: DollarSign, desc: 'EPF, ESI, Professional Tax, TDS and net take-home split' },
  { id: 'ATS_PIPELINE', name: 'Recruitment Funnel & Candidate Pipeline', icon: Briefcase, desc: 'Candidate sourcing stages, AI match scores, and notice period' },
  { id: 'PERFORMANCE_APPRAISALS', name: 'Performance & OKR Appraisals', icon: TrendingUp, desc: 'Self, manager ratings, calibration, and increment recommendations' },
  { id: 'EXPENSE_CLAIMS', name: 'Expense Claims & Reimbursements', icon: DollarSign, desc: 'Category wise claims, receipts, approval and payment states' },
  { id: 'ASSET_INVENTORY', name: 'Hardware & IT Asset Inventory', icon: Layers, desc: 'Assigned devices, serial numbers, warranties and return tracking' },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('EMPLOYEE_MASTER');
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchReport = async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedReport);
  }, [selectedReport]);

  const handleDownloadCsv = () => {
    window.location.href = `/api/reports?type=${selectedReport}&format=csv`;
  };

  const filteredRows = reportData?.rows?.filter((row: any) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    )
  ) || [];

  return (
    <DashboardLayout
      title="Enterprise Reports & Compliance Analytics"
      subtitle="Audit-ready cross-module analytics, statutory filings, and CSV data export"
    >
      <div className="space-y-6">
        {/* Report Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {REPORT_TYPES.map((rep) => {
            const Icon = rep.icon;
            const isSelected = selectedReport === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedReport(rep.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10 ring-2 ring-emerald-500/50'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div
                    className={`p-2 rounded-xl ${
                      isSelected ? 'bg-white/10 text-emerald-400' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </div>
                <div>
                  <h4 className="font-semibold text-xs mb-1 line-clamp-1">{rep.name}</h4>
                  <p
                    className={`text-[11px] leading-relaxed line-clamp-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {rep.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action and Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search across records..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {filteredRows.length} record(s) found
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-2 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV Dataset
            </button>
          </div>
        </div>

        {/* Report Data Table Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              Aggregating secure tenant data...
            </div>
          ) : reportData && reportData.columns?.length > 0 ? (
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    {reportData.columns.map((col: string) => (
                      <th
                        key={col}
                        className="px-4 py-3 font-semibold text-slate-700 text-[11px] whitespace-nowrap uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      {reportData.columns.map((col: string) => (
                        <td key={col} className="px-4 py-2.5 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs">
              No report records found for the selected parameters.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
