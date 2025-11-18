import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvitation, getInvitationByToken } from '../utils/firestoreInvitations';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Lock, User, Shield, CheckCircle, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const invitationToken = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  
  const [email, setEmail] = useState(emailFromUrl || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [trainerAccountExists, setTrainerAccountExists] = useState(false);
  const [loadingInvitation, setLoadingInvitation] = useState(!!invitationToken);

  // Load invitation if token provided
  useEffect(() => {
    if (invitationToken) {
      loadInvitation();
    }
  }, [invitationToken]);

  const loadInvitation = async () => {
    setLoadingInvitation(true);
    try {
      const result = await getInvitationByToken(invitationToken);
      if (result.success) {
        setInvitation(result.invitation);
        setEmail(result.invitation.email); // Pre-fill email
        if (result.invitation.role === 'trainer') {
          setTrainerAccountExists(!!result.invitation.trainerAccountId);
        } else {
          setTrainerAccountExists(false);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load invitation. Please check your link.');
    } finally {
      setLoadingInvitation(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (invitationToken && invitation) {
        // Accept invitation and create account
        const result = await acceptInvitation(invitationToken, password);
        
        if (result.success) {
          toast({
            title: '✅ Account Created Successfully!',
            description: `Welcome ${result.displayName}! Your account has been created.`,
            variant: 'default'
          });
          
          try {
            await signInWithEmailAndPassword(auth, result.email, password);
          } catch (loginError) {
            console.error('Auto-login failed after signup:', loginError);
          }

          const targetPath =
            result.role === 'trainer'
              ? '/trainer/home'
              : result.role === 'program_manager'
                ? '/program-manager/home'
                : '/login';

          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 1500);
        } else {
          setError(result.error);
        }
      } else {
        // Regular signup (without invitation) - disabled for now
        setError('Signup is only available through invitation links. Please contact your administrator.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#2C2C2C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#666666]">Loading invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E8E8E8] rounded-full mb-4">
            <Shield className="w-8 h-8 text-[#5A5A5A]" />
          </div>
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-2">
            {invitation ? 'Create Your Account' : 'Sign Up'}
          </h2>
          {invitation && (
            <div className="bg-[#E8F5E9] border border-[#66BB6A] rounded-lg p-3 mt-3">
              <p className="text-sm text-[#333333]">
                <strong>Invited as:</strong> {invitation.displayName} ({invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1).replace('_', ' ')})
              </p>
              {invitation.role === 'trainer' && trainerAccountExists && (
                <p className="text-xs text-[#166534] mt-2">
                  This trainer account was pre-configured by the admin. After signup, you can head straight to your schedule—no additional onboarding form is required.
                </p>
              )}
            </div>
          )}
          {!invitation && !invitationToken && (
            <p className="text-sm text-[#666666]">
              Signup is only available through invitation links
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
        type="email"
        required
                disabled={!!invitation} // Disable if from invitation
                className={`w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent ${invitation ? 'bg-[#F5F5F5] cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
      <input
        value={password}
        onChange={e => setPassword(e.target.value)}
        type="password"
                placeholder="Choose a strong password"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
              />
            </div>
            <p className="text-xs text-[#888888] mt-1">Must be at least 6 characters</p>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <input
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="Confirm your password"
        required
                minLength={6}
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
      />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !invitation}
            className="w-full bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white py-3 rounded-lg font-semibold hover:from-[#4A4A4A] hover:to-[#2C2C2C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Account...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Create Account
              </>
            )}
          </button>
    </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#666666]">
            Already have an account?{' '}
            <a href="/login" className="text-[#5A5A5A] font-medium hover:text-[#2C2C2C]">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
