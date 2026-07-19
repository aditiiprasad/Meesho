import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function SellerLogin() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const navigate = useNavigate();

 const handleLogin = async (e) => {
 e.preventDefault();
 try {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/seller-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  });
  if (response.ok) {
  const data = await response.json();
  localStorage.setItem('user', JSON.stringify(data.user));
  navigate('/seller-dashboard');
  } else {
  setError('Invalid credentials');
  }
 } catch (err) {
  setError('Failed to connect to the server');
 }
 };

 const handleGuestLogin = async (e) => {
 e.preventDefault();
 try {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/seller-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'seller1@test.com', password: 'password' }),
  });
  if (response.ok) {
  const data = await response.json();
  localStorage.setItem('user', JSON.stringify(data.user));
  navigate('/seller-dashboard');
  } else {
  setError('Invalid guest credentials');
  }
 } catch (err) {
  setError('Failed to connect to the server');
 }
 };

 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F6F0] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
  
  {/* Background Blobs */}
  <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#095955] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>
  <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#F47216] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>

  {/* Header Branding */}
  <div className="z-10 mb-10 text-center">
  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#410F29]">
   meesho
  </h1>
  <p className="mt-2 text-lg text-[#095955] font-medium tracking-tight">ad ne bana di jodi</p>
  </div>

  <div className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 z-10 relative transition-all">
  <div>
   <h2 className="mt-2 text-center text-3xl font-extrabold text-[#410F29]">Seller Login</h2>
   <p className="mt-2 text-center text-sm text-gray-600 font-medium">Manage your store and products</p>
  </div>
  <form className="mt-8 space-y-6" onSubmit={handleLogin}>
   {error && <div className="text-white text-sm text-center font-medium bg-red-500/90 backdrop-blur-sm p-3 rounded-xl shadow-sm">{error}</div>}
   <div className="space-y-4">
   <div>
    <input
    id="email-address"
    name="email"
    type="email"
    autoComplete="email"
    required
    className="appearance-none relative block w-full px-4 py-3.5 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent sm:text-sm bg-gray-50/50 transition-all"
    placeholder="Email address (seller@acme.com)"
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
    className="appearance-none relative block w-full px-4 py-3.5 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent sm:text-sm bg-gray-50/50 transition-all"
    placeholder="Password (password)"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    />
   </div>
   </div>
   <div className="space-y-4 pt-2">
   <button
    type="submit"
    className="group relative w-full flex justify-center py-3.5 px-4 rounded-full shadow-md text-lg font-semibold text-white bg-[#095955] hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#074643] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#095955] transition-all duration-300"
   >
    Sign in
   </button>
   <button
    type="button"
    onClick={handleGuestLogin}
    className="group relative w-full flex justify-center py-3.5 px-4 rounded-full shadow-md text-lg font-semibold text-white bg-[#F47216] hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#d96213] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47216] transition-all duration-300"
   >
    Login as Guest Seller
   </button>
   </div>
   <div className="text-center text-sm pt-4 font-medium">
   <span className="text-gray-600">Don't have an account? </span>
   <Link to="/seller-register" className="text-[#095955] hover:text-[#074643] hover:underline underline-offset-4 transition-all">Sign up</Link>
   </div>
   <div className="text-center pt-2">
   <Link to="/" className="inline-block text-sm font-medium text-gray-500 hover:text-[#410F29] transition-all hover:underline underline-offset-4">Back to home</Link>
   </div>
  </form>
  </div>
 </div>
 );
}
