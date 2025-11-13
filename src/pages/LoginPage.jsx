import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo copy.png';
// Figma assets
import logIllustration from '../assets/figma/log.png';
import vector from '../assets/figma/Vector.png';
import vector1 from '../assets/figma/Vector-1.png';
import vector2 from '../assets/figma/Vector-2.png';
import vector3 from '../assets/figma/Vector-3.png';
import vector4 from '../assets/figma/Vector-4.png';
import vector5 from '../assets/figma/Vector-5.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { login, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get intended destination from location state or default
  const from = location.state?.from?.pathname || '/admin/schedule';
  
  // Check for logout reason in URL
  const searchParams = new URLSearchParams(location.search);
  const logoutReason = searchParams.get('reason');

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      // Determine redirect based on user role
      const redirectPath = 
        user.role === 'admin' ? '/admin/schedule' :
        user.role === 'program_manager' ? '/program-manager/dashboard' :
        '/trainer/schedule';
      navigate(redirectPath, { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-[#7B224C]" />
            <div className="absolute inset-0 h-10 w-10 animate-ping text-[#7B224C] opacity-20"></div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Verifying authentication...</p>
            <p className="text-xs text-gray-500 mt-1">Please wait</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Don't render login form if user is already logged in
  if (user) {
    return null;
  }

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return {
          title: 'Account Not Found',
          message: 'No account exists with this email address. Please verify your email or contact your administrator.',
          icon: '✉️'
        };
      case 'auth/wrong-password':
        return {
          title: 'Incorrect Password',
          message: 'The password you entered is incorrect. Please try again or use the password reset option if available.',
          icon: '🔒'
        };
      case 'auth/invalid-email':
        return {
          title: 'Invalid Email Format',
          message: 'Please enter a valid email address in the format: user@domain.com',
          icon: '📧'
        };
      case 'auth/user-disabled':
        return {
          title: 'Account Disabled',
          message: 'This account has been temporarily disabled. Please contact your system administrator for assistance.',
          icon: '🚫'
        };
      case 'auth/too-many-requests':
        return {
          title: 'Too Many Attempts',
          message: 'Multiple login attempts detected. Please wait a few minutes before trying again to ensure account security.',
          icon: '⏱️'
        };
      case 'auth/network-request-failed':
        return {
          title: 'Connection Error',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          icon: '🌐'
        };
      case 'auth/invalid-credential':
        return {
          title: 'Invalid Credentials',
          message: 'The email or password you entered is incorrect. Please verify your credentials and try again.',
          icon: '⚠️'
        };
      case 'auth/account-disabled':
        return {
          title: 'Account Deactivated',
          message: 'Your account has been deactivated. Please contact your administrator to reactivate your account.',
          icon: '🚫'
        };
      case 'auth/operation-not-allowed':
        return {
          title: 'Login Disabled',
          message: 'Email/password login is not enabled for this application. Please contact support.',
          icon: '🔧'
        };
      default:
        return {
          title: 'Authentication Failed',
          message: 'Unable to sign in. Please verify your credentials and try again. If the problem persists, contact support.',
          icon: '❌'
        };
    }
  };

  const handleForgotPassword = async () => {
    // Check if email is provided
    if (!email || email.trim() === '') {
      const errorInfo = {
        title: 'Email Required',
        message: 'Please provide your email address for password reset.',
        icon: '📧'
      };
      setError(errorInfo);
      toast({
        title: errorInfo.title,
        description: errorInfo.message,
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Don't use the main isLoading state for forgot password
    setError(null);
    setResetEmailSent(false);

    try {
      // Send password reset email using Firebase
      await sendPasswordResetEmail(auth, email);
      
      setResetEmailSent(true);
      setError(null); // Clear any previous errors
      toast({
        title: "Reset Email Sent",
        description: `A password reset link has been sent to ${email}`,
      });
      
      // Reset state after 5 seconds
      setTimeout(() => {
        setResetEmailSent(false);
      }, 5000);
    } catch (err) {
      console.error('Password reset error:', err);
      
      let errorInfo;
      if (err.code === 'auth/user-not-found') {
        errorInfo = {
          title: 'Email Not Registered',
          message: 'This email is not registered in our system. Please check your email or contact your administrator.',
          icon: '❌'
        };
      } else if (err.code === 'auth/invalid-email') {
        errorInfo = {
          title: 'Invalid Email Format',
          message: 'Please enter a valid email address in the format: user@domain.com',
          icon: '📧'
        };
      } else if (err.code === 'auth/too-many-requests') {
        errorInfo = {
          title: 'Too Many Attempts',
          message: 'Too many password reset requests. Please try again later.',
          icon: '⏱️'
        };
      } else {
        errorInfo = getErrorMessage(err.code || err.message);
      }
      
      setError(errorInfo);
      toast({
        title: errorInfo.title,
        description: errorInfo.message,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);
    setIsLoading(true);

    try {
      // Use the login function from AuthContext (it handles signInWithEmailAndPassword)
      await login(email, password);
      
      // Store intended destination
      sessionStorage.setItem('intendedDestination', from);
      
      // Show success state
      setIsSuccess(true);
      
        toast({
          title: "Login Successful",
        description: `Welcome back, ${email.split('@')[0]}!`,
        });

      // Navigation will be handled by the useEffect that checks user state
      // Small delay to ensure auth state is updated and show success feedback
      setTimeout(() => {
        const redirectPath = from !== '/login' ? from : '/admin/schedule';
        navigate(redirectPath, { replace: true });
      }, 800);
    } catch (err) {
      console.error('Login error:', err);
      
      // Check if this is a user-not-found error for a trainer
      if (err.code === 'auth/user-not-found') {
        // Try to auto-create account for trainer from Trainer Accounts
        try {
          const { loadTrainerData } = await import('../utils/firestoreTrainers');
          const { createTrainerAuthAccount } = await import('../utils/trainerSync');
          
          // Check if email exists in trainers array
          const trainers = await loadTrainerData();
          const trainer = trainers.find(t => t.email === email);
          
          if (trainer) {
            const trainerData = trainer;
            
            toast({
              title: "Creating Account",
              description: "Setting up your account. Please wait...",
            });
            
            // Create Firebase Auth account
            const result = await createTrainerAuthAccount(trainerData, 'system-auto-create');
            
            if (result.success) {
              toast({
                title: "Account Created",
                description: `Your account has been created. Please log in with password: ${result.password}`,
                duration: 10000,
              });
              
              // Auto-login with the created password
              setTimeout(async () => {
                try {
                  await login(email, result.password);
                  setIsSuccess(true);
                  toast({
                    title: "Login Successful",
                    description: `Welcome, ${email.split('@')[0]}!`,
                  });
                  setTimeout(() => {
                    navigate('/trainer/schedule', { replace: true });
                  }, 800);
                } catch (loginErr) {
                  console.error('Auto-login error:', loginErr);
                  toast({
                    title: "Please Login Again",
                    description: `Use password: ${result.password}`,
                    variant: "default",
                    duration: 10000,
                  });
                }
              }, 1000);
              
              setIsLoading(false);
              return;
            }
          }
        } catch (autoCreateErr) {
          console.error('Auto-create error:', autoCreateErr);
        }
      }
      
      const errorInfo = getErrorMessage(err.code || err.message);
      setError(errorInfo);
      setIsSuccess(false);
      toast({
        title: errorInfo.title,
        description: errorInfo.message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="w-full h-screen min-h-screen relative overflow-hidden bg-gradient-to-br from-[#F5F5F5] via-[#E8E8E8] to-[#DADADA]">
      {/* Background Layer - Grey/White Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FAFAFA] via-[#F0F0F0] to-[#E0E0E0] opacity-90"></div>

      {/* Animated Background Circles */}
      <div className="absolute top-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-[#E0E0E0]/40 to-[#D0D0D0]/40 blur-3xl"></div>
      <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#EBEBEB]/40 to-[#DEDEDE]/40 blur-3xl"></div>
      <div className="absolute top-[40%] right-[20%] w-[250px] h-[250px] rounded-full bg-gradient-to-br from-[#E8E8E8]/40 to-[#F5F5F5]/40 blur-3xl"></div>

      {/* Background Vector Elements - More distributed */}
      <img
        className="absolute top-[5%] left-[3%] w-[150px] lg:w-[220px] h-auto opacity-15 animate-pulse"
        alt=""
        src={vector}
        aria-hidden="true"
        style={{ animationDuration: '4s' }}
      />
      <img
        className="absolute bottom-[8%] left-[8%] w-[120px] lg:w-[200px] h-auto opacity-15"
        alt=""
        src={vector2}
        aria-hidden="true"
      />
      <img
        className="absolute top-[15%] right-[5%] w-[100px] lg:w-[170px] h-auto opacity-15 animate-pulse"
        alt=""
        src={vector3}
        aria-hidden="true"
        style={{ animationDuration: '5s' }}
      />
      <img
        className="absolute bottom-[20%] right-[8%] w-[140px] lg:w-[240px] h-auto opacity-15"
        alt=""
        src={vector5}
        aria-hidden="true"
      />
      <img
        className="absolute top-[35%] left-[15%] w-[80px] lg:w-[140px] h-auto opacity-12"
        alt=""
        src={vector4}
        aria-hidden="true"
      />
      <img
        className="absolute bottom-[35%] right-[15%] w-[90px] lg:w-[160px] h-auto opacity-12 animate-pulse"
        alt=""
        src={vector1}
        aria-hidden="true"
        style={{ animationDuration: '6s' }}
      />

      {/* Central Glassmorphic Container - Taller and Narrower */}
      <div className="absolute inset-0 flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="relative w-full max-w-[90%] lg:max-w-[1100px] h-[92vh] rounded-[45px] overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(240, 240, 240, 0.3) 100%)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '2px solid rgba(224, 224, 224, 0.6)',
            boxShadow: '0 25px 70px 0 rgba(150, 150, 150, 0.2), inset 0 2px 2px rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Glassmorphic overlay gradient with grey/white tints */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-[#F5F5F5]/20 to-transparent pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-tl from-[#E8E8E8]/20 via-transparent to-[#F0F0F0]/20 pointer-events-none"></div>

          {/* Decorative Vector Elements Inside Glass Card */}
          <img
            className="absolute top-[8%] right-[12%] w-[80px] lg:w-[150px] h-auto opacity-20"
            alt=""
            src={vector4}
            aria-hidden="true"
          />
          <img
            className="absolute bottom-[12%] left-[10%] w-[100px] lg:w-[170px] h-auto opacity-20"
            alt=""
            src={vector1}
            aria-hidden="true"
          />
          <img
            className="absolute top-[25%] left-[5%] w-[60px] lg:w-[110px] h-auto opacity-15"
            alt=""
            src={vector3}
            aria-hidden="true"
          />
          <img
            className="absolute bottom-[25%] right-[8%] w-[70px] lg:w-[130px] h-auto opacity-15"
            alt=""
            src={vector5}
            aria-hidden="true"
          />

          {/* Content Grid - Adjusted for taller design */}
          <div className="relative z-10 h-full flex flex-col lg:flex-row items-center justify-between p-6 lg:p-12">
            
            {/* Left Side - Login Form with Enhanced Pastel Glassmorphic Style */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="w-full lg:w-[42%] max-w-sm"
            >
              <div className="mb-6 text-center lg:text-left">
                <motion.img 
                  src={logo} 
                  alt="Logo" 
                  className="w-[150px] mb-8 mx-auto lg:mx-0"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
      </div>

              <AnimatePresence>
                {logoutReason === 'expired' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-4 p-3.5 bg-gradient-to-r from-white/70 to-[#F5F5F5]/70 backdrop-blur-lg border border-[#D0D0D0]/70 rounded-2xl shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-[#5A5A5A] flex-shrink-0" />
                      <p className="text-xs font-medium text-[#4A4A4A]">Your session expired. Please log in again to continue.</p>
                    </div>
                  </motion.div>
                )}
                {logoutReason === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-4 p-3.5 bg-gradient-to-r from-white/70 to-[#F5F5F5]/70 backdrop-blur-lg border border-[#D0D0D0]/70 rounded-2xl shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-[#5A5A5A] flex-shrink-0" />
                      <p className="text-xs font-medium text-[#4A4A4A]">You were logged out due to inactivity. Please log in again to continue.</p>
                    </div>
                  </motion.div>
                )}
                {logoutReason === 'session_timeout' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-4 p-3.5 bg-gradient-to-r from-white/70 to-[#F5F5F5]/70 backdrop-blur-lg border border-[#D0D0D0]/70 rounded-2xl shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-[#5A5A5A] flex-shrink-0" />
                      <p className="text-xs font-medium text-[#4A4A4A]">Your 24-hour session has expired. Please log in again to continue.</p>
          </div>
                  </motion.div>
                )}
                {logoutReason === 'account_deactivated' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-4 p-3.5 bg-gradient-to-r from-red-50/70 to-red-100/70 backdrop-blur-lg border border-red-200/70 rounded-2xl shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-[#4A4A4A]">Your account has been deactivated by an administrator. Please contact your administrator to reactivate your account.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleLogin} className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <label htmlFor="email" className="block text-sm font-semibold text-[#4A4A4A] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Username</label>
              <input
                id="email"
                type="email"
                placeholder="user@iamneo.ai"
                value={email}
                onChange={e => setEmail(e.target.value)}
                    disabled={isLoading || isSuccess}
                    className="w-full rounded-2xl px-5 py-3.5 bg-white/60 backdrop-blur-lg border-2 border-[#D0D0D0]/70 text-[#2C2C2C] placeholder:text-[#888888]/70 focus:outline-none focus:ring-2 focus:ring-[#707070] focus:border-[#707070] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-medium"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                autoComplete="username"
                required
              />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <label htmlFor="password" className="block text-sm font-semibold text-[#4A4A4A] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Password</label>
                  <div className="relative">
              <input
                id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                      disabled={isLoading || isSuccess}
                      className="w-full rounded-2xl px-5 py-3.5 pr-12 bg-white/60 backdrop-blur-lg border-2 border-[#D0D0D0]/70 text-[#2C2C2C] placeholder:text-[#888888]/70 focus:outline-none focus:ring-2 focus:ring-[#707070] focus:border-[#707070] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-medium"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                autoComplete="current-password"
                required
              />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#2C2C2C] transition-colors focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
            </div>
            <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetEmailSent}
                    className="text-sm text-[#666666] hover:text-[#4A4A4A] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2.5 block font-medium hover:underline"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Forgot Password?
                  </button>
                </motion.div>
                <motion.button
              type="submit"
                  disabled={isLoading || isSuccess}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  whileHover={{ scale: isLoading || isSuccess ? 1 : 1.03, y: -2 }}
                  whileTap={{ scale: isLoading || isSuccess ? 1 : 0.97 }}
                  className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
                    isSuccess
                      ? 'bg-gradient-to-r from-[#81C784] to-[#66BB6A] text-white cursor-not-allowed'
                      : isLoading
                      ? 'bg-gradient-to-r from-[#6B6B6B]/70 to-[#4A4A4A]/70 text-white opacity-75 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C] hover:shadow-2xl'
                  }`}
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Success!</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </motion.button>
          </form>
            </motion.div>

            {/* Right Side - Welcome Text & Illustration with Enhanced Pastel Design */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
              className="w-full lg:w-[54%] flex flex-col items-center justify-center relative mt-8 lg:mt-0"
            >
              {/* Welcome Text with Pastel Colors */}
              <motion.div 
                className="text-center mb-10"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h1
                  className="font-bold bg-gradient-to-r from-[#3D3D3D] via-[#5A5A5A] to-[#707070] bg-clip-text text-transparent text-5xl lg:text-7xl leading-tight tracking-tight mb-5 drop-shadow-lg"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Welcome to
                  <br />
                  TrainOps
                </h1>
                <p
                  className="text-[#4A4A4A] text-lg lg:text-xl font-semibold drop-shadow-md"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Login to access your account
                </p>
              </motion.div>

              {/* Main Illustration with Enhanced Shadow */}
              <motion.div 
                className="relative w-full max-w-[520px]"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.6 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#A0A0A0]/30 to-[#808080]/30 blur-3xl rounded-full transform translate-y-8"></div>
                <img
                  className="relative w-full h-auto object-contain drop-shadow-2xl"
                  alt="Login illustration showing people working with technology"
                  src={logIllustration}
                />
              </motion.div>
            </motion.div>

        </div>
        </motion.div>
      </div>
    </main>
  );
};

export default LoginPage;
  