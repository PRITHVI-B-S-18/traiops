import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Award, Briefcase, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useToast } from '@/components/ui/use-toast';

const OnboardingForm = ({ user, onComplete, skipOnboarding = false }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingName, setLoadingName] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: user?.email || '',
    employeeId: '',
    phone: '',
    specialization: '',
    experience: [{ company: '', role: '', years: '' }],
    summary: ''
  });

  // Fetch trainer name from Firestore users collection
  useEffect(() => {
  const fetchTrainerName = async () => {
      if (!user?.uid) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const trainerName = userData.displayName || userData.name || user?.displayName || '';

          setForm(prev => ({
            ...prev,
            name: trainerName
          }));
        } else {
          // Fallback to user.displayName from auth
          setForm(prev => ({
            ...prev,
            name: user?.displayName || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching trainer name:', error);
        // Fallback to user.displayName from auth
        setForm(prev => ({
          ...prev,
          name: user?.displayName || ''
        }));
      } finally {
        setLoadingName(false);
      }
    };

    fetchTrainerName();
  }, [user]);

  const handleAddExperience = () => {
    setForm({
      ...form,
      experience: [...form.experience, { company: '', role: '', years: '' }]
    });
  };

  const handleRemoveExperience = (index) => {
    const newExperience = form.experience.filter((_, i) => i !== index);
    setForm({ ...form, experience: newExperience });
  };

  const handleExperienceChange = (index, field, value) => {
    const newExperience = [...form.experience];
    newExperience[index][field] = value;
    setForm({ ...form, experience: newExperience });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!form.name || !form.email || !form.phone || !form.specialization || !form.employeeId) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { loadTrainerData, saveTrainerData } = await import('../../utils/firestoreTrainers');
      
      // Generate trainer ID
      const trainerId = `neo${Date.now()}`;
      
      // Add to trainers collection immediately (with pending verification status)
      const trainers = await loadTrainerData();
      const newTrainer = {
        id: trainerId,
        name: form.name,
        email: form.email,
        employeeId: form.employeeId,
        phone: form.phone,
        specialization: form.specialization,
        experience: form.experience.filter(exp => exp.company || exp.role || exp.years),
        summary: form.summary || '',
        status: 'Active',
        verificationStatus: 'pending', // NEW: pending verification
        submittedAt: new Date().toISOString()
      };

      trainers.push(newTrainer);
      await saveTrainerData(trainers);

      // Create onboarding request for admin review
      const onboardingRef = doc(db, 'trainer_onboarding', user.uid);
      await setDoc(onboardingRef, {
        trainerId: user.uid,
        trainerAccountId: trainerId,
        details: {
          name: form.name,
          email: form.email,
          employeeId: form.employeeId,
          phone: form.phone,
          specialization: form.specialization,
          experience: form.experience.filter(exp => exp.company || exp.role || exp.years),
          summary: form.summary
        },
        status: 'pending',
        submittedAt: serverTimestamp(),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null
      });

      // Update user document
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        onboardingStatus: 'approved', // Set to approved immediately
        trainerAccountId: trainerId,
        displayName: form.name
      }, { merge: true });

      // Wait a moment for Firestore to sync
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: 'Details Submitted!',
        description: 'Your profile has been created. Redirecting to your schedule...',
        duration: 3000
      });

      // Wait for toast to show, then reload
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error) {
      console.error('Error submitting onboarding:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit your details. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (skipOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full border border-[#E0E0E0]">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-semibold text-[#2C2C2C]">
              You're All Set!
            </h2>
            <p className="text-sm text-[#555555] leading-relaxed">
              Your profile details were already collected during the admin setup. You can go straight to your schedule and start managing your tasks.
            </p>
            <Button
              onClick={onComplete}
              className="bg-[#5A5A5A] hover:bg-[#3D3D3D] text-white px-6"
            >
              Continue to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-[#E0E0E0] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome!</h1>
              <p className="text-white/80 text-sm md:text-base mt-1">Please complete your profile to continue</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium">Profile Approval Required</p>
                <p className="text-xs text-blue-800 mt-1">
                  Your information will be reviewed by an administrator. You'll be notified once approved.
                </p>
              </div>
            </div>
          </div>

          {/* Name (Pre-filled) */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
              {loadingName ? (
                <div className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg bg-[#F5F5F5] flex items-center">
                  <div className="w-4 h-4 border-2 border-[#888888] border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-[#888888] text-sm">Loading name...</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={form.name}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg bg-[#F5F5F5] text-[#666666] cursor-not-allowed"
                />
              )}
            </div>
            <p className="text-xs text-[#888888] mt-1">Name provided by administrator</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                <input
                  type="email"
                  value={form.email}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg bg-[#F5F5F5] text-[#666666] cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-[#888888] mt-1">Email cannot be changed</p>
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
                <input
                  type="text"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="e.g., neo10172"
                  className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Enter your phone number"
                className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Tech Stack <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888] w-5 h-5" />
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="e.g., Java, Python, Data Science"
                className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Work Experience */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-[#2C2C2C]">
                Work Experience
              </label>
              <Button
                type="button"
                onClick={handleAddExperience}
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
              {form.experience.map((exp, index) => (
                <div key={index} className="bg-[#F5F5F5] p-4 rounded-lg border border-[#E0E0E0]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-[#2C2C2C]">Experience #{index + 1}</h4>
                    {form.experience.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExperience(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}
                      placeholder="Company"
                      className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white"
                    />
                    <input
                      type="text"
                      value={exp.role}
                      onChange={(e) => handleExperienceChange(index, 'role', e.target.value)}
                      placeholder="Role"
                      className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white"
                    />
                    <input
                      type="text"
                      value={exp.years}
                      onChange={(e) => handleExperienceChange(index, 'years', e.target.value)}
                      placeholder="Years"
                      className="px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Professional Summary (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-[#888888] w-5 h-5" />
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Brief description of your skills and experience"
                rows={4}
                className="w-full pl-10 pr-4 py-3 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5A5A5A] hover:bg-[#3D3D3D] text-white py-3 text-base font-medium"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </div>

          {/* Note */}
          <p className="text-xs text-center text-[#888888]">
            <span className="text-red-500">*</span> Required fields
          </p>
        </form>
      </div>
    </div>
  );
};

export default OnboardingForm;

