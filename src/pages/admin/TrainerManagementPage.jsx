import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveTrainerData, loadTrainerData } from '../../utils/firestoreTrainers';
import { Button } from '@/components/ui/button';
import { Upload, Download, Plus, Edit, Trash2, X, User, Mail, Phone, Briefcase, FileText, Users, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

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
  const [trainers, setTrainers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState(emptyTrainer);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Load trainers from Firestore on mount
  useEffect(() => {
    async function fetchTrainers() {
      const data = await loadTrainerData();
      setTrainers(data || []);
    }
    fetchTrainers();
  }, []);

  // Save trainers to Firestore whenever trainers state changes
  useEffect(() => {
    if (trainers.length > 0) {
      saveTrainerData(trainers);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editIndex !== null) {
      setTrainers(ts => ts.map((t, i) => i === editIndex ? { ...form } : t));
    } else {
      setTrainers(ts => [...ts, { ...form }]);
    }
    closeModal();
  };

  const handleDelete = (idx) => {
    if (window.confirm('Are you sure you want to delete this trainer?')) {
      setTrainers(ts => ts.filter((_, i) => i !== idx));
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

  return (
    <div className="p-6 bg-muted/5 rounded-lg min-h-full">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-border/50 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Trainer Accounts</h2>
              <p className="text-xs text-gray-500">Manage trainer profiles and information</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSampleDownload} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="w-3 h-3" />
              Sample
            </Button>
            <Button onClick={() => fileInputRef.current.click()} variant="outline" size="sm" className="flex items-center gap-2">
              <Upload className="w-3 h-3" />
              Import
            </Button>
          <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
            <Button onClick={handleExportAll} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="w-3 h-3" />
              Export
            </Button>
            <Button onClick={openAddModal} size="sm" className="flex items-center gap-2">
              <Plus className="w-3 h-3" />
              Add Trainer
            </Button>
          </div>
        </div>
      </div>

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
                  <Button onClick={() => openEditModal(idx)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button onClick={() => handleDelete(idx)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3 space-y-2">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(trainer.status)}`}>
                  {getStatusIcon(trainer.status)}
                  <span>{trainer.status}</span>
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

      {/* Enhanced Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input 
                      name="name" 
                      value={form.name} 
                      onChange={handleFormChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Enter full name"
                    />
              </div>
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                    <input 
                      name="id" 
                      value={form.id} 
                      onChange={handleFormChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="e.g., neo10172"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input 
                      name="email" 
                      value={form.email} 
                      onChange={handleFormChange} 
                      required 
                      type="email" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="email@company.com"
                    />
              </div>
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input 
                      name="phone" 
                      value={form.phone || ''} 
                      onChange={handleFormChange} 
                      type="tel" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                    <input 
                      name="specialization" 
                      value={form.specialization} 
                      onChange={handleFormChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="e.g., DSA, C++, Java"
                    />
              </div>
              <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select 
                      name="status" 
                      value={form.status} 
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Professional Summary */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">Professional Summary</h4>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                  <textarea 
                    name="summary" 
                    value={form.summary} 
                    onChange={handleFormChange} 
                    required 
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none" 
                    placeholder="Brief description of professional background and expertise"
                  />
                </div>
              </div>

              {/* Work Experience */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-sm font-medium text-gray-900">Work Experience</h4>
                  <Button type="button" onClick={addExperience} variant="outline" size="sm" className="flex items-center gap-2">
                    <Plus className="w-3 h-3" />
                    Add Experience
                  </Button>
                </div>
                
                <div className="space-y-3">
                {form.experience.map((exp, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Experience #{idx + 1}</span>
                    {form.experience.length > 1 && (
                          <Button 
                            type="button" 
                            onClick={() => removeExperience(idx)} 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input 
                          placeholder="Company" 
                          value={exp.company} 
                          onChange={e => handleExperienceChange(idx, 'company', e.target.value)} 
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                        />
                        <input 
                          placeholder="Role" 
                          value={exp.role} 
                          onChange={e => handleExperienceChange(idx, 'role', e.target.value)} 
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                        />
                        <input 
                          placeholder="Years" 
                          type="number" 
                          min="0" 
                          value={exp.years} 
                          onChange={e => handleExperienceChange(idx, 'years', e.target.value)} 
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                        />
                      </div>
                  </div>
                ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" onClick={closeModal} variant="outline">
                  Cancel
                </Button>
                <Button type="submit">
                  {editIndex !== null ? 'Update Trainer' : 'Add Trainer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerManagementPage;
  