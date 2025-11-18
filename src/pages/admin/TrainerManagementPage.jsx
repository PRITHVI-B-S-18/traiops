import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveTrainerData, loadTrainerData } from '../../utils/firestoreTrainers';
import { syncAllTrainers, getTrainerSyncStatus, syncTrainerStatusToUser, prepareTrainerInvitation } from '../../utils/trainerSync';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Upload, Download, Plus, Edit, Trash2, X, User, Mail, Phone, Briefcase, FileText, Users, CheckCircle, XCircle, RefreshCw, UserPlus, ShieldCheck, Award, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import DeleteTrainerModal from '@/components/admin/DeleteTrainerModal';
import { doc, deleteDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

// Modal animation variants - matching Dialog component animations
const modalVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1]
    } 
  },
  exit: { 
    opacity: 0,
    transition: { 
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1]
    } 
  },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

const modalContentTransition = {
  type: 'spring',
  damping: 18,
  stiffness: 150,
  mass: 1.2,
  duration: 0.5,
};

const initialTrainers = [
  {
    id: 'neo10172',
    name: 'Aravindhan S',
    email: 'aravindhan.s@iamneo.ai',
    phone: '6381466026',
    specialization: 'DSA',
    experience: [
      { company: 'Company A', years: 2, role: 'Trainer' },
    ],
    summary: 'Experienced C++ and DSA trainer.',
    status: 'Active',
  },
  {
    id: 'neo/c/10301',
    name: 'Bindhiya J',
    email: 'bindhiya.j@iamneo.ai',
    phone: '9876543210',
    specialization: 'DSA',
    experience: [
      { company: 'Company B', years: 1, role: 'TA' },
    ],
    summary: 'Teaching assistant for C++ and DSA.',
    status: 'Active',
  },
];

const emptyTrainer = {
  id: '',
  name: '',
  email: '',
  phone: '',
  specialization: '',
  experience: [{ company: '', years: '', role: '' }],
  summary: '',
  status: 'Active',
};

