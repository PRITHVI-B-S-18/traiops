import React, { useState } from 'react';
import { createInvitation } from '../../utils/firestoreInvitations';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { UserPlus, Mail, User, Shield, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";

const InviteUserForm = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('trainer');
  const [loading, setLoading] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !displayName || !role) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await createInvitation(
        { email, displayName, role },
        user.uid
      );

      if (result.success) {
        setInvitationSent(true);
        
        toast({
          title: '✅ Invitation Sent Successfully',
          description: `Invitation email sent to ${displayName} (${email}). They will create their account when they click the link.`,
          variant: 'default'
        });
        
        console.log('Invitation created:', {
          email,
          displayName,
          role,
          invitationId: result.invitationId
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send invitation',
          variant: 'destructive'
        });
        setLoading(false);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const handleDone = async () => {
    // Reset form and close
    setEmail('');
    setDisplayName('');
    setRole('trainer');
    setInvitationSent(false);
    setLoading(false);
    onSuccess();
  };

  const roleOptions = [
    { value: 'trainer', label: 'Trainer', description: 'Can clock in/out and view their schedule' },
    { value: 'program_manager', label: 'Program Manager', description: 'Can approve requests and manage trainers' },
    { value: 'admin', label: 'Admin', description: 'Full access to all features' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-[#E0E0E0] shadow-lg p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[#E8E8E8] rounded-lg">
          <UserPlus className="h-6 w-6 text-[#5A5A5A]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#2C2C2C]">Invite New User</h2>
          <p className="text-sm text-[#666666]">Create a new user account with a role</p>
        </div>
      </div>

      {!invitationSent ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
              />
            </div>
          </div>

          {/* Display Name Field */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Display Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Role *
            </label>
            <div className="space-y-2">
              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                    role === option.value
                      ? 'border-[#5A5A5A] bg-[#F5F5F5]'
                      : 'border-[#D0D0D0] hover:border-[#5A5A5A] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#5A5A5A]" />
                      <span className="font-medium text-[#2C2C2C]">{option.label}</span>
                    </div>
                    <p className="text-xs text-[#666666] mt-1">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
            >
              {loading ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5]"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Success Message */}
          <div className="bg-[#E8F5E9] border border-[#66BB6A] rounded-lg p-4">
            <h3 className="font-semibold text-[#2C2C2C] mb-2">✅ Invitation Sent Successfully!</h3>
            <p className="text-sm text-[#666666]">
              An invitation email has been sent to <strong>{displayName}</strong> ({email}) for the role of <strong className="text-blue-600">{role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</strong>.
            </p>
            <p className="text-xs text-[#888888] mt-2">
              {role === 'trainer' && 'The trainer will create their account when they click the invitation link.'}
              {role === 'program_manager' && 'The program manager will create their account and can then approve clock-in/out requests.'}
              {role === 'admin' && 'The admin will create their account and have full access to all features.'}
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-[#F5F5F5] rounded-lg p-4">
            <h4 className="font-semibold text-[#2C2C2C] mb-2">📧 What Happens Next?</h4>
            <ol className="text-sm text-[#666666] space-y-1 list-decimal list-inside">
              <li>The user receives an email with an invitation link</li>
              <li>They click the link to go to the signup page</li>
              <li>They create their account and set their password</li>
              <li>They can immediately log in and start using the system</li>
            </ol>
            <p className="text-xs text-[#888888] mt-3">
              <strong>Note:</strong> The invitation link expires in 7 days. You can resend the invitation if needed.
            </p>
          </div>

          {/* Done Button */}
          <Button
            type="button"
            onClick={handleDone}
            className="w-full bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
          >
            Done
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default InviteUserForm;

