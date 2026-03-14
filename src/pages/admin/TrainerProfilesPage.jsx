import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { PDFViewer, PDFDownloadLink, Document, Page, Image, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import { parse, differenceInMonths } from 'date-fns';
import { Plus, FileText, AlertTriangle, Loader2, User, ChevronDown, Download, Filter, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import page1 from '../../assets/page1.png';
import page2 from '../../assets/page2.png';
import page3 from '../../assets/page3.png';
import footerImage from '../../assets/footer image.png';
import logo from '../../assets/logo.png';
import * as XLSX from 'xlsx';

Font.register({
  family: 'Poppins',
  src: '/fonts/Poppins/Poppins-Regular.ttf'
});

Font.register({
  family: 'Poppins',
  src: '/fonts/Poppins/Poppins-Bold.ttf',
  fontWeight: 'bold',
});

Font.register({
  family: 'Poppins',
  src: '/fonts/Poppins/Poppins-SemiBold.ttf',
  fontWeight: 'semibold',
});

Font.register({
  family: 'Poppins',
  src: '/fonts/Poppins/Poppins-ExtraBold.ttf',
  fontWeight: 'extrabold',
});

Font.register({
  family: 'Poppins',
  src: '/fonts/Poppins/Poppins-Medium.ttf',
  fontWeight: 'medium',
});

const getEmptyExperience = () => ({ role: '', organization: '', duration: '' });

const getInitialForm = () => ({
  name: '',
  designation: '',
  ugEducation: '',
  pgEducation: '',
  ugCollege: '',
  ugStartYear: '',
  ugEndYear: '',
  pgCollege: '',
  pgStartYear: '',
  pgEndYear: '',
  expertise: '',
  experience: '',
  experienceList: [getEmptyExperience()],
  aboutTrainer: '',
  showPhotoPlaceholder: true, // NEW FIELD
});

const calculateTotalExperience = (experienceList) => {
  let totalMonths = 0;
  const now = new Date();

  experienceList.forEach(exp => {
    if (exp.duration) {
      console.log("Processing duration:", exp.duration);
      // Use a regex to split, handling both hyphen-minus (-) and en dash (–)
      const parts = exp.duration.split(/\s*[–-]+\s*/); 
      if (parts.length === 2) {
        const startPart = parts[0].trim();
        let endPart = parts[1].trim();
        console.log("  Parts: ", { startPart, endPart });

        let startDate;
        let endDate;

        try {
          // Parse start date, assuming format like 'MMMM YYYY' (e.g., 'July 2020')
          startDate = parse(startPart, 'MMMM yyyy', new Date());

          if (endPart.toLowerCase() === 'present') {
            endDate = now;
          } else {
            // Parse end date
            endDate = parse(endPart, 'MMMM yyyy', new Date());
          }
          console.log("  Parsed Dates: ", { startDate, endDate });

          if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const monthsDiff = differenceInMonths(endDate, startDate);
            totalMonths += monthsDiff;
            console.log("  Months added for this entry:", monthsDiff);
          }
        } catch (error) {
          console.error("Error parsing date for experience duration:", exp.duration, error);
          // Continue to next experience if parsing fails
        }
      }
    }
  });
  console.log("Total months calculated:", totalMonths);

  // Convert total months to years, rounded to one decimal place
  return parseFloat((totalMonths / 12).toFixed(1));
};

const truncateText = (text, maxLength) => {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
};

// PDF styles
const styles = StyleSheet.create({
  page: { position: 'relative', width: '100%', height: '100%', fontFamily: 'Poppins' },
  pageWithPadding: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 0 },
  bgImage: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fceeee', height: 120, paddingHorizontal: 40, paddingTop: 50, marginTop: -48 },
  photoPlaceholder: { width: 80, height: 100, backgroundColor: '#fff', border: '1px solid #ccc', marginRight: 32 },
  headerText: { flex: 1, flexDirection: 'column', justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: 'extrabold', textAlign: 'left', marginBottom: 2, letterSpacing: 0.5, fontFamily: 'Poppins' },
  subheading: { fontSize: 18, fontWeight: 'medium', textAlign: 'left', marginBottom: 8, color: '#444', fontFamily: 'Poppins' },
  detailsSection: { marginTop: 24, paddingHorizontal: 40 },
  detailsRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
  detailsLabel: { fontWeight: 'bold', fontSize: 13, color: '#222', width: 160, textAlign: 'left', fontFamily: 'Poppins' },
  colonSeparator: { fontSize: 13, color: '#222', width: 10, textAlign: 'center', fontFamily: 'Poppins' },
  detailsValue: { fontSize: 13, color: '#222', flex: 1, paddingLeft: 5, fontFamily: 'Poppins' },
  sectionHeader: { fontWeight: 'semibold', fontSize: 15, marginTop: 15, marginBottom: 5, color: '#222', letterSpacing: 0.2, paddingHorizontal: 40, fontFamily: 'Poppins' },
  expList: { marginTop: 5, marginBottom: 8, paddingHorizontal: 40, paddingLeft: 58 },
  expItem: { marginBottom: 2, fontSize: 13, fontFamily: 'Poppins' },
  about: { marginTop: 10, fontSize: 12, lineHeight: 1.5, textAlign: 'justify', paddingHorizontal: 40, fontFamily: 'Poppins' },
  thankYou: { position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', fontSize: 24, color: '#fff', transform: 'translateY(-50%)' },
  footerImage: { position: 'absolute', width: '100%', height: 100, bottom: 0, left: 0, right: 0 },

  // New styles for Experience List alignment
  expItemRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  expRoleColumn: {
    width: 160, // Match detailsLabel width for alignment
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Poppins',
    textAlign: 'left',
  },
  expColonSeparator: {
    fontSize: 13,
    fontFamily: 'Poppins',
    width: 10,
    textAlign: 'center',
  },
  expDetailValue: {
    flex: 1,
    flexDirection: 'column', // Stack organization and duration
    fontSize: 13,
    color: '#222',
    paddingLeft: 5, // Match detailsValue paddingLeft
    fontFamily: 'Poppins',
  },
  expDurationIndented: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    lineHeight: 1.2,
  },
  experienceContentContainer: {
    marginTop: 0,
    paddingHorizontal: 40,
  },
});