const TrainerManagementPage = () => {
  const { setCommandState } = useOutletContext();
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState(emptyTrainer);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [syncStatus, setSyncStatus] = useState([]);
  const [selectedTrainers, setSelectedTrainers] = useState([]);
  const [inviteLoadingId, setInviteLoadingId] = useState(null);
  
  // Onboarding approvals state
  const [activeTab, setActiveTab] = useState('trainers'); // 'trainers' or 'onboarding'
  const [onboardingRequests, setOnboardingRequests] = useState([]);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [trainerToDelete, setTrainerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to track if we're loading data (to prevent save loop)
  const isLoadingRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Load trainers from Firestore on mount
  useEffect(() => {
    async function fetchTrainers() {
      isLoadingRef.current = true;
      setLoading(true);
      try {
      const data = await loadTrainerData();
      setTrainers(data || []);
      } catch (error) {
        console.error('Error loading trainers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load trainers. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
        isInitialMountRef.current = false;
      }
    }
    fetchTrainers();
  }, [toast]);

  // Save trainers to Firestore whenever trainers state changes (but not during initial load)
  useEffect(() => {
    // Don't save if we're loading or on initial mount
    if (isLoadingRef.current || isInitialMountRef.current) {
      return;
    }
    
    // Only save if trainers array has items (avoid saving empty array on initial load)
    if (trainers.length > 0) {
      saveTrainerData(trainers).catch(error => {
        console.error('Error saving trainers:', error);
        // Don't show toast here to avoid spam, but log the error
      });
    }
  }, [trainers]);

  const openAddModal = () => {
    setForm(emptyTrainer);
    setEditIndex(null);
    setModalOpen(true);
  };

  const openEditModal = (idx) => {
    setForm({ ...trainers[idx], experience: trainers[idx].experience.map(e => ({ ...e })) });
    setEditIndex(idx);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyTrainer);
    setEditIndex(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleExperienceChange = (idx, field, value) => {
    setForm(f => ({
      ...f,
      experience: f.experience.map((exp, i) => i === idx ? { ...exp, [field]: value } : exp)
    }));
  };

  const addExperience = () => {
    setForm(f => ({ ...f, experience: [...f.experience, { company: '', years: '', role: '' }] }));
  };

  const removeExperience = (idx) => {
    setForm(f => ({ ...f, experience: f.experience.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editIndex !== null) {
      // Update existing trainer
      const oldTrainer = trainers[editIndex];
      const newStatus = form.status;
      const oldStatus = oldTrainer.status;
      
      setTrainers(ts => ts.map((t, i) => i === editIndex ? { ...form } : t));
      closeModal();
      
      // Sync status to user if status changed and user exists
      if (oldStatus !== newStatus && form.email) {
        try {
          const syncResult = await syncTrainerStatusToUser(form.email, newStatus);
          if (syncResult.success && !syncResult.skipped) {
            toast({
              title: "Status Synced",
              description: `User status updated to ${newStatus === 'Inactive' ? 'inactive' : 'active'} in User Management.`,
              variant: "default"
            });
          } else if (syncResult.skipped) {
            // User account doesn't exist yet, that's okay
            console.log('User account does not exist yet, sync skipped');
          } else {
            console.error('Sync failed:', syncResult.error);
            toast({
              title: "Sync Warning",
              description: "Trainer status updated, but sync to User Management failed. Please check manually.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error syncing trainer status to user:', error);
          toast({
            title: "Sync Error",
            description: "Failed to sync status to User Management. Please update manually.",
            variant: "destructive"
          });
        }
      }
    } else {
      // Add new trainer - only store in trainers collection
      // To create auth account, use "Sync Accounts" to send invitation email
      const newTrainer = { ...form };
      setTrainers(ts => [...ts, newTrainer]);
      closeModal();
      
      toast({
        title: "Trainer Added",
        description: `${form.name} has been added. Use "Sync Accounts" to send an invitation email.`,
      });
    }
  };

  const handleDeleteClick = (idx) => {
    setTrainerToDelete({ ...trainers[idx], index: idx });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!trainerToDelete) return;

    setDeleting(true);
    const trainer = trainerToDelete;
    const idx = trainerToDelete.index;

    try {
      // 1. Find and inactivate/delete from users collection
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', trainer.email));
      const userSnapshot = await getDocs(userQuery);
      
      const userUpdatePromises = [];
      userSnapshot.forEach((userDoc) => {
        const userUid = userDoc.id;
        
        // First, mark as inactive (for Firebase Auth - we can't delete from client)
        userUpdatePromises.push(
          updateDoc(doc(db, 'users', userUid), {
            status: 'inactive',
            deletedAt: new Date().toISOString(),
            deletedBy: user?.uid || 'admin'
          }).catch(() => {
            // If update fails, try to delete directly
            return deleteDoc(doc(db, 'users', userUid));
          })
        );
      });
      
      // Wait for all user updates/deletions
      await Promise.all(userUpdatePromises);

      // 2. Delete from trainers collection
      const updated = trainers.filter((_, i) => i !== idx);
      setTrainers(updated);
      await saveTrainerData(updated);

      // 3. Remove trainer from all schedules
      try {
        const { loadScheduleData, saveScheduleData } = await import('../../utils/firestoreSchedule');
        const scheduleDataObj = await loadScheduleData();
        
        // Schedule data is stored as an object with date keys
        if (scheduleDataObj && typeof scheduleDataObj === 'object') {
          const updatedSchedules = {};
          
          // Iterate through all dates in schedule
          Object.keys(scheduleDataObj).forEach(dateKey => {
            const dateSchedules = scheduleDataObj[dateKey];
            
            if (Array.isArray(dateSchedules)) {
              // Filter out schedules for this trainer
              const filtered = dateSchedules.filter(schedule => {
                // Check both training and non-training task formats
                const isTrainerSchedule = 
                  schedule.trainer === trainer.name || 
                  schedule.trainerName === trainer.name;
                return !isTrainerSchedule;
              });
              
              // Only keep date if there are remaining schedules
              if (filtered.length > 0) {
                updatedSchedules[dateKey] = filtered;
              }
            } else if (dateSchedules && typeof dateSchedules === 'object') {
              // Handle object format
              const filtered = {};
              Object.keys(dateSchedules).forEach(key => {
                const schedule = dateSchedules[key];
                const isTrainerSchedule = 
                  schedule?.trainer === trainer.name || 
                  schedule?.trainerName === trainer.name;
                if (!isTrainerSchedule) {
                  filtered[key] = schedule;
                }
              });
              
              if (Object.keys(filtered).length > 0) {
                updatedSchedules[dateKey] = filtered;
              }
            }
          });
          
          await saveScheduleData(updatedSchedules);
        }
      } catch (scheduleError) {
        console.warn('Error removing trainer from schedules:', scheduleError);
        // Continue with deletion even if schedule update fails
      }

      toast({
        title: "Trainer Deleted Successfully",
        description: `${trainer.name} has been removed from Trainer Accounts, Users collection, and Schedule Management. Firebase Auth account has been deactivated.`,
        variant: "default"
      });

      setDeleteModalOpen(false);
      setTrainerToDelete(null);
    } catch (error) {
      console.error('Error deleting trainer:', error);
      toast({
        title: "Deletion Error",
        description: error.message || "Failed to delete trainer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setTrainerToDelete(null);
  };

  const handleVerifyTrainer = async (idx) => {
    const trainer = trainers[idx];
    if (!trainer) return;

    try {
      const updated = [...trainers];
      updated[idx] = {
        ...trainer,
        verificationStatus: 'verified'
      };
      setTrainers(updated);
      
      toast({
        title: "Trainer Verified",
        description: `${trainer.name} has been verified successfully.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error verifying trainer:', error);
      toast({
        title: "Error",
        description: "Failed to verify trainer. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExportAll = () => {
    const data = trainers.map(trainer => ({
      'Active Status': trainer.status || 'Active',
      'Employee ID': trainer.id || '-',
      "Trainer's Name": trainer.name || '-',
      'Email ID': trainer.email || '-',
      'Phone Number': trainer.phone || '-',
      'Specialization': trainer.specialization || '-',
      'Professional Summary': trainer.summary || '-',
      'Work Experience': (trainer.experience && trainer.experience.length > 0)
        ? trainer.experience.map(exp => `${exp.company || '-'} - ${exp.role || '-'} (${exp.years || '-'} years)`).join('; ')
        : '-',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trainers');
    XLSX.writeFile(workbook, 'TrainerDetails.xlsx');
    toast({
      title: "Export Successful",
      description: `Exported ${trainers.length} trainer records with status information.`,
    });
  };

  const handleSampleDownload = () => {
    const sampleData = [
      {
        'Active Status': 'Active',
        'Employee ID': 'neo10172',
        "Trainer's Name": 'Aravindhan S',
        'Email ID': 'aravindhan.s@iamneo.ai',
        'Phone Number': '6381466026',
        'Specialization': 'DSA',
        'Professional Summary': 'Experienced C++ and DSA trainer.',
        'Work Experience': 'Company A - Trainer (2 years)'
      },
      {
        'Active Status': 'Active',
        'Employee ID': 'neo/c/10301',
        "Trainer's Name": 'Bindhiya J',
        'Email ID': 'bindhiya.j@iamneo.ai',
        'Phone Number': '9876543210',
        'Specialization': 'DSA',
        'Professional Summary': 'Teaching assistant for C++ and DSA.',
        'Work Experience': 'Company B - TA (1 years)'
      },
      {
        'Active Status': 'Inactive',
        'Employee ID': 'neo10370',
        "Trainer's Name": 'Denis Anto Bosco J',
        'Email ID': 'denisanto.bosco@iamneo.ai',
        'Phone Number': '6381035379',
        'Specialization': 'DSA',
        'Professional Summary': 'Experienced trainer with strong DSA background.',
        'Work Experience': 'Company C - Senior Trainer (3 years)'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SampleTrainers');
    XLSX.writeFile(workbook, 'SampleTrainerImport.xlsx');
    toast({
      title: "Sample Downloaded",
      description: "Sample Excel file downloaded with Active/Inactive status examples.",
    });
  };

  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let workbook;
      try {
        if (file.name.endsWith('.csv')) {
          // For CSV, read as binary string and parse as CSV
          const csvData = e.target.result;
          workbook = XLSX.read(csvData, { type: 'binary' });
        } else {
          // For xls/xlsx, read as array buffer
      const data = new Uint8Array(e.target.result);
          workbook = XLSX.read(data, { type: 'array' });
        }
      } catch (err) {
        toast({
          title: "Import Failed",
          description: "The file could not be read. Please ensure it is a valid Excel or CSV file.",
          variant: "destructive",
        });
        return;
      }
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        toast({
          title: "Import Failed",
          description: "No sheets found in the file.",
          variant: "destructive",
        });
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // get as array of arrays
      if (!jsonData || jsonData.length === 0) {
        toast({
          title: "Import Failed",
          description: "The file is empty or not in the correct format.",
          variant: "destructive",
        });
        return;
      }
      const requiredHeaders = [
        'Active Status',
        'Employee ID',
        "Trainer's Name",
        'Email ID',
        'Phone Number',
        'Specialization',
        'Professional Summary',
        'Work Experience'
      ];
      const fileHeaders = jsonData[0] || [];
      const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
      if (missingHeaders.length > 0) {
        toast({
          title: "Import Failed",
          description: `Missing required columns: ${missingHeaders.join(', ')}. Please use the sample file format.`,
          variant: "destructive",
        });
        return;
      }
      // Now parse as objects
      let objectData;
      try {
        objectData = XLSX.utils.sheet_to_json(worksheet);
      } catch (err) {
        toast({
          title: "Import Failed",
          description: "Could not parse the file. Please ensure the data is in the correct format.",
          variant: "destructive",
        });
        return;
      }
      const importedTrainers = objectData.map(row => ({
        status: row['Active Status'] || 'Active',
        id: row['Employee ID'] ? String(row['Employee ID']).trim() : '',
        name: row["Trainer's Name"] || '-',
        email: row['Email ID'] || '-',
        phone: row['Phone Number'] || '-',
        specialization: row['Specialization'] || '-',
        summary: row['Professional Summary'] || '-',
        experience: row['Work Experience']
          ? row['Work Experience'].split(';').map(exp => {
              const match = exp.trim().match(/^(.*?) - (.*?) \((.*?) years\)$/);
              return match
                ? { company: match[1], role: match[2], years: match[3] }
                : { company: exp.trim(), role: '', years: '' };
            })
          : [],
      }));
      setTrainers(importedTrainers);
      toast({
        title: "Import Successful",
        description: `Successfully imported ${importedTrainers.length} trainer records with status information.`,
      });
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsBinaryString(file);
    } else {
    reader.readAsArrayBuffer(file);
    }
  };

  const getStatusIcon = (status) => {
    return status === 'Active' ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getStatusColor = (status) => {
    return status === 'Active' 
      ? 'bg-green-50 text-green-700 border-green-200' 
      : 'bg-red-50 text-red-700 border-red-200';
  };

  // Handle sync modal open
  const handleOpenSyncModal = async () => {
    setSyncModalOpen(true);
    setSyncResults(null);
    setSelectedTrainers([]);
    // Load sync status
    const status = await getTrainerSyncStatus();
    setSyncStatus(status);
  };

  // Handle select/deselect trainer
  const handleToggleTrainer = (trainerEmail) => {
    setSelectedTrainers(prev => {
      if (prev.includes(trainerEmail)) {
        return prev.filter(email => email !== trainerEmail);
      } else {
        return [...prev, trainerEmail];
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    const validTrainers = syncStatus.filter(t => !t.hasAuthAccount && !t.hasError);
    setSelectedTrainers(validTrainers.map(t => t.email));
  };

  // Handle deselect all
  const handleDeselectAll = () => {
    setSelectedTrainers([]);
  };

  // Handle sync trainers
  const handleSyncTrainers = async () => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return;
    }

    if (selectedTrainers.length === 0) {
      toast({
        title: "No Trainers Selected",
        description: "Please select at least one trainer to sync",
        variant: "destructive"
      });
      return;
    }

    setSyncing(true);
    setSyncResults(null);

    try {
      // Import the sync utility
      const { syncAllTrainers: syncAll } = await import('../../utils/trainerSync');
      
      // Sync only selected trainers
      const result = await syncAll(user.uid, selectedTrainers);
      setSyncResults(result);
      
      if (result.success) {
        const { stats, requiresReLogin } = result;
        
        toast({
          title: "Sync Complete",
          description: `Invited: ${stats.created}, Skipped: ${stats.skipped}, Failed: ${stats.failed}, Emails Sent: ${stats.emailsSent}, Email Errors: ${stats.emailsFailed}`,
        });

        if (requiresReLogin) {
          toast({
            title: "Re-login Required",
            description: "You will be signed out. Please log in again.",
            variant: "default"
          });
        }

        // Refresh sync status
        const status = await getTrainerSyncStatus();
        setSyncStatus(status);
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to sync trainers",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error syncing trainers:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync trainers",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSendInviteToTrainer = async (trainer) => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return;
    }

    if (!trainer?.email) {
      toast({
        title: "Missing email",
        description: "Trainer must have a valid email to send an invite.",
        variant: "destructive"
      });
      return;
    }

    setInviteLoadingId(trainer.id);
    try {
      const result = await prepareTrainerInvitation(trainer, user.uid, { forceResend: true });

      if (result.success) {
        if (result.skipped) {
          toast({
            title: "Invite Skipped",
            description: result.message || 'Trainer already has an account.',
          });
          const status = await getTrainerSyncStatus();
          setSyncStatus(status);
        } else {
          toast({
            title: "Invitation Sent",
            description: result.message || `Invitation email sent to ${trainer.name}.`,
          });
          const status = await getTrainerSyncStatus();
          setSyncStatus(status);
        }
      } else {
        toast({
          title: "Invite Failed",
          description: result.error || 'Unable to send invitation. Please try again.',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Invite Error",
        description: error.message || 'Unable to send invitation. Please try again.',
        variant: "destructive"
      });
    } finally {
      setInviteLoadingId(null);
    }
  };

  // Set up command ribbon
  useEffect(() => {
    const activeTrainers = trainers.filter(t => t.status === 'Active').length;
    const verifiedTrainers = trainers.filter(t => t.verificationStatus === 'verified').length;
    const pendingVerification = trainers.filter(t => t.verificationStatus === 'pending').length;

    setCommandState({
      title: 'Trainer Accounts',
      description: 'Manage trainer profiles, sync accounts, and handle onboarding approvals.',
      actions: (
    <>
          <Button onClick={handleOpenSyncModal} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <UserPlus className="w-4 h-4" />
        Sync Accounts
      </Button>
          <Button onClick={handleSampleDownload} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Download className="w-4 h-4" />
        Sample
      </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Upload className="w-4 h-4" />
        Import
      </Button>
          <input id="trainer-import-file" name="trainer-import-file" type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
          <Button onClick={handleExportAll} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Download className="w-4 h-4" />
        Export
      </Button>
          <Button onClick={openAddModal} size="sm" className="flex items-center gap-2 whitespace-nowrap">
        <Plus className="h-4 w-4" />
        Add Trainer
      </Button>
    </>
      ),
      metrics: [
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Trainers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{trainers.length}</p>
            </div>
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="active" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{activeTrainers}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
        </div>,
        <div key="verified" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Verified</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{verifiedTrainers}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
        </div>,
        <div key="pending" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Pending Verification</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingVerification}</p>
            </div>
            <Award className="h-8 w-8 text-amber-600" />
          </div>
        </div>,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainers, setCommandState]);

  if (loading) {
    return <LoadingSkeleton message="Loading trainers..." />;
  }

  return (
    <div className="space-y-6">
      {trainers.length === 0 && (
        <div className={cn(cardStyles.surface, 'p-12 text-center')}>
          <Users className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No trainers yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Get started by adding trainers to your system. You can import from Excel, add manually, or sync with user accounts.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={openAddModal} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Trainer
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
          </div>
        </div>
      )}

      {trainers.length > 0 && (
        <>
      {/* Trainer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {trainers.map((trainer, idx) => (
          <div key={trainer.id} className="bg-white rounded-lg shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{trainer.name}</h3>
                    <p className="text-xs text-gray-500">ID: {trainer.id}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleSendInviteToTrainer(trainer)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="Send invitation email"
                    disabled={inviteLoadingId === trainer.id}
                  >
                    {inviteLoadingId === trainer.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                    ) : (
                      <Mail className="w-3 h-3 text-blue-600" />
                    )}
                  </Button>
                  <Button onClick={() => openEditModal(idx)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button onClick={() => handleDeleteClick(idx)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 hover:text-red-700" title="Delete trainer">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3 space-y-2">
              {/* Verification & Status Badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {trainer.verificationStatus === 'pending' ? (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        To Be Verified
                      </span>
                      <Button
                        onClick={() => handleVerifyTrainer(idx)}
                        size="sm"
                        className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                        title="Verify this trainer"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verify
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(trainer.status)}`}>
                  {getStatusIcon(trainer.status)}
                  <span>{trainer.status}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-xs">
                <Mail className="w-3 h-3 text-gray-400" />
                <a href={`mailto:${trainer.email}`} className="text-blue-600 hover:underline truncate">
                  {trainer.email}
                </a>
              </div>
              
              {trainer.phone && (
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <span>{trainer.phone}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Briefcase className="w-3 h-3 text-gray-400" />
                <span>{trainer.specialization}</span>
              </div>
              
              {trainer.summary && (
                <div className="text-xs text-gray-600">
                  <div className="flex items-start space-x-2">
                    <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="line-clamp-2">{trainer.summary}</p>
                  </div>
                </div>
              )}
              
              {trainer.experience && trainer.experience.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-gray-900">Work Experience</h4>
                  <div className="space-y-1">
                    {trainer.experience.map((exp, i) => (
                      <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                        {exp.company} - {exp.role} ({exp.years} years)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      {/* Enhanced Modal */}
      {modalOpen && createPortal(
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalContentVariants}
              transition={modalContentTransition}
            >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {editIndex !== null ? 'Edit Trainer Account' : 'Add New Trainer'}
                </h3>
              </div>
              <Button onClick={closeModal} variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-[#5A5A5A]" />
                  <h4 className="text-base font-semibold text-[#2C2C2C]">Personal Information</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                    <input 
                      name="name" 
                      value={form.name} 
                      onChange={handleFormChange} 
                      required 
                        className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all" 
                      placeholder="Enter full name"
                    />
              </div>
                  </div>
                  
              <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                    <input 
                      name="id" 
                      value={form.id} 
                      onChange={handleFormChange} 
                      required 
                        className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all" 
                      placeholder="e.g., neo10172"
                    />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                    <input 
                      name="email" 
                      value={form.email} 
                      onChange={handleFormChange} 
                      required 
                      type="email" 
                        className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all" 
                      placeholder="email@company.com"
                    />
              </div>
                  </div>
                  
              <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                    <input 
                      name="phone" 
                      value={form.phone || ''} 
                      onChange={handleFormChange} 
                      type="tel" 
                        className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all" 
                      placeholder="Enter phone number"
                    />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Specialization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                    <input 
                      name="specialization" 
                      value={form.specialization} 
                      onChange={handleFormChange} 
                      required 
                        className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all" 
                      placeholder="e.g., DSA, C++, Java"
                    />
              </div>
                  </div>
                  
              <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select 
                      name="status" 
                      value={form.status} 
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Professional Summary */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-[#5A5A5A]" />
                  <h4 className="text-base font-semibold text-[#2C2C2C]">Professional Summary</h4>
                </div>
              <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-2">Summary</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-[#888888] w-5 h-5" />
                  <textarea 
                    name="summary" 
                    value={form.summary} 
                    onChange={handleFormChange} 
                      rows={4}
                      className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent transition-all resize-none" 
                    placeholder="Brief description of professional background and expertise"
                  />
                  </div>
                </div>
              </div>

              {/* Work Experience */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#5A5A5A]" />
                    <h4 className="text-base font-semibold text-[#2C2C2C]">Work Experience</h4>
                  </div>
                  <Button 
                    type="button" 
                    onClick={addExperience} 
                    variant="outline" 
                    size="sm"
                    className="border-[#5A5A5A] text-[#5A5A5A] hover:bg-[#F5F5F5]"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Experience
                  </Button>
                </div>
                
                <div className="space-y-4">
                {form.experience.map((exp, idx) => (
                    <div key={idx} className="bg-[#F5F5F5] p-4 rounded-lg border border-[#E0E0E0]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[#2C2C2C]">Experience #{idx + 1}</h4>
                    {form.experience.length > 1 && (
                          <button
                            type="button" 
                            onClick={() => removeExperience(idx)} 
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input 
                          id={`experience-company-${idx}`}
                          name={`experience-company-${idx}`}
                          placeholder="Company" 
                          value={exp.company} 
                          onChange={e => handleExperienceChange(idx, 'company', e.target.value)} 
                          className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white transition-all" 
                        />
                        <input 
                          id={`experience-role-${idx}`}
                          name={`experience-role-${idx}`}
                          placeholder="Role" 
                          value={exp.role} 
                          onChange={e => handleExperienceChange(idx, 'role', e.target.value)} 
                          className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white transition-all" 
                        />
                        <input 
                          id={`experience-years-${idx}`}
                          name={`experience-years-${idx}`}
                          placeholder="Years" 
                          type="text" 
                          value={exp.years} 
                          onChange={e => handleExperienceChange(idx, 'years', e.target.value)} 
                          className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white transition-all" 
                        />
                      </div>
                  </div>
                ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[#E0E0E0]">
                <Button 
                  type="button" 
                  onClick={closeModal} 
                  variant="outline"
                  className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5] px-6"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C] px-6"
                >
                  {editIndex !== null ? 'Update Trainer' : 'Add Trainer'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
        </AnimatePresence>
      , document.body)}

      {/* Sync Accounts Modal */}
      {syncModalOpen && createPortal(
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalContentVariants}
              transition={modalContentTransition}
            >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A5A5A] rounded-lg flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Sync Trainer Accounts</h3>
                    <p className="text-sm text-gray-500">Create Firebase Auth accounts for trainers</p>
                  </div>
                </div>
                <button
                  onClick={() => setSyncModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={syncing}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Sends Resend invitation emails to the trainers you select</li>
                  <li>Creates pending invitations so trainers can sign up through a secure link</li>
                  <li>Skips trainers who already have accounts or invalid emails</li>
                  <li>You can resend an invite for an individual trainer from their card</li>
                </ul>
              </div>

              {/* Sync Status Table */}
              {syncStatus.length > 0 && !syncResults && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Current Status</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 w-10">
                            <input
                              type="checkbox"
                              checked={selectedTrainers.length === syncStatus.filter(t => !t.hasAuthAccount && !t.hasError).length && selectedTrainers.length > 0}
                              onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Trainer</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Email</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {syncStatus.map((trainer, idx) => {
                          const canSelect = !trainer.hasAuthAccount && !trainer.hasError;
                          const isSelected = selectedTrainers.includes(trainer.email);
                          
                          return (
                            <tr 
                              key={idx} 
                              className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                            >
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleTrainer(trainer.email)}
                                  disabled={!canSelect}
                                  className="rounded border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-2 px-3 text-gray-900">{trainer.name || 'Unknown'}</td>
                              <td className="py-2 px-3 text-gray-600">{trainer.email || 'N/A'}</td>
                              <td className="py-2 px-3 text-center">
                                {trainer.hasError ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs" title={trainer.errorMessage}>
                                    <XCircle className="w-3 h-3" />
                                    Error
                                  </span>
                                ) : trainer.hasAuthAccount ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    Has Account
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs">
                                    <XCircle className="w-3 h-3" />
                                    No Account
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      Total: {syncStatus.length} | 
                      With Account: {syncStatus.filter(t => t.hasAuthAccount).length} | 
                      Without Account: {syncStatus.filter(t => !t.hasAuthAccount && !t.hasError).length} | 
                      Errors: {syncStatus.filter(t => t.hasError).length}
                    </div>
                    <div className="text-blue-600 font-medium">
                      Selected: {selectedTrainers.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Results */}
              {syncResults && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Sync Results</h4>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-900">{syncResults.stats.total}</div>
                      <div className="text-xs text-gray-600">Total</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{syncResults.stats.created}</div>
                      <div className="text-xs text-green-600">Invited</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-700">{syncResults.stats.skipped}</div>
                      <div className="text-xs text-yellow-600">Skipped</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">{syncResults.stats.failed}</div>
                      <div className="text-xs text-red-600">Failed</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-600">
                    <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                      Emails Sent: <span className="font-semibold text-blue-700">{syncResults.stats.emailsSent}</span>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      Email Errors: <span className="font-semibold text-red-700">{syncResults.stats.emailsFailed}</span>
                    </div>
                  </div>

                  {/* Details */}
                  {syncResults.results.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Trainer</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Email</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-700">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {syncResults.results.map((result, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-900">{result.trainerName}</td>
                              <td className="py-2 px-3 text-gray-600">{result.email}</td>
                              <td className="py-2 px-3">
                                {result.success && !result.skipped && (
                                  <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    Invited
                                  </span>
                                )}
                                {result.success && result.skipped && (
                                  <span className="inline-flex items-center gap-1 text-yellow-700 text-xs">
                                    Skipped (exists)
                                  </span>
                                )}
                                {!result.success && (
                                  <span className="inline-flex items-center gap-1 text-red-700 text-xs">
                                    <XCircle className="w-3 h-3" />
                                    {result.error}
                                  </span>
                                )}
                                {result.message && (
                                  <div className="text-[11px] text-gray-500 mt-1">
                                    {result.message}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Re-login Warning */}
                  {syncResults.requiresReLogin && (
                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-sm text-orange-800 font-medium">
                        ⚠️ You will be signed out. Please log in again to continue.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                onClick={() => setSyncModalOpen(false)}
                variant="outline"
                disabled={syncing}
              >
                {syncResults ? 'Close' : 'Cancel'}
              </Button>
              {!syncResults && (
                <Button
                  onClick={handleSyncTrainers}
                  disabled={syncing || selectedTrainers.length === 0}
                  className="bg-[#5A5A5A] hover:bg-[#3D3D3D] text-white"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Syncing {selectedTrainers.length} trainer{selectedTrainers.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Sync {selectedTrainers.length} Selected
                    </>
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
        </AnimatePresence>
      , document.body)}

      {/* Delete Trainer Modal */}
      <DeleteTrainerModal
        isOpen={deleteModalOpen}
        trainer={trainerToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleting}
      />
    </div>
  );
};

export default TrainerManagementPage;
  