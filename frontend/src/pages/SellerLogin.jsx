import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

export default function SellerLogin() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const navigate = useNavigate();

 const doLogin = async (loginEmail, loginPassword) => {
  setLoading(true);
  setError('');
  try {
   const response = await fetch(`${API_URL}/api/seller-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
   });
   const data = await response.json().catch(() => ({}));
   if (response.ok && data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
    navigate('/seller-dashboard');
   } else {
    setError(data.detail || 'Invalid credentials');
   }
  } catch (err) {
   setError(`Cannot reach backend at ${API_URL}. Start the server with: uvicorn main:app --reload`);
  } finally {
   setLoading(false);
  }
 };

 const handleLogin = (e) => {
  e.preventDefault();
  doLogin(email, password);
 };

 const handleGuestLogin = (e) => {
  e.preventDefault();
  doLogin('seller1@test.com', 'password');
 };

 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
  
  <div className="z-10 mb-10 text-center">
  <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-[#410F29]">
   meesho
  </h1>
  <p className="mt-2 text-xl text-[#095955] font-black tracking-wider uppercase bg-[#095955]/10 px-4 py-1 border-[2px] border-black rounded-xl">ad ne bana di jodi</p>
  </div>

  <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-10 relative transition-all">
  <div>
   <h2 className="mt-2 text-center text-3xl font-black uppercase tracking-tight text-[#410F29]">Seller Login</h2>
   <p className="mt-2 text-center text-sm text-gray-700 font-bold uppercase tracking-wider">Manage your store and products</p>
  </div>
  <form className="mt-8 space-y-6" onSubmit={handleLogin}>
   {error && <div className="text-[#410F29] text-sm text-center font-black uppercase tracking-wider bg-red-100 p-3 rounded-xl border-[2px] border-red-500 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)]">{error}</div>}
   <div className="space-y-4">
   <div>
    <input
    id="email-address"
    name="email"
    type="email"
    autoComplete="email"
    required
    disabled={loading}
    className="appearance-none relative block w-full px-4 py-3.5 border-[3px] border-black text-gray-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#095955]/20 font-bold bg-[#F8F6F0] transition-all disabled:opacity-50"
    placeholder="Email address"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    />
   </div>
   <div>
    <input
    id="password"
    name="password"
    type="password"
    autoComplete="current-password"
    required
    disabled={loading}
    className="appearance-none relative block w-full px-4 py-3.5 border-[3px] border-black text-gray-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#095955]/20 font-bold bg-[#F8F6F0] transition-all disabled:opacity-50"
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    />
   </div>
   </div>
   <div className="space-y-4 pt-2">
   <button
    type="submit"
    disabled={loading}
    className="group relative w-full flex justify-center py-3.5 px-4 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 text-xl font-black uppercase tracking-wider text-white bg-[#095955] transition-all disabled:opacity-50"
   >
    {loading ? 'Signing in...' : 'Sign in'}
   </button>
   <button
    type="button"
    onClick={handleGuestLogin}
    disabled={loading}
    className="group relative w-full flex justify-center py-3.5 px-4 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 text-lg font-black uppercase tracking-wider text-[#410F29] bg-[#F47216] transition-all disabled:opacity-50"
   >
    {loading ? 'Logging in...' : 'Login as Guest Seller'}
   </button>
   </div>
   <div className="text-center text-sm pt-4 font-black uppercase tracking-wider">
   <span className="text-gray-700">Don't have an account? </span>
   <Link to="/seller-register" className="text-[#095955] hover:text-[#410F29] hover:underline underline-offset-4 transition-all border-b-2 border-[#095955]">Sign up</Link>
   </div>
   <div className="text-center pt-2">
   <Link to="/" className="inline-block text-sm font-black uppercase tracking-wider text-gray-600 hover:text-[#410F29] transition-all hover:underline underline-offset-4">Back to home</Link>
   </div>
  </form>
  </div>
 </div>
 );
}
