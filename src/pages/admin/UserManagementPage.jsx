import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAllUsers, subscribeToUsers } from '../../utils/firestoreUsers';
import { createInvitation, subscribeToInvitations, resendInvitation } from '../../utils/firestoreInvitations';
import InviteUserForm from '../../components/admin/InviteUserForm';
import UserList from '../../components/admin/UserList';
import InvitationList from '../../components/admin/InvitationList';
import { Button } from '@/components/ui/button';
import { Plus, Users, Filter, UserCheck, UserCog, Shield, Search, Upload, FileSpreadsheet, AlertCircle, Download, Mail, CalendarClock, Clock3, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

const UserManagementPage = () => {
  const { setCommandState } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState('users');
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('all');
  const [invitationSearchTerm, setInvitationSearchTerm] = useState('');
  const debouncedInvitationSearchTerm = useDebounce(invitationSearchTerm, 300);
  const [resendingInvitationId, setResendingInvitationId] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToUsers(
      {},
      (data) => {
        setUsers(data);
        setLoading(false);
      },
      (error) => {
        console.error('Real-time users listener error:', error);
        setLoading(false);
        toast({
          title: 'Real-time update failed',
          description: 'Unable to subscribe to user changes. Please refresh manually.',
          variant: 'destructive'
        });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToInvitations(
      {},
      (data) => {
        setInvitations(data);
        setInvitationsLoading(false);
      },
      (error) => {
        console.error('Real-time invitations listener error:', error);
        setInvitationsLoading(false);
        toast({
          title: 'Invitation updates failed',
          description: 'Unable to subscribe to invitation changes. Please refresh manually.',
          variant: 'destructive'
        });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }
    
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((user) => {
        const nameMatch = user.displayName?.toLowerCase().includes(searchLower);
        const emailMatch = user.email?.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      });
    }
    
    return filtered;
  }, [users, roleFilter, debouncedSearchTerm]);

  const filteredInvitations = useMemo(() => {
    let filtered = invitations;

    if (invitationStatusFilter !== 'all') {
      filtered = filtered.filter(
        (invitation) => (invitation.computedStatus || invitation.status) === invitationStatusFilter
      );
    }

    if (debouncedInvitationSearchTerm.trim()) {
      const searchLower = debouncedInvitationSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((invitation) => {
        const nameMatch = invitation.displayName?.toLowerCase().includes(searchLower);
        const emailMatch = invitation.email?.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      });
    }

    return filtered;
  }, [invitations, invitationStatusFilter, debouncedInvitationSearchTerm]);

  const handleInviteSuccess = () => {
    setShowInviteForm(false);
  };

  const handleResendInvitation = async (invitation) => {
    if (!invitation?.invitationId) return;

    try {
      setResendingInvitationId(invitation.invitationId);
      const result = await resendInvitation(invitation.invitationId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to resend invitation');
      }

      toast({
        title: 'Invitation resent',
        description: `We resent the invite to ${invitation.email}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      toast({
        title: 'Resend failed',
        description: error.message || 'Unable to resend invitation. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setResendingInvitationId(null);
    }
  };

  const roleOptions = [
    { value: 'all', label: 'All Users', icon: Users },
    { value: 'admin', label: 'Admins', icon: Shield },
    { value: 'trainer', label: 'Trainers', icon: UserCheck },
    { value: 'program_manager', label: 'Program Managers', icon: UserCog }
  ];

  const invitationStatusOptions = [
    { value: 'all', label: 'All Invitations' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'expired', label: 'Expired' }
  ];

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    trainer: users.filter((u) => u.role === 'trainer').length,
    program_manager: users.filter((u) => u.role === 'program_manager').length,
    active: users.filter((u) => u.status === 'active').length
  }), [users]);

  const invitationStats = useMemo(() => ({
    total: invitations.length,
    pending: invitations.filter((inv) => (inv.computedStatus || inv.status) === 'pending').length,
    accepted: invitations.filter((inv) => (inv.computedStatus || inv.status) === 'accepted').length,
    expired: invitations.filter((inv) => (inv.computedStatus || inv.status) === 'expired').length
  }), [invitations]);

  // Set up command ribbon
  useEffect(() => {
    setCommandState({
      title: 'User Management',
      description: 'Manage users, roles, permissions, and invitations across the platform.',
      actions: (
        <>
          <Button
            onClick={() => {
              setShowBulkInvite(!showBulkInvite);
              setShowInviteForm(false);
              setActiveTab('users');
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Invite (CSV)
          </Button>
        <Button
            onClick={() => {
              setShowInviteForm(!showInviteForm);
              setShowBulkInvite(false);
              setActiveTab('users');
            }}
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
        >
            <Plus className="h-4 w-4" />
          Invite User
        </Button>
        </>
      ),
      metrics: [
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
            <Users className="h-8 w-8 text-indigo-600" />
      </div>
        </div>,
        <div key="active" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Active Users</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
            </div>
            <UserCheck className="h-8 w-8 text-emerald-600" />
          </div>
        </div>,
        <div key="admins" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Admins</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.admin}</p>
            </div>
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
        </div>,
        <div key="trainers" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Trainers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.trainer}</p>
            </div>
            <UserCheck className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="program-managers" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Program Managers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.program_manager}</p>
            </div>
            <UserCog className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="pending" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Pending Invitations</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{invitationStats.pending}</p>
            </div>
            <Mail className="h-8 w-8 text-amber-600" />
          </div>
        </div>,
      ],
    });
  }, [stats, invitationStats, setCommandState, showInviteForm, showBulkInvite, activeTab, setShowBulkInvite, setShowInviteForm, setActiveTab]);

  if (loading || invitationsLoading) {
    return <LoadingSkeleton message={`Loading ${activeTab === 'users' ? 'users' : 'invitations'}...`} />;
  }

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm p-2 flex gap-2 w-full sm:w-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'users'
              ? 'bg-[#2C2C2C] text-white shadow-sm'
              : 'text-[#666666] hover:bg-[#F5F5F5]'
          }`}
        >
          <Users className="h-4 w-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'invitations'
              ? 'bg-[#2C2C2C] text-white shadow-sm'
              : 'text-[#666666] hover:bg-[#F5F5F5]'
          }`}
        >
          <Mail className="h-4 w-4" />
          Invitations
        </button>
      </div>

      {activeTab === 'users' && (
        <>
      {/* Invite User Form */}
          {showInviteForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <InviteUserForm 
            onSuccess={handleInviteSuccess}
            onCancel={() => setShowInviteForm(false)}
          />
        </motion.div>
      )}

      {/* Bulk Invite Panel */}
          {showBulkInvite && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <BulkInvitePanel
            adminUser={user}
            onSuccess={() => {
              setShowBulkInvite(false);
            }}
            onCancel={() => setShowBulkInvite(false)}
          />
        </motion.div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm"
              />
            </div>
          </div>
          
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#666666]" />
            <span className="text-sm font-medium text-[#666666]">Filter by role:</span>
            <div className="flex gap-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setRoleFilter(option.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                      ${roleFilter === option.value
                        ? 'bg-[#E8E8E8] text-[#2C2C2C] border border-[#D0D0D0]'
                        : 'text-[#666666] hover:bg-[#F5F5F5]'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* User List */}
      <UserList 
        users={filteredUsers} 
        loading={loading}
        onRefresh={fetchUsers}
      />
        </>
      )}

      {activeTab === 'invitations' && (
        <>
          {/* Invitation Filters */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
                  <input
                    type="text"
                    placeholder="Search invitations..."
                    value={invitationSearchTerm}
                    onChange={(e) => setInvitationSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#666666]" />
                <span className="text-sm font-medium text-[#666666]">Status:</span>
                <div className="flex gap-2">
                  {invitationStatusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setInvitationStatusFilter(option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${invitationStatusFilter === option.value
                          ? 'bg-[#E8E8E8] text-[#2C2C2C] border border-[#D0D0D0]'
                          : 'text-[#666666] hover:bg-[#F5F5F5]'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <InvitationList
            invitations={filteredInvitations}
            loading={invitationsLoading}
            onResend={handleResendInvitation}
            resendingId={resendingInvitationId}
            emptyStateMessage="Invite teammates to see them tracked here. Pending invites can be resent anytime."
          />
        </>
      )}
    </div>
  );
};

export default UserManagementPage;

const BulkInvitePanel = ({ adminUser, onSuccess, onCancel }) => {
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [csvError, setCsvError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState({ success: 0, failed: 0 });
  const { toast } = useToast();

  const allowedRoles = ['trainer', 'program_manager', 'admin'];

  const resetState = () => {
    setParsedRows([]);
    setFileName('');
    setCsvError(null);
    setSummary({ success: 0, failed: 0 });
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    if (lines.length === 0) {
      setCsvError('Uploaded file is empty.');
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIdx = headers.findIndex(h => h === 'email');
    const nameIdx = headers.findIndex(h => h === 'displayname' || h === 'display_name' || h === 'name');
    const roleIdx = headers.findIndex(h => h === 'role');

    if (emailIdx === -1 || nameIdx === -1 || roleIdx === -1) {
      setCsvError('CSV must contain headers: email, displayName, role');
      setParsedRows([]);
      return;
    }

    const rows = lines.slice(1).map((line, rowIndex) => {
      const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
      const email = values[emailIdx] || '';
      const displayName = values[nameIdx] || '';
      const role = (values[roleIdx] || '').toLowerCase();

      const errors = [];
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email');
      }
      if (!displayName) {
        errors.push('Display name required');
      }
      if (!role || !allowedRoles.includes(role)) {
        errors.push('Role must be trainer, program_manager, or admin');
      }

      return {
        id: rowIndex,
        rowNumber: rowIndex + 2, // account for header row
        email,
        displayName,
        role: role || 'trainer',
        errors,
        status: errors.length ? 'invalid' : 'pending',
        message: ''
      };
    });

    setParsedRows(rows);
    setCsvError(null);
    setSummary({ success: 0, failed: 0 });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        parseCSV(text);
      } else {
        setCsvError('Unable to read file contents.');
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read the file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = 'email,displayName,role\ntrainer1@example.com,Trainer One,trainer\npm@example.com,Program Manager,program_manager\nadmin@example.com,Admin User,admin';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk-invite-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFailures = () => {
    const failedRows = parsedRows.filter(row => row.status === 'error' || row.status === 'invalid');
    if (failedRows.length === 0) {
      toast({
        title: 'No failures to download',
        description: 'All rows processed successfully.',
      });
      return;
    }

    const header = 'email,displayName,role,error\n';
    const rows = failedRows.map(row => {
      const errorMsg = row.errors.length ? row.errors.join('; ') : row.message;
      return `${row.email},${row.displayName},${row.role},"${errorMsg}"`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk-invite-failures.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleProcessInvites = async () => {
    if (!adminUser?.uid || !adminUser.email) {
      toast({
        title: 'Admin credentials not found',
        description: 'Please log in again as an admin.',
        variant: 'destructive'
      });
      return;
    }

    if (!parsedRows.length) {
      toast({
        title: 'No data to process',
        description: 'Please upload a CSV file before processing.',
        variant: 'destructive'
      });
      return;
    }

    const validRows = parsedRows.filter(row => row.errors.length === 0);
    if (!validRows.length) {
      toast({
        title: 'No valid rows to process',
        description: 'All rows contain validation errors. Please fix them and try again.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;

    for (const row of parsedRows) {
      if (row.errors.length) {
        failedCount++;
        setParsedRows(prev =>
          prev.map(item =>
            item.id === row.id
              ? { ...item, status: 'invalid', message: row.errors.join(', ') }
              : item
          )
        );
        continue;
      }

      setParsedRows(prev =>
        prev.map(item =>
          item.id === row.id
            ? { ...item, status: 'processing', message: 'Sending invitation…' }
            : item
        )
      );

      try {
        const result = await createInvitation(
          {
            email: row.email,
            displayName: row.displayName,
            role: row.role
          },
          adminUser.uid
        );

        if (result.success) {
          successCount++;
          setParsedRows(prev =>
            prev.map(item =>
              item.id === row.id
                ? {
                    ...item,
                    status: 'success',
                    message: 'Invitation email sent successfully.'
                  }
                : item
            )
          );
        } else {
          failedCount++;
          setParsedRows(prev =>
            prev.map(item =>
              item.id === row.id
                ? {
                    ...item,
                    status: 'error',
                    message: result.error || 'Failed to send invitation'
                  }
                : item
            )
          );
        }

        // Throttle slightly to avoid hammering email service
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        failedCount++;
        console.error('Bulk invite error:', error);
        setParsedRows(prev =>
          prev.map(item =>
            item.id === row.id
              ? {
                  ...item,
                  status: 'error',
                  message: error.message || 'Unexpected error'
                }
              : item
          )
        );
      }
    }

    setIsProcessing(false);
    setSummary({ success: successCount, failed: failedCount });

    toast({
      title: 'Bulk invitations sent',
      description: `Invitations sent: ${successCount}. Failed: ${failedCount}.`,
      variant: failedCount ? 'destructive' : 'default'
    });

    if (failedCount === 0) {
      onSuccess();
      resetState();
    }
  };

  const totalInvalid = parsedRows.filter(row => row.status === 'invalid').length;
  const totalErrors = parsedRows.filter(row => row.status === 'error').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[#E0E0E0] shadow-sm rounded-lg p-6 space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E8E8E8] rounded-lg">
            <Upload className="h-5 w-5 text-[#5A5A5A]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#2C2C2C]">Bulk Invite Users</h2>
            <p className="text-sm text-[#666666]">
              Upload a CSV file with columns: <strong>email, displayName, role</strong>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate} className="flex items-center gap-2 border-[#D0D0D0]">
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <Button variant="outline" onClick={resetState} className="border-[#D0D0D0]">
            Reset
          </Button>
          <Button variant="outline" onClick={onCancel} className="border-[#D0D0D0]">
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#F9F9F9] border border-[#E0E0E0] rounded-lg p-4 space-y-3">
          <label className="block text-sm font-medium text-[#2C2C2C]">Upload CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="w-full text-sm text-[#666666] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E8E8E8] file:text-[#2C2C2C] hover:file:bg-[#D5D5D5]"
          />
          {fileName && (
            <p className="text-xs text-[#888888]">Selected file: {fileName}</p>
          )}
          {csvError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {csvError}
            </div>
          )}
          <div className="text-xs text-[#888888] space-y-1">
            <p>• Roles must be one of: trainer, program_manager, admin</p>
            <p>• Each valid row triggers an email invitation with a secure signup link</p>
            <p>• Users create their own password during signup</p>
          </div>
        </div>

        <div className="bg-[#F9F9F9] border border-[#E0E0E0] rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#2C2C2C]">Send Invitations</h3>
          <p className="text-xs text-[#666666]">
            Invitations will be emailed from{' '}
            <span className="font-medium text-[#2C2C2C]">{adminUser?.email || 'N/A'}</span>. Each invite
            contains a signup link that expires in 7 days.
          </p>
          <Button
            onClick={handleProcessInvites}
            disabled={
              isProcessing ||
              !parsedRows.some(row => row.status === 'pending' || row.status === 'processing')
            }
            className="w-full bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C] flex items-center gap-2 justify-center disabled:opacity-60"
          >
            {isProcessing ? 'Sending Invitations…' : 'Send Invitations'}
          </Button>
          <Button
            onClick={handleDownloadFailures}
            disabled={!(totalErrors || totalInvalid)}
            variant="outline"
            className="w-full border-[#D0D0D0]"
          >
            Download Failures
          </Button>
          <div className="text-xs text-[#666666] space-y-1">
            <p>
              Invitations sent:{' '}
              <span className="text-green-600 font-semibold">{summary.success}</span>
            </p>
            <p>
              Failed or invalid:{' '}
              <span className="text-red-600 font-semibold">
                {summary.failed + totalErrors + totalInvalid}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
        <div className="bg-[#F5F5F5] px-4 py-2 text-sm font-medium text-[#2C2C2C] flex items-center justify-between">
          <span>Preview ({parsedRows.length} rows)</span>
          <span className="text-xs text-[#888888]">
            {parsedRows.filter(row => row.status === 'success').length} success •{' '}
            {totalErrors + totalInvalid} errors
          </span>
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F9F9F9]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Row</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Display Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Role</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Message</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-[#888888]">
                    Upload a CSV file to preview users to invite.
                  </td>
                </tr>
              ) : (
                parsedRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-[#F0F0F0] ${
                      row.status === 'success'
                        ? 'bg-green-50/60'
                        : row.status === 'error' || row.status === 'invalid'
                        ? 'bg-red-50/60'
                        : row.status === 'processing'
                        ? 'bg-yellow-50/60'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-xs text-[#666666]">{row.rowNumber}</td>
                    <td className="px-4 py-2 text-sm text-[#2C2C2C]">{row.email}</td>
                    <td className="px-4 py-2 text-sm text-[#2C2C2C]">{row.displayName}</td>
                    <td className="px-4 py-2 text-sm text-[#2C2C2C] capitalize">{row.role}</td>
                    <td className="px-4 py-2 text-xs font-medium text-[#2C2C2C]">
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </td>
                    <td className="px-4 py-2 text-xs text-[#666666]">
                      {row.errors.length ? row.errors.join(', ') : row.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

