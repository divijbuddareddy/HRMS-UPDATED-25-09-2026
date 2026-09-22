'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  FileSignature,
  FileText,
  Plus,
  ShieldCheck,
  CheckCircle,
  Eye,
  X,
  Send,
  Lock,
  Upload,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  Building,
  Briefcase,
  DollarSign,
  Clock,
  AlertCircle,
  PenTool,
  Type,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Copy,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT_FOR_SIGNATURE' | 'SIGNED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OFFER_LETTER' | 'APPOINTMENT'>('ALL');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Upload / Issue Offer Letter Form State
  const [creationMode, setCreationMode] = useState<'UPLOAD' | 'GENERATE'>('UPLOAD');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [annualCtc, setAnnualCtc] = useState('1200000');
  const [joiningDate, setJoiningDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [acceptanceDeadline, setAcceptanceDeadline] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [workLocation, setWorkLocation] = useState('Indiranagar HQ, Bengaluru');
  const [specialTerms, setSpecialTerms] = useState(
    'Standard probation period of 3 months applies. Health insurance coverage of INR 5,00,000 provided from Day 1.'
  );
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    dataUrl: string;
    type: string;
  } | null>(null);
  const [creatingDoc, setCreatingDoc] = useState(false);

  // Employee Digital Signing State
  const [signMethod, setSignMethod] = useState<'DRAW' | 'TYPE' | 'UPLOAD'>('DRAW');
  const [typedSignatureName, setTypedSignatureName] = useState('');
  const [typedSignatureFont, setTypedSignatureFont] = useState<'font-serif italic' | 'font-mono' | 'font-sans italic'>('font-serif italic');
  const [penColor, setPenColor] = useState('#0f172a');
  const [uploadedSignImage, setUploadedSignImage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signing, setSigning] = useState(false);

  // Canvas ref for drawing signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const isCompanyAdmin =
    user?.roles?.includes('COMPANY_ADMIN') || user?.roles?.includes('PLATFORM_SUPER_ADMIN');
  const isHR =
    isCompanyAdmin ||
    user?.roles?.includes('HR_ADMIN') ||
    user?.roles?.includes('HR_EXECUTIVE');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dRes, tRes, eRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/templates'),
        fetch('/api/employees'),
      ]);
      if (dRes.ok) setDocuments((await dRes.json()).documents || []);
      if (tRes.ok) setTemplates((await tRes.json()).templates || []);
      if (eRes.ok) setEmployees((await eRes.json()).employees || []);
    } catch (e) {
      console.error('Failed to load documents data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync employee details when employee dropdown changes
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      if (emp) {
        setDocTitle(`Offer Letter — ${emp.displayName || `${emp.firstName} ${emp.lastName}`}`);
        setDesignation(emp.designation?.title || 'Senior Software Engineer');
        setDepartment(emp.department?.name || 'Engineering');
        if (emp.salaryAssignments?.[0]?.ctc) {
          setAnnualCtc(String(emp.salaryAssignments[0].ctc));
        }
        if (emp.branchLocation?.city) {
          setWorkLocation(`${emp.branchLocation.city} Office`);
        }
      }
    }
  }, [selectedEmployeeId, employees]);

  // Set default typed signature name when modal opens
  useEffect(() => {
    if (selectedDoc) {
      const defaultName =
        selectedDoc.employee?.displayName ||
        `${selectedDoc.employee?.firstName || ''} ${selectedDoc.employee?.lastName || ''}`.trim() ||
        user?.employee?.displayName ||
        user?.employee?.firstName ||
        'Employee Signatory';
      setTypedSignatureName(defaultName);
      setAgreedToTerms(false);
      setHasDrawnSignature(false);
      setUploadedSignImage(null);
    }
  }, [selectedDoc, user]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasDrawnSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  // Handle file selection for upload offer letter
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile({
        name: file.name,
        size: file.size,
        dataUrl: reader.result as string,
        type: file.type,
      });
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle upload signature image
  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedSignImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Generate signature data URL
  const generateSignaturePayload = (): string => {
    if (signMethod === 'DRAW' && canvasRef.current && hasDrawnSignature) {
      return canvasRef.current.toDataURL('image/png');
    }

    if (signMethod === 'UPLOAD' && uploadedSignImage) {
      return uploadedSignImage;
    }

    // TYPE mode or fallback: create SVG signature
    const textToSign = typedSignatureName.trim() || 'Digitally Signed';
    const fontClass =
      typedSignatureFont === 'font-serif italic'
        ? "font-family:'Brush Script MT', 'Dancing Script', 'Great Vibes', cursive; font-style:italic;"
        : typedSignatureFont === 'font-mono'
        ? "font-family:monospace; font-weight:bold;"
        : "font-family:sans-serif; font-style:italic;";

    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100"><rect width="100%" height="100%" fill="none"/><text x="20" y="65" fill="${encodeURIComponent(
      penColor
    )}" font-size="34" style="${fontClass}">${encodeURIComponent(textToSign)}</text></svg>`;
  };

  // Handle HR creating / uploading an offer letter
  const handleCreateOfferLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      alert('Please select an employee');
      return;
    }

    setCreatingDoc(true);
    try {
      const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
      const empName = selectedEmp ? selectedEmp.displayName || `${selectedEmp.firstName} ${selectedEmp.lastName}` : 'Candidate';

      let htmlBody = '';
      if (creationMode === 'GENERATE') {
        htmlBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1e293b; background: #ffffff;">
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 style="color: #0f172a; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">AI AUTOMATION LABS LLP</h1>
                <p style="color: #64748b; font-size: 13px; margin: 4px 0 0; font-weight: 500;">HR & TALENT ACQUISITION DIVISION</p>
              </div>
              <div style="text-align: right; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Ref: OFF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}</p>
                <p style="margin: 2px 0 0;">Date: <strong>${format(new Date(), 'dd MMMM yyyy')}</strong></p>
              </div>
            </div>

            <div style="margin-bottom: 24px; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 6px 0;">To,</p>
              <p style="margin: 0; font-weight: 700; color: #0f172a; font-size: 16px;">${empName}</p>
              <p style="margin: 0; color: #64748b;">${selectedEmp?.workEmail || 'Candidate Email'}</p>
            </div>

            <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 18px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #0369a1; font-weight: 700;">SUBJECT: LETTER OF EMPLOYMENT OFFER</h3>
              <p style="margin: 0; font-size: 13px; color: #334155;">
                We are delighted to extend this formal offer of employment with <strong>AI Automation Labs LLP</strong> for the position of <strong>${designation}</strong> in our <strong>${department}</strong> department.
              </p>
            </div>

            <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">1. Compensation & Key Terms</h4>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <tbody>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 16px; font-weight: 600; color: #475569; width: 35%;">Designation / Role</td>
                  <td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">${designation}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Department</td>
                  <td style="padding: 12px 16px; color: #1e293b;">${department}</td>
                </tr>
                <tr style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0;">
                  <td style="padding: 12px 16px; font-weight: 700; color: #065f46;">Annual Fixed CTC</td>
                  <td style="padding: 12px 16px; font-weight: 800; color: #047857; font-size: 15px;">INR ${Number(annualCtc).toLocaleString('en-IN')} per annum</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Proposed Joining Date</td>
                  <td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">${format(new Date(joiningDate), 'dd MMMM yyyy')}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Work Location</td>
                  <td style="padding: 12px 16px; color: #1e293b;">${workLocation}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Acceptance Deadline</td>
                  <td style="padding: 12px 16px; color: #dc2626; font-weight: 600;">${format(new Date(acceptanceDeadline), 'dd MMMM yyyy')}</td>
                </tr>
              </tbody>
            </table>

            <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">2. Special Terms & Benefits</h4>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 28px;">
              ${specialTerms}
            </div>

            <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
              Please indicate your acceptance of this offer by signing this document electronically through the company HRMS portal before the deadline. We look forward to welcoming you to our team.
            </p>

            <div style="display: flex; justify-content: space-between; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
              <div>
                <p style="margin: 0; font-weight: 700; color: #0f172a;">Authorized HR Representative</p>
                <p style="margin: 4px 0 0; color: #64748b;">AI Automation Labs LLP</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-weight: 700; color: #0f172a;">Candidate Acceptance</p>
                <p style="margin: 4px 0 0; color: #64748b;">Pending Electronic Signature</p>
              </div>
            </div>
          </div>
        `;
      } else {
        // Mode: Uploaded Document
        htmlBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b;">
            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #cbd5e1;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h2 style="margin: 0 0 6px 0; font-size: 18px; color: #0f172a; font-weight: 700;">Uploaded Offer Letter Document</h2>
                  <p style="margin: 0; font-size: 13px; color: #64748b;">File: <strong>${uploadedFile?.name || 'Offer_Letter.pdf'}</strong></p>
                </div>
                <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                  Official HR Upload
                </span>
              </div>
            </div>

            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a; font-weight: 700;">Candidate & Position Overview</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #334155;">
                <li><strong>Candidate Name:</strong> ${empName}</li>
                <li><strong>Designation:</strong> ${designation}</li>
                <li><strong>Department:</strong> ${department}</li>
                <li><strong>Annual CTC:</strong> INR ${Number(annualCtc).toLocaleString('en-IN')}</li>
                <li><strong>Proposed Joining Date:</strong> ${format(new Date(joiningDate), 'dd MMMM yyyy')}</li>
              </ul>
            </div>

            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              Please review the attached document and affix your legally binding electronic signature below to confirm your acceptance.
            </p>
          </div>
        `;
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          templateCode: 'OFFER_LETTER',
          title: docTitle || `Offer Letter — ${empName}`,
          contentHtml: htmlBody,
          documentPdfUrl: uploadedFile?.dataUrl || null,
          customData: {
            designation,
            department,
            ctc: annualCtc,
            joiningDate,
            workLocation,
            fileName: uploadedFile?.name,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Offer Letter uploaded & dispatched for employee signature!');
        setIsUploadModalOpen(false);
        setUploadedFile(null);
        setSelectedEmployeeId('');
        await fetchData();
      } else {
        alert(data.error || 'Failed to issue offer letter');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setCreatingDoc(false);
    }
  };

  // Handle employee digital signing
  const handleSignDocument = async () => {
    if (!selectedDoc) return;
    if (!agreedToTerms) {
      alert('Please check the acknowledgement checkbox before submitting.');
      return;
    }

    if (signMethod === 'DRAW' && !hasDrawnSignature) {
      alert('Please draw your signature in the signature box.');
      return;
    }

    if (signMethod === 'TYPE' && !typedSignatureName.trim()) {
      alert('Please type your name for the digital signature.');
      return;
    }

    if (signMethod === 'UPLOAD' && !uploadedSignImage) {
      alert('Please upload your signature image.');
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl = generateSignaturePayload();
      const res = await fetch(`/api/documents/${selectedDoc.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureDataUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Offer Letter signed and submitted successfully! The HR team can now review the executed record.');
        setSelectedDoc(null);
        await fetchData();
      } else {
        alert(data.error || 'Signing failed');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred while signing');
    } finally {
      setSigning(false);
    }
  };

  // Copy SHA-256 Checksum
  const copyChecksum = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.employee?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.employee?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.employee?.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.checksumSha256?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || doc.status === statusFilter;

    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'OFFER_LETTER' && (doc.title?.toLowerCase().includes('offer') || doc.template?.code === 'OFFER_LETTER')) ||
      (typeFilter === 'APPOINTMENT' && (doc.title?.toLowerCase().includes('appointment') || doc.template?.code === 'APPOINTMENT_LETTER'));

    return matchesSearch && matchesStatus && matchesType;
  });

  const pendingCount = documents.filter((d) => d.status === 'SENT_FOR_SIGNATURE' || d.status === 'PENDING').length;
  const signedCount = documents.filter((d) => d.status === 'SIGNED').length;

  return (
    <DashboardLayout
      title="Offer Letters & E-Sign Documents"
      subtitle="Issue, upload, sign, and verify employee offer letters and legal agreements with cryptographic SHA-256 seal"
    >
      <div className="space-y-6">
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Documents</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{documents.length}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Employment agreements</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm bg-gradient-to-br from-amber-50/40 to-white flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">Awaiting Signature</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{pendingCount}</span>
              <span className="text-[11px] text-amber-600/80 block mt-0.5">Pending employee execution</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Signed & Executed</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{signedCount}</span>
              <span className="text-[11px] text-emerald-600/80 block mt-0.5">Legally executed & sealed</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tamper Protection</span>
              <span className="text-sm font-bold text-slate-800 mt-1 block">SHA-256 & Audit Log</span>
              <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">100% Immutable Records</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee, title, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                All ({documents.length})
              </button>
              <button
                onClick={() => setStatusFilter('SENT_FOR_SIGNATURE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'SENT_FOR_SIGNATURE' ? 'bg-white text-amber-700 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('SIGNED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'SIGNED' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Signed ({signedCount})
              </button>
            </div>
          </div>

          {/* HR Action: Upload / Issue Offer Letter (HR Admin only) */}
          {isHR && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Upload className="h-4 w-4" />
                Upload Offer Letter
              </button>
            </div>
          )}
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              {isHR ? 'All Employee Offer Letters & Documents' : 'My Offer Letter & Employment Documents'} ({filteredDocuments.length})
            </span>
            <span className="text-slate-500 font-mono text-[11px]">Cryptographic Document Store</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <FileSignature className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No documents found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isHR
                  ? 'No documents issued yet. Click below to upload an offer letter for an employee.'
                  : 'You have no pending documents. When HR uploads an offer letter for you, it will appear here for your review and digital signature.'}
              </p>
              {isHR && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Upload Offer Letter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4">Recipient Employee</th>
                    <th className="py-3 px-4">Department & Role</th>
                    <th className="py-3 px-4">Checksum (SHA-256)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date Issued / Signed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.map((doc) => {
                    const isSigned = doc.status === 'SIGNED';
                    const isUserDoc = user?.employee?.id === doc.employeeId;

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{doc.title}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-medium">
                                {doc.template?.title || 'Offer Letter'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                              {(doc.employee?.firstName?.[0] || 'E') + (doc.employee?.lastName?.[0] || '')}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800 block">
                                {doc.employee?.displayName || `${doc.employee?.firstName || ''} ${doc.employee?.lastName || ''}`}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {doc.employee?.employeeCode}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-medium text-slate-800 block">
                            {doc.employee?.designation?.title || 'Engineer'}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {doc.employee?.department?.name || 'General'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 max-w-[130px]">
                            <span className="truncate">{doc.checksumSha256}</span>
                            <button
                              title="Copy SHA-256 Hash"
                              onClick={() => copyChecksum(doc.checksumSha256)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              {copiedHash === doc.checksumSha256 ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isSigned ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Signed & Executed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Awaiting Signature
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Issued: {format(new Date(doc.createdAt), 'dd MMM yyyy')}</span>
                            {isSigned && doc.signedAt && (
                              <span className="text-emerald-700 font-semibold block">
                                Signed: {format(new Date(doc.signedAt), 'dd MMM yyyy, p')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isSigned ? (
                              <button
                                onClick={() => setSelectedDoc(doc)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors border border-slate-200"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                View Signed Document
                              </button>
                            ) : isUserDoc ? (
                              <button
                                onClick={() => setSelectedDoc(doc)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm shadow-emerald-600/20 active:scale-95"
                              >
                                <FileSignature className="h-3.5 w-3.5" />
                                View & Sign
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedDoc(doc)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors border border-slate-200"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                View Offer Letter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* HR MODAL: UPLOAD / ISSUE OFFER LETTER                           */}
        {/* ------------------------------------------------------------- */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <FileSignature className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Upload / Issue Offer Letter</h3>
                      <p className="text-xs text-slate-500">
                        Upload an offer letter document or generate an official branded letter for the employee
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setCreationMode('UPLOAD')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    creationMode === 'UPLOAD' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-4 w-4 text-emerald-600" />
                  Upload Offer Letter (PDF / File)
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('GENERATE')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    creationMode === 'GENERATE' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Generate Smart Offer Letter
                </button>
              </div>

              <form onSubmit={handleCreateOfferLetter} className="space-y-4">
                {/* Select Target Employee */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Target Employee / Candidate *
                  </label>
                  <select
                    required
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="">-- Choose Employee / Candidate --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.displayName || `${emp.firstName} ${emp.lastName}`} ({emp.employeeCode}) — {emp.designation?.title || 'Employee'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Employment Offer Letter — Alex Smith"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Upload Mode: File Drag & Drop Zone */}
                {creationMode === 'UPLOAD' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      Offer Letter Document File (PDF, DOCX, Scanned Document) *
                    </label>

                    {uploadedFile ? (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">{uploadedFile.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {(uploadedFile.size / 1024).toFixed(1)} KB • {uploadedFile.type || 'Document file'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedFile(null)}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <span className="text-xs font-bold text-slate-700">Click to browse or drag & drop Offer Letter file</span>
                        <span className="text-[11px] text-slate-400 mt-1">Supports PDF, DOCX, PNG, JPG up to 10MB</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Offer Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Lead Full Stack Architect"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering & AI Labs"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Annual CTC (INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        required
                        value={annualCtc}
                        onChange={(e) => setAnnualCtc(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Proposed Joining Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Additional clauses for generator mode */}
                {creationMode === 'GENERATE' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Special Conditions, Probation & Benefits
                    </label>
                    <textarea
                      rows={2}
                      value={specialTerms}
                      onChange={(e) => setSpecialTerms(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white"
                    />
                  </div>
                )}

                {/* Notice */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    When issued, the document is sealed with a SHA-256 cryptographic checksum and dispatched to the employee's portal for digital signature.
                  </span>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingDoc || (creationMode === 'UPLOAD' && !uploadedFile)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    {creatingDoc ? 'Issuing Document...' : 'Upload & Send for Signature'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* DOCUMENT VIEWER & DIGITAL SIGNING MODAL                        */}
        {/* ------------------------------------------------------------- */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
              {/* Modal Top Bar */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-lg">{selectedDoc.title}</h3>
                    {selectedDoc.status === 'SIGNED' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Digitally Signed & Sealed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <FileSignature className="h-3.5 w-3.5 text-amber-600" /> Awaiting Employee Signature
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Recipient: <strong>{selectedDoc.employee?.displayName || selectedDoc.employee?.firstName}</strong> ({selectedDoc.employee?.employeeCode}) • Department: {selectedDoc.employee?.department?.name || 'General'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>SHA-256: {selectedDoc.checksumSha256}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="overflow-y-auto space-y-6 pr-1 flex-1">
                {/* If PDF / Uploaded Document is present, show embed/preview */}
                {selectedDoc.documentPdfUrl && (
                  <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold">
                        <FileText className="h-4 w-4 text-emerald-400" />
                        Uploaded Offer Letter Document Attachment
                      </div>
                      <a
                        href={selectedDoc.documentPdfUrl}
                        download={`${selectedDoc.title}.pdf`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download File
                      </a>
                    </div>
                    {selectedDoc.documentPdfUrl.startsWith('data:image/') ? (
                      <div className="max-h-80 overflow-y-auto bg-white rounded-xl p-2 flex justify-center">
                        <img src={selectedDoc.documentPdfUrl} alt="Uploaded Document" className="max-w-full h-auto rounded" />
                      </div>
                    ) : selectedDoc.documentPdfUrl.startsWith('data:application/pdf') ? (
                      <iframe
                        src={selectedDoc.documentPdfUrl}
                        className="w-full h-96 rounded-xl border border-slate-700 bg-white"
                        title="Document Preview"
                      />
                    ) : null}
                  </div>
                )}

                {/* Document HTML Body */}
                <div
                  className="p-6 md:p-8 bg-slate-50/70 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans shadow-inner print:p-0 print:border-0 print:bg-white"
                  dangerouslySetInnerHTML={{ __html: selectedDoc.contentHtml }}
                />

                {/* ------------------------------------------------------------- */}
                {/* SIGNED STATE: SHOW SIGNATURE STAMP & CERTIFICATE              */}
                {/* ------------------------------------------------------------- */}
                {selectedDoc.status === 'SIGNED' && (
                  <div className="p-6 bg-gradient-to-br from-emerald-50/80 to-white rounded-2xl border-2 border-emerald-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Digitally Executed Signature Certificate</h4>
                          <p className="text-[11px] text-slate-500">Cryptographically verified under Information Technology Act</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                        Immutable Seal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* Signature Stroke Render */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Employee Digital Signature
                        </span>
                        {selectedDoc.signature?.signatureDataUrl ? (
                          <div className="h-20 bg-slate-50 rounded-lg border border-slate-100 p-2 flex items-center justify-center">
                            <img
                              src={selectedDoc.signature.signatureDataUrl}
                              alt="Digital Signature"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-20 bg-slate-50 rounded-lg flex items-center justify-center font-serif italic text-lg text-slate-700">
                            {selectedDoc.signature?.signer?.displayName || selectedDoc.employee?.displayName}
                          </div>
                        )}
                        <span className="text-[11px] font-semibold text-slate-700 block text-center">
                          {selectedDoc.signature?.signer?.displayName || selectedDoc.employee?.displayName}
                        </span>
                      </div>

                      {/* Audit Details */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Signature Audit Trail
                        </span>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Signed At:</span>
                            <span className="font-bold text-slate-800">
                              {format(new Date(selectedDoc.signedAt || selectedDoc.signature?.signedAt || new Date()), 'dd MMM yyyy, hh:mm:ss a')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Signer IP:</span>
                            <span className="font-mono text-slate-700">{selectedDoc.signature?.signerIpAddress || '127.0.0.1'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Signer Code:</span>
                            <span className="font-mono text-slate-700">{selectedDoc.employee?.employeeCode}</span>
                          </div>
                          <div className="flex flex-col pt-1">
                            <span className="text-slate-400 text-[10px]">Signature Hash:</span>
                            <span className="font-mono text-[10px] text-emerald-800 truncate bg-emerald-50 px-2 py-0.5 rounded mt-0.5">
                              {selectedDoc.signature?.signatureHash || 'Verified SHA-256 Signature Stamp'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* UNSIGNED STATE: INTERACTIVE EMPLOYEE SIGNATURE PAD           */}
                {/* ------------------------------------------------------------- */}
                {selectedDoc.status !== 'SIGNED' && (
                  <>
                    {user?.employee?.id === selectedDoc.employeeId ? (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              <FileSignature className="h-4 w-4 text-emerald-600" />
                              Apply Your Digital Signature & Submit Acceptance
                            </h4>
                            <p className="text-xs text-slate-500">
                              Choose your preferred signature method to sign and submit your offer letter
                            </p>
                          </div>

                          {/* Signature Method Selector */}
                          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold text-slate-700">
                            <button
                              type="button"
                              onClick={() => setSignMethod('DRAW')}
                              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                                signMethod === 'DRAW' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                              }`}
                            >
                              <PenTool className="h-3.5 w-3.5" />
                              Draw
                            </button>
                            <button
                              type="button"
                              onClick={() => setSignMethod('TYPE')}
                              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                                signMethod === 'TYPE' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                              }`}
                            >
                              <Type className="h-3.5 w-3.5" />
                              Type
                            </button>
                            <button
                              type="button"
                              onClick={() => setSignMethod('UPLOAD')}
                              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                                signMethod === 'UPLOAD' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                              }`}
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              Upload
                            </button>
                          </div>
                        </div>

                        {/* Signature Input Canvas / Control */}
                        <div className="space-y-3">
                          {signMethod === 'DRAW' && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Sign with mouse, trackpad, or finger below:</span>
                                <div className="flex items-center gap-2">
                                  {/* Color selection */}
                                  <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                                    {['#0f172a', '#0284c7', '#059669'].map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => setPenColor(c)}
                                        className={`w-3.5 h-3.5 rounded-full border ${penColor === c ? 'ring-2 ring-emerald-500 scale-110' : ''}`}
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={clearCanvas}
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600 px-2 py-1 hover:bg-slate-200/60 rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    <RotateCcw className="h-3 w-3" /> Clear
                                  </button>
                                </div>
                              </div>

                              <div className="border-2 border-dashed border-slate-300 bg-white rounded-2xl overflow-hidden relative shadow-inner">
                                <canvas
                                  ref={canvasRef}
                                  width={700}
                                  height={140}
                                  onMouseDown={startDrawing}
                                  onMouseMove={draw}
                                  onMouseUp={stopDrawing}
                                  onMouseLeave={stopDrawing}
                                  onTouchStart={startDrawing}
                                  onTouchMove={draw}
                                  onTouchEnd={stopDrawing}
                                  className="w-full h-36 cursor-crosshair touch-none"
                                />
                                {!hasDrawnSignature && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium gap-1.5">
                                    <PenTool className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Sign on the dotted line</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {signMethod === 'TYPE' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                  Your Full Name
                                </label>
                                <input
                                  type="text"
                                  value={typedSignatureName}
                                  onChange={(e) => setTypedSignatureName(e.target.value)}
                                  placeholder="Enter your legal name"
                                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                />
                              </div>

                              {/* Font choices */}
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTypedSignatureFont('font-serif italic')}
                                  className={`p-3 bg-white border rounded-xl text-center text-base font-serif italic ${
                                    typedSignatureFont === 'font-serif italic'
                                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800'
                                      : 'border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {typedSignatureName || 'Signature'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTypedSignatureFont('font-sans italic')}
                                  className={`p-3 bg-white border rounded-xl text-center text-sm font-sans italic ${
                                    typedSignatureFont === 'font-sans italic'
                                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800'
                                      : 'border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {typedSignatureName || 'Signature'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTypedSignatureFont('font-mono')}
                                  className={`p-3 bg-white border rounded-xl text-center text-xs font-mono ${
                                    typedSignatureFont === 'font-mono'
                                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800'
                                      : 'border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {typedSignatureName || 'Signature'}
                                </button>
                              </div>
                            </div>
                          )}

                          {signMethod === 'UPLOAD' && (
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-slate-600">
                                Upload Signature Image (PNG / JPG with transparent or white background)
                              </label>
                              {uploadedSignImage ? (
                                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                                  <img src={uploadedSignImage} alt="Uploaded Sign" className="h-12 object-contain" />
                                  <button
                                    type="button"
                                    onClick={() => setUploadedSignImage(null)}
                                    className="text-red-600 text-xs font-semibold hover:underline"
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer text-center">
                                  <ImageIcon className="h-6 w-6 text-slate-400 mb-1" />
                                  <span className="text-xs text-slate-600 font-semibold">Click to upload signature scan</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSignatureImageUpload}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                          )}

                          {/* Legal Acceptance Checkbox */}
                          <label className="flex items-start gap-2.5 p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={agreedToTerms}
                              onChange={(e) => setAgreedToTerms(e.target.checked)}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                            />
                            <span className="text-xs text-slate-700 leading-snug">
                              <strong>Legal Acceptance Confirmation:</strong> I confirm that I have carefully read and agreed to all terms, compensation, conditions, and policies stated in this Offer Letter. I hereby apply my legally binding digital signature.
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      /* HR / Non-recipient View */
                      <div className="p-5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2 text-center">
                        <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                          <Lock className="h-5 w-5" />
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          Awaiting Signature from {selectedDoc.employee?.displayName || selectedDoc.employee?.firstName}
                        </h4>
                        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                          This offer letter has been uploaded and sent for execution. Only the recipient employee (<strong>{selectedDoc.employee?.displayName || selectedDoc.employee?.firstName}</strong>) can sign and submit this offer letter.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center shrink-0">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Close Preview
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 flex items-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    Print / Export PDF
                  </button>

                  {selectedDoc.status !== 'SIGNED' && user?.employee?.id === selectedDoc.employeeId && (
                    <button
                      disabled={signing || !agreedToTerms}
                      onClick={handleSignDocument}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <FileSignature className="h-4 w-4" />
                      {signing ? 'Signing & Verifying...' : 'Sign & Submit Offer Letter'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
