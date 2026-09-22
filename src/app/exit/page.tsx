"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  X,
  Check,
  Zap,
  CheckCircle2,
  Menu,
  LogOut,
  Plus,
  UserMinus,
  AlertCircle,
  Building,
  Users,
  FileText,
  Clock,
  Calendar,
} from "lucide-react";

interface ExitRequest {
  id: string;
  resignation_date: string;
  last_working_day: string;
  reason: string;
  reasonCategory?: string;
  status: string;
  notice_period_required: number;
  notice_period_served: number;
  notice_shortfall_days: number;
  it_clearance: string;
  finance_clearance: string;
  admin_clearance: string;
  hr_clearance: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    department: { name: string };
    designation: { title: string };
    date_of_joining: string;
  };
  fnf_settlement?: {
    id: string;
    payable_days: number;
    earned_salary: number;
    leave_encashment_amount: number;
    gratuity_amount: number;
    notice_recovery_amount: number;
    net_payable: number;
    status: string;
    settled_date?: string;
  };
}

export default function ExitPage() {
  const { user } = useAuth();
  const [exits, setExits] = useState<ExitRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExit, setSelectedExit] = useState<ExitRequest | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "SETTLED">("ACTIVE");

  // Modal states for Resignation / Initiating Exit
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isSelfResignation, setIsSelfResignation] = useState(false);
  const [submittingExit, setSubmittingExit] = useState(false);
  const [exitForm, setExitForm] = useState({
    employeeId: "",
    requestedLwd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    reasonCategory: "BETTER_OPPORTUNITY",
    reason: "",
  });

  const isHRAdmin =
    user?.roles?.includes("COMPANY_ADMIN") ||
    user?.roles?.includes("PLATFORM_SUPER_ADMIN") ||
    user?.roles?.includes("HR_ADMIN");

  const fetchExits = async () => {
    try {
      setLoading(true);
      const [exitsRes, empRes] = await Promise.all([
        fetch("/api/exit/requests"),
        fetch("/api/employees"),
      ]);

      if (exitsRes.ok) {
        const data = await exitsRes.json();
        if (data.exits) {
          const normalized: ExitRequest[] = data.exits.map((e: any) => ({
            id: e.id,
            resignation_date: e.resignationDate || e.resignation_date || e.createdAt,
            last_working_day: e.approvedLwd || e.requestedLwd || e.last_working_day || new Date().toISOString(),
            reason: e.reason || "Resignation",
            reasonCategory: e.reasonCategory || "BETTER_OPPORTUNITY",
            status: e.status || "INITIATED",
            notice_period_required: e.noticePeriodRequiredDays || e.notice_period_required || 30,
            notice_period_served: e.noticePeriodServedDays || e.notice_period_served || 30,
            notice_shortfall_days: e.noticeShortfallDays || e.notice_shortfall_days || 0,
            it_clearance: e.itClearanceStatus || e.it_clearance || "PENDING",
            finance_clearance: e.financeClearanceStatus || e.finance_clearance || "PENDING",
            admin_clearance: e.adminClearanceStatus || e.admin_clearance || "PENDING",
            hr_clearance: e.hrClearanceStatus || e.hr_clearance || "PENDING",
            employee: {
              id: e.employee?.id || "",
              first_name: e.employee?.firstName || e.employee?.first_name || "Employee",
              last_name: e.employee?.lastName || e.employee?.last_name || "",
              employee_code: e.employee?.employeeCode || e.employee?.employee_code || "EMP",
              department: { name: e.employee?.department?.name || "General" },
              designation: { title: e.employee?.designation?.title || "Staff" },
              date_of_joining: e.employee?.joiningDate || e.employee?.date_of_joining || new Date().toISOString(),
            },
            fnf_settlement: e.settlement
              ? {
                  id: e.settlement.id,
                  payable_days: e.settlement.payableDays || e.settlement.payable_days || 30,
                  earned_salary: e.settlement.earnedSalary || e.settlement.earned_salary || 0,
                  leave_encashment_amount: e.settlement.leaveEncashment || e.settlement.leave_encashment_amount || 0,
                  gratuity_amount: e.settlement.gratuity || e.settlement.gratuity_amount || 0,
                  notice_recovery_amount: e.settlement.noticeRecovery || e.settlement.notice_recovery_amount || 0,
                  net_payable: e.settlement.netSettlement || e.settlement.net_payable || 0,
                  status: e.settlement.status || "PENDING",
                  settled_date: e.settlement.settledAt || e.settlement.settled_date,
                }
              : undefined,
          }));
          setExits(normalized);
        }
      }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExits();
  }, []);

  const openResignModal = (isSelf: boolean) => {
    setIsSelfResignation(isSelf);
    setExitForm({
      employeeId: isSelf ? user?.employeeId || "" : (employees[0]?.id || ""),
      requestedLwd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      reasonCategory: "BETTER_OPPORTUNITY",
      reason: "",
    });
    setIsExitModalOpen(true);
  };

  const handleSubmitExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitForm.employeeId) {
      alert("Please select an employee");
      return;
    }
    setSubmittingExit(true);
    try {
      const res = await fetch("/api/exit/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exitForm),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Separation / Resignation request successfully submitted and added to the Exit Pipeline!");
        setIsExitModalOpen(false);
        await fetchExits();
      } else {
        alert(data.error || "Failed to submit exit request");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingExit(false);
    }
  };

  const handleCalculateFnF = async (exitId: string) => {
    try {
      setCalculating(true);
      const res = await fetch(`/api/exit/requests/${exitId}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await fetchExits();
        const updatedData = await (await fetch("/api/exit/requests")).json();
        const found = updatedData.exits?.find((x: any) => x.id === exitId);
        if (found) {
          setSelectedExit({
            ...selectedExit!,
            fnf_settlement: found.settlement ? {
              id: found.settlement.id,
              payable_days: found.settlement.payableDays || 30,
              earned_salary: found.settlement.earnedSalary || 0,
              leave_encashment_amount: found.settlement.leaveEncashment || 0,
              gratuity_amount: found.settlement.gratuity || 0,
              notice_recovery_amount: found.settlement.noticeRecovery || 0,
              net_payable: found.settlement.netSettlement || 0,
              status: found.settlement.status || 'PENDING',
            } : undefined,
          });
        }
      } else {
        const d = await res.json();
        alert(d.error || "Calculation failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSettleFnF = async (exitId: string) => {
    if (!confirm("Approve and execute Full & Final payout for this employee?")) return;
    try {
      const res = await fetch(`/api/exit/requests/${exitId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        alert("F&F Settlement approved and employee marked as Relieved.");
        await fetchExits();
        setSelectedExit(null);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to settle F&F");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredExits = exits.filter((e) => {
    if (activeTab === "ACTIVE") return e.status !== "SETTLED";
    return e.status === "SETTLED";
  });

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar isOpenMobile={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden focus:outline-none"
              title="Open Navigation"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                Separation & Exit Management
              </h1>
              <p className="text-xs text-slate-400 mt-1 hidden sm:block">
                Employee resignation portal, notice period tracking, clearance checklist & Full and Final (F&F) settlement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Employee Self-Service Resignation Button */}
            <button
              onClick={() => openResignModal(true)}
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Submit Resignation
            </button>

            {/* HR / Admin Initiate Exit Button */}
            {isHRAdmin && (
              <button
                onClick={() => openResignModal(false)}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Exit Pipeline
              </button>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-8 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active in Exit Pipeline</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-2">
                {exits.filter((e) => e.status !== "SETTLED").length}
              </p>
              <span className="text-xs text-amber-300/80 mt-1 inline-block">Serving notice & in clearance</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">In Clearance Queue</span>
              <p className="text-3xl font-extrabold text-indigo-400 mt-2">
                {exits.filter((e) => e.status === "INITIATED" || e.status === "CLEARANCE").length}
              </p>
              <span className="text-xs text-indigo-300/80 mt-1 inline-block">IT / Finance / HR checks</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">F&F Computation Ready</span>
              <p className="text-3xl font-extrabold text-blue-400 mt-2">
                {exits.filter((e) => e.fnf_settlement && e.status !== "SETTLED").length}
              </p>
              <span className="text-xs text-blue-300/80 mt-1 inline-block">Statements calculated</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fully Settled & Relieved</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2">
                {exits.filter((e) => e.status === "SETTLED").length}
              </p>
              <span className="text-xs text-emerald-300/80 mt-1 inline-block">Relieved & Archived</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            {[
              { key: "ACTIVE", label: `Active Exit Pipeline (${exits.filter((e) => e.status !== "SETTLED").length})` },
              { key: "SETTLED", label: `Settled & Relieved (${exits.filter((e) => e.status === "SETTLED").length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Exit Records Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Designation & Dept</th>
                    <th className="px-6 py-3.5">Resigned Date</th>
                    <th className="px-6 py-3.5">Last Working Day</th>
                    <th className="px-6 py-3.5">Reason Category</th>
                    <th className="px-6 py-3.5">Clearances</th>
                    <th className="px-6 py-3.5">F&F Net Settlement</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        Loading exit cases...
                      </td>
                    </tr>
                  ) : filteredExits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                        No exit records in this view. Click "Submit Resignation" or "Add to Exit Pipeline" above.
                      </td>
                    </tr>
                  ) : (
                    filteredExits.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">
                            {item.employee?.first_name} {item.employee?.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{item.employee?.employee_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-300">{item.employee?.designation?.title}</div>
                          <div className="text-[10px] text-slate-500">{item.employee?.department?.name}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(item.resignation_date).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-medium">
                          {new Date(item.last_working_day).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.reasonCategory?.replace(/_/g, " ") || "Better Opportunity"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <span
                              title="IT Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.it_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              IT
                            </span>
                            <span
                              title="Finance Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.finance_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              FN
                            </span>
                            <span
                              title="Admin Clearance"
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                item.admin_clearance === "CLEARED"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              AD
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.fnf_settlement ? (
                            <div>
                              <div className="font-bold text-emerald-400 text-sm">
                                ₹{item.fnf_settlement.net_payable?.toLocaleString("en-IN")}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Status: {item.fnf_settlement.status}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Not Calculated</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              item.status === "SETTLED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : item.status === "FNF_PENDING"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedExit(item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                          >
                            F&F Statement
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Resignation / Add to Exit Pipeline Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-rose-400" />
                  {isSelfResignation ? "Submit Resignation" : "Initiate Employee Exit & Add to Pipeline"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isSelfResignation
                    ? "Submit your formal resignation notice to your manager & HR"
                    : "Add an employee into the official separation, clearance, and F&F settlement pipeline"}
                </p>
              </div>
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExit} className="space-y-4 text-xs">
              {/* Employee Selector */}
              <div>
                <label className="font-medium text-slate-300 block mb-1">Employee *</label>
                {isSelfResignation ? (
                  <input
                    type="text"
                    disabled
                    value={`${user?.name || "Current User"} (${user?.email})`}
                    className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-400 font-medium"
                  />
                ) : (
                  <select
                    required
                    value={exitForm.employeeId}
                    onChange={(e) => setExitForm({ ...exitForm, employeeId: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select Employee to Exit --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode}) • {emp.department?.name || "General"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Requested Last Working Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-300 block mb-1">Reason Category *</label>
                  <select
                    value={exitForm.reasonCategory}
                    onChange={(e) => setExitForm({ ...exitForm, reasonCategory: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="BETTER_OPPORTUNITY">Better Career Opportunity</option>
                    <option value="CAREER_CHANGE">Higher Studies / Career Change</option>
                    <option value="RELOCATION">Personal / Relocation</option>
                    <option value="HEALTH_REASONS">Health / Medical</option>
                    <option value="PERFORMANCE_EXIT">Performance Separation</option>
                    <option value="MUTUAL_SEPARATION">Mutual Separation Agreement</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Requested Last Working Day *</label>
                  <input
                    type="date"
                    required
                    value={exitForm.requestedLwd}
                    onChange={(e) => setExitForm({ ...exitForm, requestedLwd: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reason / Remarks */}
              <div>
                <label className="font-medium text-slate-300 block mb-1">Detailed Reason & Transition Remarks</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide context on transition handover, knowledge transfer, or feedback..."
                  value={exitForm.reason}
                  onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExitModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExit}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all"
                >
                  {submittingExit ? "Submitting..." : isSelfResignation ? "Confirm Resignation" : "Initiate Exit Pipeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F&F Settlement Statement Modal */}
      {selectedExit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Full & Final Settlement Worksheet</h3>
                <p className="text-xs text-slate-400">
                  {selectedExit.employee?.first_name} {selectedExit.employee?.last_name} ({selectedExit.employee?.employee_code})
                </p>
              </div>
              <button
                onClick={() => setSelectedExit(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Employee Tenure & Resignation Detail */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block">Date of Joining:</span>
                <span className="text-slate-200 font-medium">
                  {new Date(selectedExit.employee?.date_of_joining).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Working Date:</span>
                <span className="text-slate-200 font-medium">
                  {new Date(selectedExit.last_working_day).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Notice Required vs Served:</span>
                <span className="text-slate-200 font-medium">
                  {selectedExit.notice_period_required}d required / {selectedExit.notice_period_served}d served
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Notice Shortfall:</span>
                <span
                  className={`font-semibold ${
                    selectedExit.notice_shortfall_days > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {selectedExit.notice_shortfall_days} days
                </span>
              </div>
            </div>

            {/* Settlement Breakdown Sheet */}
            {selectedExit.fnf_settlement ? (
              <div className="space-y-2 text-xs">
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Computation Breakdown
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 bg-slate-950/40">
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Earned Salary (Prorated for {selectedExit.fnf_settlement.payable_days} days):</span>
                    <span className="font-semibold text-slate-200">
                      ₹{selectedExit.fnf_settlement.earned_salary?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Leave Balance Encashment (Earned/Paid Leave):</span>
                    <span className="font-semibold text-emerald-400">
                      + ₹{selectedExit.fnf_settlement.leave_encashment_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-400">Statutory Gratuity (Payment of Gratuity Act 1972):</span>
                    <span className="font-semibold text-emerald-400">
                      + ₹{selectedExit.fnf_settlement.gratuity_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-rose-950/20">
                    <span className="text-rose-300">Notice Period Recovery (Shortfall Deduction):</span>
                    <span className="font-semibold text-rose-400">
                      - ₹{selectedExit.fnf_settlement.notice_recovery_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-indigo-950/40 text-sm">
                    <span className="font-bold text-white">Net Final Settlement Payout:</span>
                    <span className="font-extrabold text-emerald-400">
                      ₹{selectedExit.fnf_settlement.net_payable?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-3">
                  Click below to trigger automated F&F computation engine (bridges leave ledger, salary structure, and gratuity rules).
                </p>
                <button
                  disabled={calculating}
                  onClick={() => handleCalculateFnF(selectedExit.id)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-xs shadow-md transition flex items-center gap-1.5 mx-auto"
                >
                  <Zap className="h-4 w-4" />
                  {calculating ? "Calculating..." : "Run Automated F&F Engine"}
                </button>
              </div>
            )}

            {/* Settlement Action */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {selectedExit.fnf_settlement && selectedExit.status !== "SETTLED" && (
                <button
                  onClick={() => handleSettleFnF(selectedExit.id)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Approve Payout & Mark Employee as Relieved
                </button>
              )}
              {selectedExit.status === "SETTLED" && (
                <div className="flex-1 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Full and Final Settlement Executed & Relieving Letter Dispatched
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
