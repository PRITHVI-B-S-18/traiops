import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Upload, Mail, Users, X, FileText, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  sendInvitationEmail,
  sendBulkInvitationEmails,
  generateTemporaryPassword,
  parseInvitationCSV,
} from '../../utils/invitationService';
import { createUserDocument } from '../../utils/firestoreUsers';
import { auth } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const UserInvitationPage = () => {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
  const [loading, setLoading] = useState(false);
  const [singleForm, setSingleForm] = useState({
    email: '',
    role: 'trainer',
    name: '',
  });
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkInvitations, setBulkInvitations] = useState([]);
  const [invitationResults, setInvitationResults] = useState(null);
  const { toast } = useToast();

  // Handle single invitation form
  const handleSingleInputChange = (e) => {
    const { name, value } = e.target;
    setSingleForm({ ...singleForm, [name]: value });
  };

  // Handle single invitation submit
  const handleSingleInvite = async (e) => {
    e.preventDefault();
    
    if (!singleForm.email || !singleForm.role) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Generate temporary password
      const temporaryPassword = generateTemporaryPassword();
      
      // Create user in Firebase Auth
      // Note: This requires the user to have admin privileges or use Firebase Admin SDK
      // For production, use Firebase Cloud Functions with Admin SDK
      let userId;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          singleForm.email,
          temporaryPassword
        );
        userId = userCredential.user.uid;
        
        // Create user document in Firestore
        await createUserDocument(userId, {
          email: singleForm.email,
          displayName: singleForm.name || '',
          role: singleForm.role,
          status: 'active',
        });
      } catch (authError) {
        // If user already exists, that's okay - we'll just send the invitation
        if (authError.code !== 'auth/email-already-in-use') {
          throw authError;
        }
        toast({
          title: 'User Already Exists',
          description: 'User with this email already exists. Sending invitation email...',
        });
      }
      
      // Send invitation email
      await sendInvitationEmail(
        singleForm.email,
        singleForm.role,
        temporaryPassword
      );
      
      toast({
        title: 'Success',
        description: `Invitation sent to ${singleForm.email}`,
      });
      
      // Reset form
      setSingleForm({
        email: '',
        role: 'trainer',
        name: '',
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    try {
      const parsed = await parseInvitationCSV(file);
      setBulkInvitations(parsed);
      setBulkFile(file);
      toast({
        title: 'File Parsed',
        description: `Found ${parsed.length} invitations`,
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to parse CSV file',
        variant: 'destructive',
      });
    }
  };

  // Handle bulk invitation submit
  const handleBulkInvite = async () => {
    if (bulkInvitations.length === 0) {
      toast({
        title: 'No Invitations',
        description: 'Please upload a CSV file first',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setInvitationResults(null);

    try {
      // Generate temporary passwords for all invitations
      const invitationsWithPasswords = bulkInvitations.map(inv => ({
        ...inv,
        temporaryPassword: generateTemporaryPassword(),
      }));

      // TODO: Create users in Firebase Auth (requires Admin SDK in production)
      // For now, we'll just send emails
      // In production, use Firebase Cloud Functions with Admin SDK

      // Send bulk invitation emails
      const results = await sendBulkInvitationEmails(invitationsWithPasswords);

      setInvitationResults(results);
      
      toast({
        title: 'Bulk Invitation Complete',
        description: `Sent ${results.success.length} invitations. ${results.failed.length} failed.`,
      });
    } catch (error) {
      console.error('Error sending bulk invitations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send bulk invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold text-[#2C2C2C] mb-2">
          User Invitations
        </h1>
        <p className="text-[#666666]">
          Invite trainers and program managers to join the platform
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#E0E0E0]">
        <button
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'single'
              ? 'text-[#2C2C2C] border-b-2 border-[#5A5A5A]'
              : 'text-[#666666] hover:text-[#2C2C2C]'
          }`}
        >
          <UserPlus className="h-4 w-4 inline mr-2" />
          Single Invite
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'bulk'
              ? 'text-[#2C2C2C] border-b-2 border-[#5A5A5A]'
              : 'text-[#666666] hover:text-[#2C2C2C]'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Bulk Invite
        </button>
      </div>

      {/* Single Invite Form */}
      {activeTab === 'single' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-[#E0E0E0] rounded-lg p-6"
        >
          <form onSubmit={handleSingleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={singleForm.email}
                onChange={handleSingleInputChange}
                className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={singleForm.role}
                onChange={handleSingleInputChange}
                className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                required
              >
                <option value="trainer">Trainer</option>
                <option value="program_manager">Program Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2C2C] mb-1">
                Name (Optional)
              </label>
              <input
                type="text"
                name="name"
                value={singleForm.name}
                onChange={handleSingleInputChange}
                className="w-full px-3 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A]"
                placeholder="John Doe"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
            >
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>
        </motion.div>
      )}

      {/* Bulk Invite Form */}
      {activeTab === 'bulk' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* CSV Upload */}
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#2C2C2C] mb-4">
              Upload CSV File
            </h3>
            <div className="border-2 border-dashed border-[#D0D0D0] rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-12 w-12 text-[#888888] mb-4" />
                <p className="text-[#666666] mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-[#888888]">
                  CSV file with columns: email, role, name (optional)
                </p>
              </label>
            </div>

            {bulkFile && (
              <div className="mt-4 flex items-center justify-between bg-[#F5F5F5] p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#5A5A5A]" />
                  <span className="text-sm text-[#2C2C2C]">{bulkFile.name}</span>
                  <span className="text-xs text-[#888888]">
                    ({bulkInvitations.length} invitations)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setBulkFile(null);
                    setBulkInvitations([]);
                  }}
                  className="p-1 hover:bg-[#E8E8E8] rounded"
                >
                  <X className="h-4 w-4 text-[#666666]" />
                </button>
              </div>
            )}
          </div>

          {/* Preview Invitations */}
          {bulkInvitations.length > 0 && (
            <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[#2C2C2C] mb-4">
                Preview ({bulkInvitations.length} invitations)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {bulkInvitations.map((inv, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-[#F5F5F5] rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#2C2C2C]">
                        {inv.email}
                      </p>
                      <p className="text-xs text-[#888888]">
                        {inv.role} {inv.name && `• ${inv.name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {invitationResults && (
            <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[#2C2C2C] mb-4">
                Invitation Results
              </h3>
              <div className="space-y-4">
                {invitationResults.success.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-[#2C2C2C]">
                        Successful ({invitationResults.success.length})
                      </span>
                    </div>
                    <div className="text-sm text-[#666666] space-y-1">
                      {invitationResults.success.map((email, index) => (
                        <div key={index}>{email}</div>
                      ))}
                    </div>
                  </div>
                )}
                {invitationResults.failed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-[#2C2C2C]">
                        Failed ({invitationResults.failed.length})
                      </span>
                    </div>
                    <div className="text-sm text-[#666666] space-y-1">
                      {invitationResults.failed.map((item, index) => (
                        <div key={index}>
                          {item.email}: {item.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Send Button */}
          {bulkInvitations.length > 0 && (
            <Button
              onClick={handleBulkInvite}
              disabled={loading}
              className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
            >
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Sending...' : `Send ${bulkInvitations.length} Invitations`}
            </Button>
          )}
        </motion.div>
      )}

      {/* Info Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> For production use, user creation should be handled via Firebase Cloud Functions with Admin SDK for better security. 
          The current implementation creates users directly from the frontend, which may have limitations.
        </p>
      </motion.div>
    </div>
  );
};

export default UserInvitationPage;

