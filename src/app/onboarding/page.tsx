'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  FileCheck,
  Laptop,
  Shield,
  UserCheck,
  Sparkles,
  Check,
  FileText,
  Paperclip,
  UploadCloud,
  Trash2,
  Eye,
  AlertCircle,
  Building,
  CreditCard,
  ShieldCheck,
  Users,
  ExternalLink,
  ChevronRight,
  Search,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

interface AttachmentFile {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [previewModalFile, setPreviewModalFile] = useState<AttachmentFile | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Onboarding Form State
  const [formData, setFormData] = useState({
    personal: {
      dob: '1996-05-15',
      gender: 'MALE',
      bloodGroup: 'O+',
      maritalStatus: 'SINGLE',
      personalEmail: '',
      mobilePhone: '',
      address: 'Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    },
    identity: {
      panNumber: '',
      aadhaarNumber: '',
      uanNumber: '',
      passportNumber: '',
    },
    bank: {
      accountHolderName: '',
      bankName: 'HDFC Bank',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: 'HDFC0001234',
      branchName: 'Indiranagar Branch',
    },
    emergencyContact: {
      name: '',
      relationship: 'Parent / Spouse',
      phone: '',
      email: '',
    },
  });

  // Attachments State
  const [attachments, setAttachments] = useState<{
    panCard: AttachmentFile | null;
    aadhaarCard: AttachmentFile | null;
    cancelledCheque: AttachmentFile | null;
    degreeCertificate: AttachmentFile | null;
    signedOffer: AttachmentFile | null;
  }>({
    panCard: null,
    aadhaarCard: null,
    cancelledCheque: null,
    degreeCertificate: null,
    signedOffer: null,
  });

  const panFileInputRef = useRef<HTMLInputElement>(null);
  const aadhaarFileInputRef = useRef<HTMLInputElement>(null);
  const chequeFileInputRef = useRef<HTMLInputElement>(null);
  const degreeFileInputRef = useRef<HTMLInputElement>(null);
  const offerFileInputRef = useRef<HTMLInputElement>(null);

  const fetchOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/instances');
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
        if (data.instances?.[0] && !selectedInstance) {
          loadInstanceIntoForm(data.instances[0]);
        } else if (selectedInstance) {
          const updated = data.instances?.find((i: any) => i.id === selectedInstance.id);
          if (updated) loadInstanceIntoForm(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnboarding();
  }, []);

  const loadInstanceIntoForm = (inst: any) => {
    setSelectedInstance(inst);
    const emp = inst.employee || {};
    const identity = emp.identity || {};
    const bank = emp.bank || {};
    const emergency = emp.emergencyContacts?.[0] || {};

    setFormData({
      personal: {
        dob: emp.dob ? new Date(emp.dob).toISOString().split('T')[0] : '1996-05-15',
        gender: emp.gender || 'MALE',
        bloodGroup: emp.bloodGroup || 'O+',
        maritalStatus: emp.maritalStatus || 'SINGLE',
        personalEmail: emp.personalEmail || emp.workEmail || '',
        mobilePhone: emp.mobilePhone || '9876543210',
        address: 'Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
      },
      identity: {
        panNumber: identity.panNumber || 'ABCDE1234F',
        aadhaarNumber: identity.aadhaarNumber || '123456789012',
        uanNumber: identity.uanNumber || '101234567890',
        passportNumber: identity.passportNumber || '',
      },
      bank: {
        accountHolderName: bank.accountHolderName || `${emp.firstName} ${emp.lastName}`,
        bankName: bank.bankName || 'HDFC Bank',
        accountNumber: bank.accountNumber || '50100432198765',
        confirmAccountNumber: bank.accountNumber || '50100432198765',
        ifscCode: bank.ifscCode || 'HDFC0001234',
        branchName: bank.branchName || 'Indiranagar Branch',
      },
      emergencyContact: {
        name: emergency.name || 'Suresh Kumar (Parent)',
        relationship: emergency.relationship || 'Father',
        phone: emergency.phone || '9876500000',
        email: emergency.email || '',
      },
    });

    // Default sample attachments if identity/bank is present
    if (identity.panNumber) {
      setAttachments({
        panCard: {
          name: `${emp.firstName}_PAN_Card_Scanned.pdf`,
          size: 145000,
          type: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,mock',
        },
        aadhaarCard: {
          name: `${emp.firstName}_Aadhaar_Card_Copy.pdf`,
          size: 210000,
          type: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,mock',
        },
        cancelledCheque: {
          name: `${emp.firstName}_Cancelled_Cheque_HDFC.jpg`,
          size: 320000,
          type: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,mock',
        },
        degreeCertificate: {
          name: `${emp.firstName}_Degree_Certificate.pdf`,
          size: 450000,
          type: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,mock',
        },
        signedOffer: {
          name: `${emp.firstName}_Signed_Offer_Letter.pdf`,
          size: 180000,
          type: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,mock',
        },
      });
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: keyof typeof attachments
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments((prev) => ({
          ...prev,
          [fieldKey]: {
            name: file.name,
            size: file.size,
            type: file.type || 'application/pdf',
            dataUrl: ev.target?.result as string,
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstance) return;

    if (formData.bank.accountNumber !== formData.bank.confirmAccountNumber) {
      alert('Bank Account Number and Confirmation Account Number do not match.');
      return;
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(formData.identity.panNumber.trim().toUpperCase())) {
      alert('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).');
      return;
    }

    const cleanAadhaar = formData.identity.aadhaarNumber.replace(/\s+/g, '');
    if (cleanAadhaar.length !== 12 || isNaN(Number(cleanAadhaar))) {
      alert('Please enter a valid 12-digit Aadhaar card number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance.id,
          employeeId: selectedInstance.employeeId,
          personal: formData.personal,
          identity: formData.identity,
          bank: formData.bank,
          emergencyContact: formData.emergencyContact,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessBanner(
          `Onboarding Verified & Completed! ${selectedInstance.employee?.firstName} ${selectedInstance.employee?.lastName} (${data.employee?.employeeCode}) is now officially active and visible in the Employees Tab.`
        );
        await fetchOnboarding();
      } else {
        alert(data.error || 'Failed to complete onboarding');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInstances = instances.filter((inst) => {
    const fullName = `${inst.employee?.firstName} ${inst.employee?.lastName}`.toLowerCase();
    const code = (inst.employee?.employeeCode || '').toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'COMPLETED'
        ? inst.status === 'COMPLETED'
        : inst.status !== 'COMPLETED';
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout
      title="Employee Onboarding & Statutory Document Verification"
      subtitle="Complete statutory forms (PAN, Aadhaar, Bank Details with attachments) to activate new hires into the Employees directory"
    >
      <div className="space-y-6">
        {/* Success Banner */}
        {successBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 text-emerald-900 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/employees"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
              >
                Go to Employees Directory →
              </Link>
              <button
                onClick={() => setSuccessBanner(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Top KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block font-medium">Pending Verification</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {instances.filter((i) => i.status !== 'COMPLETED').length}
            </span>
            <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">
              Form submission & doc review required
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block font-medium">Completed & Active</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {instances.filter((i) => i.status === 'COMPLETED').length}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">
              Visible in Employees Tab
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block font-medium">Statutory Compliance Gates</span>
            <span className="text-sm font-bold text-slate-800 mt-1.5 block">
              PAN, Aadhaar, Bank Cheque, NDA
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              100% verified digital attachments
            </span>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Joiners Directory (Col 4) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                New Joiners ({instances.length})
              </h3>
              <div className="flex gap-1">
                {(['ALL', 'IN_PROGRESS', 'COMPLETED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                      statusFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'IN_PROGRESS' ? 'Pending' : 'Active'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or employee code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Joiners List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredInstances.map((inst) => {
                const isSelected = selectedInstance?.id === inst.id;
                const isComplete = inst.status === 'COMPLETED';
                return (
                  <div
                    key={inst.id}
                    onClick={() => loadInstanceIntoForm(inst)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 hover:bg-slate-100/80 text-slate-800 border-slate-200/80'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-xs">
                        {inst.employee?.firstName} {inst.employee?.lastName}
                      </div>
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          isComplete
                            ? 'bg-emerald-500 text-white'
                            : isSelected
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isComplete ? 'ACTIVE' : 'IN ONBOARDING'}
                      </span>
                    </div>

                    <div className={`text-[11px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {inst.employee?.employeeCode} • {inst.employee?.designation?.title || 'Engineer'}
                    </div>

                    <div className={`text-[10px] mt-1 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                      Dept: {inst.employee?.department?.name || 'Engineering'}
                    </div>
                  </div>
                );
              })}

              {filteredInstances.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No joiners found matching filter.
                </div>
              )}
            </div>
          </div>

          {/* Right Main Form Section (Col 8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {selectedInstance ? (
              <form onSubmit={handleCompleteOnboarding} className="space-y-6">
                {/* Form Header Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedInstance.employee?.firstName} {selectedInstance.employee?.lastName}
                      </h2>
                      <span className="px-2 py-0.5 bg-slate-200 rounded text-[10px] font-mono font-bold text-slate-700">
                        {selectedInstance.employee?.employeeCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedInstance.employee?.designation?.title || 'Engineer'} • {selectedInstance.employee?.department?.name || 'Engineering'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedInstance.status === 'COMPLETED' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Onboarded & Active
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-700" /> Pending Form Verification
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 1: Personal Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Users className="h-4 w-4 text-emerald-600" />
                    1. Personal Information
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={formData.personal.dob}
                        onChange={(e) =>
                          setFormData({ ...formData, personal: { ...formData.personal, dob: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Gender *</label>
                      <select
                        value={formData.personal.gender}
                        onChange={(e) =>
                          setFormData({ ...formData, personal: { ...formData.personal, gender: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs"
                      >
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Blood Group *</label>
                      <select
                        value={formData.personal.bloodGroup}
                        onChange={(e) =>
                          setFormData({ ...formData, personal: { ...formData.personal, bloodGroup: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Personal Email</label>
                      <input
                        type="email"
                        value={formData.personal.personalEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, personal: { ...formData.personal, personalEmail: e.target.value } })
                        }
                        placeholder="e.g. personal@gmail.com"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Mobile Phone *</label>
                      <input
                        type="tel"
                        required
                        value={formData.personal.mobilePhone}
                        onChange={(e) =>
                          setFormData({ ...formData, personal: { ...formData.personal, mobilePhone: e.target.value } })
                        }
                        placeholder="e.g. 9876543210"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Statutory Identity (PAN & Aadhaar with Attachments) */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    2. Statutory Identity & Document Attachments (PAN / Aadhaar)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PAN Card Field & Attachment */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div>
                        <label className="font-bold text-slate-800 block text-xs mb-1">
                          Permanent Account Number (PAN) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={10}
                          placeholder="ABCDE1234F"
                          value={formData.identity.panNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              identity: { ...formData.identity, panNumber: e.target.value.toUpperCase() },
                            })
                          }
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase focus:border-emerald-500 outline-none"
                        />
                      </div>

                      {/* PAN Attachment Upload */}
                      <div>
                        <div className="flex justify-between items-center mb-1 text-xs">
                          <span className="font-semibold text-slate-700">PAN Card Scanned Copy / Photo</span>
                          <span className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 10MB)</span>
                        </div>

                        <input
                          type="file"
                          ref={panFileInputRef}
                          onChange={(e) => handleFileUpload(e, 'panCard')}
                          accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
                          className="hidden"
                        />

                        {attachments.panCard ? (
                          <div className="p-2.5 bg-white border border-emerald-300 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="text-xs font-medium text-slate-900 truncate">
                                {attachments.panCard.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Attached
                              </span>
                              <button
                                type="button"
                                onClick={() => setAttachments((p) => ({ ...p, panCard: null }))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => panFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-white hover:bg-emerald-50/30 transition-all"
                          >
                            <UploadCloud className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                            <span className="text-xs font-medium text-slate-700 block">
                              Click to attach PAN Card Copy
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aadhaar Card Field & Attachment */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div>
                        <label className="font-bold text-slate-800 block text-xs mb-1">
                          Aadhaar Number (12 Digits) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={14}
                          placeholder="1234 5678 9012"
                          value={formData.identity.aadhaarNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              identity: { ...formData.identity, aadhaarNumber: e.target.value },
                            })
                          }
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>

                      {/* Aadhaar Attachment Upload */}
                      <div>
                        <div className="flex justify-between items-center mb-1 text-xs">
                          <span className="font-semibold text-slate-700">Aadhaar Front & Back Photo/PDF</span>
                          <span className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 10MB)</span>
                        </div>

                        <input
                          type="file"
                          ref={aadhaarFileInputRef}
                          onChange={(e) => handleFileUpload(e, 'aadhaarCard')}
                          accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
                          className="hidden"
                        />

                        {attachments.aadhaarCard ? (
                          <div className="p-2.5 bg-white border border-emerald-300 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="text-xs font-medium text-slate-900 truncate">
                                {attachments.aadhaarCard.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Attached
                              </span>
                              <button
                                type="button"
                                onClick={() => setAttachments((p) => ({ ...p, aadhaarCard: null }))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => aadhaarFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-white hover:bg-emerald-50/30 transition-all"
                          >
                            <UploadCloud className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                            <span className="text-xs font-medium text-slate-700 block">
                              Click to attach Aadhaar Scanned Copy
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* UAN & Passport */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Universal Account Number (UAN / PF)</label>
                      <input
                        type="text"
                        placeholder="e.g. 101234567890"
                        value={formData.identity.uanNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, identity: { ...formData.identity, uanNumber: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Passport Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Z1234567"
                        value={formData.identity.passportNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, identity: { ...formData.identity, passportNumber: e.target.value.toUpperCase() } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Bank Account & Payout Details */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    3. Bank Account & Direct Salary Deposit Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Bank Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.bank.bankName}
                        onChange={(e) =>
                          setFormData({ ...formData, bank: { ...formData.bank, bankName: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Account Number *</label>
                      <input
                        type="password"
                        required
                        value={formData.bank.accountNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, bank: { ...formData.bank, accountNumber: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Confirm Account Number *</label>
                      <input
                        type="text"
                        required
                        value={formData.bank.confirmAccountNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, bank: { ...formData.bank, confirmAccountNumber: e.target.value } })
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">IFSC Code *</label>
                        <input
                          type="text"
                          required
                          value={formData.bank.ifscCode}
                          onChange={(e) =>
                            setFormData({ ...formData, bank: { ...formData.bank, ifscCode: e.target.value.toUpperCase() } })
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Branch Name</label>
                        <input
                          type="text"
                          value={formData.bank.branchName}
                          onChange={(e) =>
                            setFormData({ ...formData, bank: { ...formData.bank, branchName: e.target.value } })
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    {/* Cancelled Cheque Attachment */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-semibold text-slate-700">Cancelled Cheque / Passbook Copy</span>
                        <span className="text-[10px] text-slate-400">PDF, JPG (Max 10MB)</span>
                      </div>

                      <input
                        type="file"
                        ref={chequeFileInputRef}
                        onChange={(e) => handleFileUpload(e, 'cancelledCheque')}
                        accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
                        className="hidden"
                      />

                      {attachments.cancelledCheque ? (
                        <div className="p-2.5 bg-slate-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-medium text-slate-900 truncate">
                              {attachments.cancelledCheque.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Attached
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttachments((p) => ({ ...p, cancelledCheque: null }))}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => chequeFileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-2.5 text-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all"
                        >
                          <span className="text-xs font-medium text-slate-600 flex items-center justify-center gap-1.5">
                            <UploadCloud className="h-3.5 w-3.5 text-emerald-600" />
                            Attach Cancelled Cheque / Bank Passbook Copy
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Emergency Contact */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4 text-emerald-600" />
                    4. Emergency Contact Person
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Contact Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.emergencyContact.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContact: { ...formData.emergencyContact, name: e.target.value },
                          })
                        }
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Relationship *</label>
                      <input
                        type="text"
                        required
                        value={formData.emergencyContact.relationship}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContact: { ...formData.emergencyContact, relationship: e.target.value },
                          })
                        }
                        placeholder="e.g. Father / Spouse"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Emergency Phone *</label>
                      <input
                        type="tel"
                        required
                        value={formData.emergencyContact.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                          })
                        }
                        placeholder="e.g. 9876500000"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-xs text-slate-500">
                    Once verified and completed, this employee will be activated and listed in the <strong>Employees Directory</strong>.
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <UserCheck className="h-4 w-4" />
                    {submitting ? 'Verifying & Activating...' : 'Complete Onboarding & Activate Employee'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-20 text-center space-y-3">
                <Users className="h-12 w-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-700 text-base">Select a Joiner to Begin Onboarding</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click on any new joiner from the left panel to fill their statutory PAN/Aadhaar details and complete verification.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
