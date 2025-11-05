import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import loginIllustration from '../assets/login-illustration.png';
import logo from '../assets/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
        toast({
          title: "Login Successful",
        description: `Welcome back, ${email}!`,
        });
      if (login(email, password)) {
          navigate('/admin/schedule');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Half - Image and Text */}
      <div className="w-1/2 flex flex-col justify-between bg-[#FDE6D9] relative p-8">
        <div className="flex-1 flex items-center justify-center">
          <img
            src={loginIllustration}
            alt="Welcome"
            className="object-contain w-full max-w-[600px] h-auto"
          />
        </div>
      </div>

      {/* Right Half - Login Form */}
      <div className="w-1/2 flex items-center justify-center bg-white">
        <div className="w-full max-w-md p-8 rounded-xl shadow-lg border border-gray-100">
          <div className="flex flex-col items-center mb-6">
            <img src={logo} alt="Logo" className="w-[120px] min-w-[100px] max-w-[160px] mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-gray-800">Login to your Account</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                placeholder="user@iamneo.ai"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7B224C]"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                placeholder=""
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7B224C]"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#7B224C] text-white py-2 rounded-lg font-semibold hover:bg-[#5a1837] transition"
            >
              Login
            </button>
          </form>
          {error && <div className="text-red-500 mt-2">{error}</div>}
          {/* <p className="text-sm text-gray-500 mt-4">
            Don't have an account? <a href="/signup" className="text-blue-500">Sign up</a>
          </p> */}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
  