const TrainerProfilePDF = ({ profile }) => (
  <Document>
    {/* Page 1: Cover */}
    <Page size="A4" style={styles.page}>
      <Image src={page1} style={styles.bgImage} />
    </Page>
    {/* Page 2: Profile Details with header and photo placeholder (padding ensures overflow pages have top/bottom gap) */}
    <Page size="A4" style={{ ...styles.page, ...styles.pageWithPadding, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        {profile.showPhotoPlaceholder && <View style={styles.photoPlaceholder} />}
        <View style={styles.headerText}>
          <Text style={styles.heading}>{truncateText(profile.name, 25)}</Text>
          <Text style={styles.subheading}>{profile.designation}</Text>
        </View>
      </View>
      <View style={styles.detailsSection}>
        <View style={styles.detailsRow}>
          <Text style={styles.detailsLabel}>UG Education</Text>
          <Text style={styles.colonSeparator}>:</Text>
          <View style={styles.detailsValue}>
            <Text>{profile.ugEducation}</Text>
            {profile.ugCollege && profile.ugStartYear && profile.ugEndYear && (
              <Text>{profile.ugCollege} ({profile.ugStartYear} - {profile.ugEndYear})</Text>
            )}
          </View>
        </View>
        {profile.pgEducation && profile.pgEducation.toUpperCase() !== 'NA' && (
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>PG Education</Text>
            <Text style={styles.colonSeparator}>:</Text>
            <View style={styles.detailsValue}>
              <Text>{profile.pgEducation}</Text>
              {profile.pgCollege && profile.pgStartYear && profile.pgEndYear && (
                <Text>{profile.pgCollege} ({profile.pgStartYear} - {profile.pgEndYear})</Text>
              )}
            </View>
          </View>
        )}
        <View style={styles.detailsRow}>
          <Text style={styles.detailsLabel}>Technical Expertise</Text>
          <Text style={styles.colonSeparator}>:</Text>
          <Text style={styles.detailsValue}>{profile.expertise}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.detailsLabel}>Experience</Text>
          <Text style={styles.colonSeparator}>:</Text>
          <Text style={styles.detailsValue}>{profile.experience} years</Text>
        </View>
      </View>
      <Text style={styles.sectionHeader}>Experience List</Text>
      <View style={styles.experienceContentContainer}>
        {profile.experienceList && [...profile.experienceList].reverse().map((exp, i) => (
          <View key={i} style={styles.expItemRow}>
            <Text style={styles.expRoleColumn}>{exp.role}</Text>
            <Text style={styles.expColonSeparator}>:</Text>
            <View style={styles.expDetailValue}>
              <Text>{exp.organization}</Text>
              {exp.duration && <Text style={styles.expDurationIndented}>({exp.duration})</Text>}
            </View>
          </View>
        ))}
      </View>
      {(() => {
        const aboutText = profile.aboutTrainer || '';
        // Match first "real" sentence: period must follow 2+ letters (avoids splitting at B.E., K.V.N, etc.)
        const firstSentenceMatch = aboutText.match(/^.*?[A-Za-z]{2,}\.\s*/);
        const matched = firstSentenceMatch ? firstSentenceMatch[0] : '';
        const firstSentence = matched ? matched.trimEnd() : aboutText.slice(0, 100);
        const restOfAbout = matched.length > 0 ? aboutText.slice(matched.length).trim() : (firstSentence.length < aboutText.length ? aboutText.slice(firstSentence.length).trim() : '');
        return (
          <>
            <View wrap={false}>
              <Text style={styles.sectionHeader}>About Trainer</Text>
              {firstSentence ? <Text style={styles.about}>{firstSentence}{restOfAbout ? ' ' : ''}</Text> : null}
            </View>
            {restOfAbout ? <Text style={styles.about}>{restOfAbout}</Text> : null}
          </>
        );
      })()}
      <Image src={footerImage} style={styles.footerImage} />
    </Page>
    {/* Page 3: page3.png as background only */}
    <Page size="A4" style={styles.page}>
      <Image src={page3} style={styles.bgImage} />
    </Page>
  </Document>
);

const TrainerProfilesPage = () => {
  const { setCommandState } = useOutletContext();
  const { toast } = useToast();
  const [form, setForm] = useState(getInitialForm());
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [isTrainerDropdownOpen, setIsTrainerDropdownOpen] = useState(false);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState('');
  const trainerDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (trainerDropdownRef.current && !trainerDropdownRef.current.contains(e.target)) {
        setIsTrainerDropdownOpen(false);
      }
    };
    if (isTrainerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTrainerDropdownOpen]);

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [originalFormState, setOriginalFormState] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedExpertise, setSelectedExpertise] = useState([]);
  const [isExpertiseDropdownOpen, setIsExpertiseDropdownOpen] = useState(false);
  const [expertiseSearchTerm, setExpertiseSearchTerm] = useState('');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const expertiseDropdownRef = useRef(null);

  // Parse expertise string into individual tokens (split by comma, semicolon, newline, " and ", colon)
  const parseExpertiseTokens = (str) => {
    if (!str || typeof str !== 'string') return [];
    return str
      .split(/[,;\n]|\s+and\s+|:\s*/gi)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const uniqueExpertise = useMemo(() => {
    const set = new Set();
    profiles.forEach((p) => {
      const tokens = parseExpertiseTokens(p.expertise);
      tokens.forEach((t) => set.add(t));
    });
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    if (!selectedExpertise.length) return profiles;
    return profiles.filter((p) => {
      const tokens = parseExpertiseTokens(p.expertise);
      return selectedExpertise.some((ex) => tokens.includes(ex));
    });
  }, [profiles, selectedExpertise]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
      if (expertiseDropdownRef.current && !expertiseDropdownRef.current.contains(e.target)) {
        setIsExpertiseDropdownOpen(false);
      }
    };
    if (exportDropdownOpen || isExpertiseDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen, isExpertiseDropdownOpen]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    setCommandState({
      title: 'Trainer Profiles',
      description: 'Create and manage professional trainer profiles with detailed qualifications and experience.',
      actions: (
        <Button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm(getInitialForm());
            setSelectedTrainerId('');
          }}
          size="sm"
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create Profile
        </Button>
      ),
      metrics: [
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Profiles</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{profiles.length}</p>
            </div>
            <FileText className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
      ],
    });
  }, [profiles, setCommandState]);

  const fetchProfiles = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, 'trainer_profiles'));
    setProfiles(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleAddExperience = () => {
    const updatedList = [...form.experienceList, getEmptyExperience()];
    setForm({ 
      ...form, 
      experienceList: updatedList, 
      experience: calculateTotalExperience(updatedList) 
    });
  };

  const handleExperienceChange = (index, field, value) => {
    const newExperienceList = [...form.experienceList];
    newExperienceList[index] = { ...newExperienceList[index], [field]: value };
    console.log('handleExperienceChange - newExperienceList:', newExperienceList);
    setForm({ 
      ...form, 
      experienceList: newExperienceList, 
      experience: calculateTotalExperience(newExperienceList) 
    });
  };

  const handleRemoveExperience = (index) => {
    const newExperienceList = form.experienceList.filter((_, i) => i !== index);
    setForm({ 
      ...form, 
      experienceList: newExperienceList, 
      experience: calculateTotalExperience(newExperienceList) 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'trainer_profiles', editId), form);
        toast({
          title: 'Profile updated',
          description: `${form.name}'s profile has been updated successfully.`,
        });
      } else {
        await addDoc(collection(db, 'trainer_profiles'), form);
        toast({
          title: 'Profile created',
          description: `${form.name}'s profile has been created successfully.`,
        });
      }
      setForm(getInitialForm());
      setShowForm(false);
      setEditId(null);
      fetchProfiles();
    } catch (error) {
      console.error("Error adding/updating document: ", error);
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (trainer) => {
    setForm({ ...trainer, experienceList: trainer.experienceList || [] });
    const deepCopiedExperienceList = JSON.parse(JSON.stringify(trainer.experienceList || []));
    setOriginalFormState({ ...trainer, experienceList: deepCopiedExperienceList });
    console.log('handleEdit - originalFormState.experienceList set to:', deepCopiedExperienceList);
    setShowForm(true);
    setEditId(trainer.id);
    setShowPdfPreview(false);
  };

  const handleDelete = (id) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    setShowDeleteConfirm(false);
    try {
      const profileToDelete = profiles.find(p => p.id === deleteTarget);
      await deleteDoc(doc(db, 'trainer_profiles', deleteTarget));
      toast({
        title: 'Profile deleted',
        description: profileToDelete?.name ? `${profileToDelete.name}'s profile has been deleted.` : 'Profile deleted successfully.',
      });
        fetchProfiles();
      } catch (error) {
        console.error("Error deleting document: ", error);
      toast({
        title: 'Error',
        description: 'Failed to delete profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setDeleteTarget(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    console.log('handleCancel - originalFormState before reset:', originalFormState);
    setForm(originalFormState || getInitialForm());
    setShowPdfPreview(false);
  };

  const flattenProfileForExport = (profile) => {
    const expList = profile.experienceList || [];
    const expStr = expList
      .map((e) => [e.role, e.organization, e.duration].filter(Boolean).join(' | '))
      .filter(Boolean)
      .join('; ');
    return {
      Name: profile.name || '',
      Designation: profile.designation || '',
      'UG Education': profile.ugEducation || '',
      'UG College': profile.ugCollege || '',
      'UG Start Year': profile.ugStartYear || '',
      'UG End Year': profile.ugEndYear || '',
      'PG Education': profile.pgEducation || '',
      'PG College': profile.pgCollege || '',
      'PG Start Year': profile.pgStartYear || '',
      'PG End Year': profile.pgEndYear || '',
      Expertise: profile.expertise || '',
      'Total Experience (years)': profile.experience ?? '',
      Experience: expStr,
      'About Trainer': profile.aboutTrainer || '',
    };
  };

  const handleExportCSV = () => {
    setExportDropdownOpen(false);
    const list = filteredProfiles.map(flattenProfileForExport);
    if (list.length === 0) {
      toast({ title: 'No data', description: 'No profiles to export.', variant: 'destructive' });
      return;
    }
    const headers = Object.keys(list[0]);
    const csvRows = [headers.join(',')];
    list.forEach((row) => {
      const values = headers.map((h) => {
        const v = row[h];
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      });
      csvRows.push(values.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trainer_profiles_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${list.length} profile(s) exported as CSV.` });
  };

  const handleExportExcel = () => {
    setExportDropdownOpen(false);
    const list = filteredProfiles.map(flattenProfileForExport);
    if (list.length === 0) {
      toast({ title: 'No data', description: 'No profiles to export.', variant: 'destructive' });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(list);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trainer Profiles');
    XLSX.writeFile(wb, `trainer_profiles_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Exported', description: `${list.length} profile(s) exported as Excel.` });
  };

  if (loading) {
    return <LoadingSkeleton message="Loading profiles..." />;
  }

  return (
    <div className="space-y-6">
      {profiles.length === 0 && (
        <div className={cn(cardStyles.surface, 'p-12 text-center')}>
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No trainer profiles yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Get started by creating your first trainer profile with detailed qualifications and experience.
          </p>
          <Button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm(getInitialForm());
            setSelectedTrainerId('');
          }}
            size="sm"
        >
            <Plus className="h-4 w-4 mr-2" />
          Create Profile
          </Button>
        </div>
      )}

      {profiles.length > 0 && (
        <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4" ref={trainerDropdownRef}>
            <label htmlFor="select-trainer" className="text-sm font-medium text-slate-700">Select Trainer</label>
            <div className="relative min-w-[220px]">
            <button
              id="select-trainer"
              type="button"
              onClick={() => {
                setIsTrainerDropdownOpen((prev) => !prev);
                if (!isTrainerDropdownOpen) setTrainerSearchTerm('');
              }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-left bg-white shadow-sm flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-slate-300"
            >
              <span className="truncate text-slate-900">
                {selectedTrainerId
                  ? (profiles.find((p) => p.id === selectedTrainerId)?.name ?? '-- Select Trainer --')
                  : filteredProfiles.length === 0 && selectedExpertise.length > 0
                    ? 'No match'
                    : '-- Select Trainer --'}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200', isTrainerDropdownOpen && 'rotate-180')}
              />
            </button>
            {isTrainerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 w-full min-w-[220px] bg-white shadow-lg rounded-lg border border-slate-200 flex flex-col max-h-96">
                <div className="p-2 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Search trainers..."
                    value={trainerSearchTerm}
                    onChange={(e) => setTrainerSearchTerm(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <ul className="py-1 overflow-y-auto max-h-80">
                  <li
                    onClick={() => {
                      setSelectedTrainerId('');
                      setShowForm(false);
                      setIsTrainerDropdownOpen(false);
                    }}
                    className={cn(
                      'px-3 py-2 text-sm cursor-pointer transition-colors',
                      !selectedTrainerId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    -- Select Trainer --
                  </li>
                  {[...filteredProfiles]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                    .filter((trainer) =>
                      (trainer.name || '').toLowerCase().includes(trainerSearchTerm.toLowerCase())
                    )
                    .map((trainer) => (
                      <li
                        key={trainer.id}
                        onClick={() => {
                          setSelectedTrainerId(trainer.id);
                          setShowForm(false);
                          setIsTrainerDropdownOpen(false);
                        }}
                        className={cn(
                          'px-3 py-2 text-sm cursor-pointer transition-colors',
                          selectedTrainerId === trainer.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        {trainer.name}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          </div>

          {uniqueExpertise.length > 0 && (
            <div className="flex items-center gap-2" ref={expertiseDropdownRef}>
              <Filter className="h-4 w-4 text-slate-500" />
              <label htmlFor="expertise-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">Technical expertise</label>
              <div className="relative min-w-[220px]">
                <button
                  id="expertise-filter"
                  type="button"
                  onClick={() => {
                    setIsExpertiseDropdownOpen((prev) => !prev);
                    if (!isExpertiseDropdownOpen) setExpertiseSearchTerm('');
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-left bg-white shadow-sm flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-slate-300"
                >
                  <span className="truncate text-slate-900">
                    {selectedExpertise.length === 0
                      ? 'All'
                      : selectedExpertise.length === 1
                        ? selectedExpertise[0]
                        : `${selectedExpertise.length} selected`}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedExpertise.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExpertise([]);
                        }}
                        className="p-0.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        aria-label="Deselect all"
                        title="Deselect all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronDown
                    className={cn('h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200', isExpertiseDropdownOpen && 'rotate-180')}
                    />
                  </div>
                </button>
                {isExpertiseDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-full min-w-[220px] bg-white shadow-lg rounded-lg border border-slate-200 flex flex-col max-h-96">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        placeholder="Search expertise..."
                        value={expertiseSearchTerm}
                        onChange={(e) => setExpertiseSearchTerm(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      {selectedExpertise.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedExpertise([])}
                          className="mt-2 w-full text-left text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Deselect all
                        </button>
                      )}
                    </div>
                    <ul className="py-1 overflow-y-auto max-h-80">
                      <li
                        onClick={() => {
                          setSelectedExpertise([]);
                        }}
                        className={cn(
                          'px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2',
                          selectedExpertise.length === 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span className={cn('inline-flex w-4 h-4 rounded border flex-shrink-0 items-center justify-center', selectedExpertise.length === 0 ? 'bg-blue-500 border-blue-500' : 'border-slate-300')}>
                          {selectedExpertise.length === 0 && <span className="text-white text-xs">✓</span>}
                        </span>
                        All
                      </li>
                      {uniqueExpertise
                        .filter((ex) =>
                          ex.toLowerCase().includes(expertiseSearchTerm.toLowerCase().trim())
                        )
                        .map((ex) => {
                          const isSelected = selectedExpertise.includes(ex);
                          return (
                            <li
                              key={ex}
                              onClick={() => {
                                setSelectedExpertise((prev) =>
                                  isSelected ? prev.filter((e) => e !== ex) : [...prev, ex]
                                );
                              }}
                              className={cn(
                                'px-3 py-2 text-sm cursor-pointer transition-colors truncate flex items-center gap-2',
                                isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              <span className={cn('inline-flex w-4 h-4 rounded border flex-shrink-0 items-center justify-center', isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300')}>
                                {isSelected && <span className="text-white text-xs">✓</span>}
                              </span>
                              {ex}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative" ref={exportDropdownRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExportDropdownOpen((o) => !o)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            {exportDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">{editId ? 'Edit Trainer Profile' : 'Add New Trainer Profile'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
              <input
                type="text"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UG Education</label>
              <input
                type="text"
                name="ugEducation"
                value={form.ugEducation}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UG College</label>
              <input
                type="text"
                name="ugCollege"
                value={form.ugCollege}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UG Start Year</label>
                <input
                  type="text"
                  name="ugStartYear"
                  value={form.ugStartYear}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UG End Year</label>
                <input
                  type="text"
                  name="ugEndYear"
                  value={form.ugEndYear}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PG Education (Optional)</label>
              <input
                type="text"
                name="pgEducation"
                value={form.pgEducation}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Type NA if not applicable"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PG College (Optional)</label>
              <input
                type="text"
                name="pgCollege"
                value={form.pgCollege}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Type NA if not applicable"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PG Start Year (Optional)</label>
                <input
                  type="text"
                  name="pgStartYear"
                  value={form.pgStartYear}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type NA if not applicable"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PG End Year (Optional)</label>
                <input
                  type="text"
                  name="pgEndYear"
                  value={form.pgEndYear}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type NA if not applicable"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Technical Expertise</label>
              <input
                type="text"
                name="expertise"
                value={form.expertise}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
              <input
                type="number"
                name="experience"
                value={form.experience}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="md:col-span-2 flex items-center mb-2">
              <input
                type="checkbox"
                id="showPhotoPlaceholder"
                name="showPhotoPlaceholder"
                checked={form.showPhotoPlaceholder}
                onChange={handleChange}
                className="mr-2"
              />
              <label htmlFor="showPhotoPlaceholder" className="text-sm font-medium text-gray-700">Show profile image placeholder in PDF</label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience List</label>
              {form.experienceList.map((exp, index) => (
                <div key={index} className="flex gap-4 mb-2">
                  <input
                    type="text"
                    placeholder="Role"
                    value={exp.role}
                    onChange={(e) => handleExperienceChange(index, 'role', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Organization"
                    value={exp.organization}
                    onChange={(e) => handleExperienceChange(index, 'organization', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., May 2020 - Present)"
                    value={exp.duration}
                    onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.experienceList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExperience(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddExperience}
                className="text-blue-600 hover:text-blue-800 text-sm mt-1"
              >
                + Add Experience
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">About Trainer</label>
              <textarea
                name="aboutTrainer"
                value={form.aboutTrainer}
                onChange={handleChange}
                rows="5"
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              ></textarea>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isProcessing}
                loadingText="Saving..."
              >
                {editId ? 'Update Profile' : 'Add Profile'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {selectedTrainerId && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Trainer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Name:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Designation:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.designation}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">UG Education:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.ugEducation}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">UG College:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.ugCollege}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">UG Start Year:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.ugStartYear}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">UG End Year:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.ugEndYear}</p>
            </div>
            {profiles.find(t => t.id === selectedTrainerId)?.pgEducation && profiles.find(t => t.id === selectedTrainerId)?.pgEducation.toUpperCase() !== 'NA' && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700">PG Education:</p>
                  <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.pgEducation}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">PG College:</p>
                  <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.pgCollege}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">PG Start Year:</p>
                  <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.pgStartYear}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">PG End Year:</p>
                  <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.pgEndYear}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">Technical Expertise:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.expertise}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Experience:</p>
              <p className="text-gray-900">{profiles.find(t => t.id === selectedTrainerId)?.experience} years</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Experience List:</p>
              <ul className="list-disc list-inside text-gray-900">
                {profiles.find(t => t.id === selectedTrainerId)?.experienceList && profiles.find(t => t.id === selectedTrainerId)?.experienceList.map((exp, i) => (
                  <li key={i}>
                    <span className="font-semibold">{exp.role}</span> – {exp.organization} ({exp.duration})
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-1">About Trainer:</p>
              <p className="text-gray-900 whitespace-pre-line">{profiles.find(t => t.id === selectedTrainerId)?.aboutTrainer}</p>
            </div>
            <div className="flex flex-col gap-2 min-w-[120px]">
              <Button
                onClick={() => handleEdit(profiles.find(t => t.id === selectedTrainerId))}
                className="w-full"
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(selectedTrainerId)}
                className="w-full"
              >
                Delete
              </Button>
              <Button
                onClick={() => setShowPdfPreview(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Generate PDF
              </Button>
            </div>
          </div>
          {showPdfPreview && (
            <div className="mt-8 border-t pt-6">
              <h4 className="text-xl font-semibold mb-2">PDF Preview</h4>
              <div className="bg-gray-100 p-4 rounded text-gray-500">
                <PDFViewer width="100%" height={600} showToolbar={true}>
                  <TrainerProfilePDF profile={profiles.find(t => t.id === selectedTrainerId)} />
                </PDFViewer>
                <div className="mt-4">
                  <PDFDownloadLink
                    document={<TrainerProfilePDF profile={profiles.find(t => t.id === selectedTrainerId)} />}
                    fileName={`${profiles.find(t => t.id === selectedTrainerId)?.name.replace(/\s+/g, '_')}_Profile.pdf`}
                  >
                    {({ loading }) => (
                      <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        {loading ? 'Preparing PDF...' : 'Download PDF'}
                      </button>
                    )}
                  </PDFDownloadLink>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Delete Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trainer profile? This action cannot be undone and will permanently remove all profile data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteTarget(null);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                isLoading={isProcessing}
                loadingText="Deleting..."
              >
                Delete Profile
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
};

export default TrainerProfilesPage; 