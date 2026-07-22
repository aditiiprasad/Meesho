import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { Store, Plus, Package, LogOut, X, Image as ImageIcon, TrendingUp, Zap, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function SellerDashboard() {
 const navigate = useNavigate();
 const [user, setUser] = useState(() => {
  try {
   const u = JSON.parse(localStorage.getItem('user') || 'null');
   return u?.role === 'seller' ? u : null;
  } catch {
   return null;
  }
 });
 const [products, setProducts] = useState([]);
 const [isModalOpen, setIsModalOpen] = useState(false);
 
 // Ad Ne Bana Di Jodi state
 const [isAdPoolOpen, setIsAdPoolOpen] = useState(false);
 const [adPoolBudget, setAdPoolBudget] = useState(50);
 const [adPoolProductId, setAdPoolProductId] = useState('');
 const [isDeploying, setIsDeploying] = useState(false);
 const [metrics, setMetrics] = useState({ active: false, pooling_count: 0, active_ads: [] });

 const [adPoolState, setAdPoolState] = useState('initial');
 const [sellerDetails, setSellerDetails] = useState(null);
 const [sellerChecks, setSellerChecks] = useState([]);
 const [productChecks, setProductChecks] = useState([]);

 // Form state
 const [formData, setFormData] = useState({
 title: '',
 price: '',
 image: null,
 category: '',
 stock: ''
 });
 const [isSubmitting, setIsSubmitting] = useState(false);

 useEffect(() => {
 if (!user) {
  navigate('/seller-login');
  return;
 }
 const parsedUser = user;
 
 fetch(`${API_URL}/api/seller/products?seller_id=${parsedUser.id}`)
  .then(res => res.json())
  .then(data => setProducts(data));

 fetch(`${API_URL}/api/seller-info/${parsedUser.id}`)
  .then(res => res.json())
  .then(data => setSellerDetails(data))
  .catch(err => console.error("Failed to fetch seller details", err));

 const fetchMetrics = () => {
  fetch(`${API_URL}/api/seller/metrics?seller_id=${parsedUser.id}`)
  .then(res => res.json())
  .then(data => setMetrics(data))
  .catch(err => console.error("Metrics error:", err));
 };

 fetchMetrics();
 const interval = setInterval(fetchMetrics, 5000);
 return () => clearInterval(interval);
 }, [navigate, user?.id]);

 const handleLogout = () => {
 localStorage.removeItem('user');
 setUser(null);
 setProducts([]);
 setSellerDetails(null);
 setMetrics({ active: false, pooling_count: 0, active_ads: [] });
 navigate('/');
 };

 const runSellerCheck = () => {
  setAdPoolState('checking_seller');
  setSellerChecks([]);
  
  if(!sellerDetails) {
    setAdPoolState('seller_fail');
    return;
  }
  
  const checks = [
   { name: 'Monthly Ad Spend < ₹150', pass: sellerDetails.monthly_ad_spend < 150, value: `₹${sellerDetails.monthly_ad_spend}` },
   { name: 'Monthly Orders < 300', pass: sellerDetails.monthly_orders < 300, value: sellerDetails.monthly_orders },
   { name: 'Monthly GMV < ₹1,00,000', pass: sellerDetails.monthly_gmv < 100000, value: `₹${sellerDetails.monthly_gmv}` },
   { name: 'Catalog Size < 100', pass: sellerDetails.catalog_size < 100, value: sellerDetails.catalog_size }
  ];
  
  let delay = 500;
  checks.forEach((chk, idx) => {
   setTimeout(() => {
    setSellerChecks(prev => [...prev, chk]);
    if (idx === checks.length - 1) {
     setTimeout(() => {
      const allPassed = checks.every(c => c.pass);
      setAdPoolState(allPassed ? 'seller_pass' : 'seller_fail');
     }, 600);
    }
   }, delay);
   delay += 800;
  });
 };

 const runProductCheck = (productId) => {
  setAdPoolProductId(productId);
  setAdPoolState('checking_product');
  setProductChecks([]);
  
  const product = products.find(p => p.id == productId);
  if(!product) return;
  
  const checks = [
   { name: 'Rating ≥ 4.0', pass: product.rating >= 4.0, value: product.rating },
   { name: 'Return Rate < 10%', pass: product.return_rate < 10.0, value: `${product.return_rate}%` },
   { name: 'Order Cancellation < 5%', pass: product.order_cancellation_rate < 5.0, value: `${product.order_cancellation_rate}%` },
   { name: 'Policy Violations = 0', pass: product.policy_violation_score === 0, value: product.policy_violation_score },
   { name: 'Completed Orders > 10', pass: product.completed_orders > 10, value: product.completed_orders }
  ];
  
  let delay = 500;
  checks.forEach((chk, idx) => {
   setTimeout(() => {
    setProductChecks(prev => [...prev, chk]);
    if (idx === checks.length - 1) {
     setTimeout(() => {
      const allPassed = checks.every(c => c.pass);
      setAdPoolState(allPassed ? 'configure' : 'product_fail');
     }, 600);
    }
   }, delay);
   delay += 800;
  });
 };

 const handleInputChange = (e) => {
  const { name, value, files } = e.target;
  if (name === 'image' && files && files[0]) {
    setFormData(prev => ({ ...prev, image: files[0] }));
  } else {
    setFormData(prev => ({ ...prev, [name]: value }));
  }
 };

 const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  try {
   const data = new FormData();
   data.append('title', formData.title);
   data.append('price', formData.price);
   data.append('category', formData.category);
   data.append('stock', formData.stock);
   data.append('seller_id', user.id);
   data.append('description', '');
   if (formData.image) {
     data.append('image', formData.image);
   }
   
   const response = await fetch(`${API_URL}/api/seller/products`, {
    method: 'POST',
    body: data
   });
   
   if (response.ok) {
    setIsModalOpen(false);
    setFormData({ title: '', price: '', image: null, category: '', stock: '' });
    const refreshed = await fetch(`${API_URL}/api/seller/products?seller_id=${user.id}`);
    if (refreshed.ok) {
     setProducts(await refreshed.json());
    }
   } else {
    console.error('Failed to add product');
   }
  } catch (err) {
   console.error('Error adding product:', err);
  } finally {
   setIsSubmitting(false);
  }
 };

 const handleDecideToPool = async () => {
 if (!adPoolProductId) {
  alert("Please select a product");
  return;
 }
 setIsDeploying(true);
 try {
  const response = await fetch(`${API_URL}/api/pool/join`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
   seller_id: user.id,
   product_id: parseInt(adPoolProductId),
   budget: parseFloat(adPoolBudget)
  }),
  });
  if (response.ok) {
  setAdPoolState('pooled_done');
  fetch(`${API_URL}/api/seller/metrics?seller_id=${user.id}`).then(r => r.json()).then(setMetrics);
  } else {
  const errorData = await response.json().catch(() => ({}));
  alert(`Failed to join pool: ${errorData.detail || 'Unknown error'}`);
  }
 } catch (err) {
  console.error(err);
  alert("Error joining Ad Ne Bana Di Jodi");
 } finally {
  setIsDeploying(false);
 }
 };

 if (!user) return null;

 const handleRemoveFromPool = async (productId) => {
  try {
   const res = await fetch(`${API_URL}/api/pool/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seller_id: user.id, product_id: productId })
   });
   if (res.ok) {
    alert("Product removed from Ad Ne Bana Di Jodi.");
    fetch(`${API_URL}/api/seller/metrics?seller_id=${user.id}`).then(r => r.json()).then(setMetrics);
   } else {
    const err = await res.json();
    alert(`Failed to remove: ${err.detail}`);
   }
  } catch (e) {
   console.error(e);
  }
 };

 const refreshMetrics = () => {
  fetch(`${API_URL}/api/seller/metrics?seller_id=${user.id}`)
   .then(r => r.json())
   .then(setMetrics)
   .catch(err => console.error("Metrics error:", err));
 };

 const handlePayBalance = async (productId) => {
  try {
   const url = productId
    ? `${API_URL}/api/seller/pay?seller_id=${user.id}&product_id=${productId}`
    : `${API_URL}/api/seller/pay?seller_id=${user.id}`;
   const res = await fetch(url, { method: 'POST' });
   if (res.ok) {
    alert("Payment successful!");
    refreshMetrics();
   }
  } catch (e) {
   console.error(e);
  }
 };

 return (
 <div className="min-h-screen bg-[#F8F6F0] text-[#410F29] relative overflow-hidden font-sans">
  
  {/* Background Blobs */}
  <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#095955] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>
  <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#F47216] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>

  <nav className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm transition-all">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div className="flex justify-between items-center h-20">
   <div className="flex items-center">
    <Store className="h-6 w-6 text-[#095955] mr-2"/>
    <span className="text-[#095955] text-xl font-bold tracking-tight">Seller Dashboard</span>
   </div>
   
   {/* Header Branding */}
   <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-baseline gap-2">
    <span className="text-2xl font-bold tracking-tight text-[#410F29]">meesho</span>
    <span className="text-sm font-semibold text-[#095955]">ScriptedBy{'{'}Her{'}'} 2.0</span>
   </div>

   <div className="flex items-center space-x-4">
    <span className="text-gray-700 text-sm font-medium bg-gray-100 px-4 py-2 rounded-full hidden sm:block border border-gray-200">Welcome, {user.name}</span>
    <button 
    onClick={handleLogout}
    className="p-2.5 bg-red-50 border border-red-100 rounded-full text-red-500 shadow-sm hover:shadow hover:-translate-y-0.5 hover:bg-red-100 transition-all"
    title="Log out"
    >
    <LogOut className="h-5 w-5"/>
    </button>
   </div>
   </div>
  </div>
  </nav>

  <main className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
  <div>
   {/* Ad Ne Bana Di Jodi Section */}
   <div className="mb-10 rounded-2xl overflow-hidden relative border-[4px] border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
   <div className="p-6 md:p-8 border-b-[4px] border-black bg-[#F8F6F0] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
    <h2 className="text-3xl font-black text-[#410F29] flex items-center tracking-tighter uppercase">
     <TrendingUp className="h-8 w-8 mr-2 text-[#F47216]"/>
     Ad Ne Bana Di Jodi
    </h2>
    <p className="text-gray-700 font-bold mt-2">Boost your sales by pooling your products into our targeted ad network.</p>
    </div>
    <button 
    onClick={() => {
     setIsAdPoolOpen(!isAdPoolOpen);
     if (!isAdPoolOpen) {
      setAdPoolState('initial');
      setAdPoolProductId('');
     } else {
      setAdPoolState('initial');
     }
    }}
    className="px-6 py-3 bg-[#F47216] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
    >
    {isAdPoolOpen ? 'Close Ad Ne Bana Di Jodi' : 'Join Ad Ne Bana Di Jodi'}
    </button>
   </div>
   
   {isAdPoolOpen && (
    <div className="p-8 bg-gray-50/50">
    <div className="max-w-2xl mx-auto">
     
     {adPoolState === 'initial' && (
      <div className="bg-white p-8 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
       <div className="w-16 h-16 bg-[#095955]/10 border-[2px] border-black rounded-xl flex items-center justify-center mx-auto mb-4">
        <Store className="h-8 w-8 text-[#095955]" />
       </div>
       <h3 className="text-2xl font-black text-[#410F29] mb-2 uppercase tracking-tight">Check Your Eligibility</h3>
       <p className="text-gray-700 font-bold mb-6">We ensure only high-quality, authentic small sellers enter the Ad Ne Bana Di Jodi to maintain premium ad slots.</p>
       <button onClick={runSellerCheck} className="px-8 py-3 bg-[#095955] text-white font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all inline-flex items-center">
        Run Seller Scale Check <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
       </button>
      </div>
     )}

     {(adPoolState === 'checking_seller' || adPoolState === 'seller_pass' || adPoolState === 'seller_fail') && (
      <div className="bg-white p-8 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
       <h3 className="text-xl font-black text-[#410F29] mb-6 flex items-center uppercase tracking-tight">
        {adPoolState === 'checking_seller' && <Loader2 className="animate-spin h-5 w-5 mr-2 text-[#F47216]" />}
        Seller Scale Checks
       </h3>
       <div className="space-y-4">
        {sellerChecks.map((chk, i) => (
         <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-fade-in-up">
          <span className="font-medium text-gray-700">{chk.name}</span>
          <div className="flex items-center gap-3">
           <span className="text-sm text-gray-500 font-mono">{chk.value}</span>
           {chk.pass ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-red-500" />}
          </div>
         </div>
        ))}
       </div>
       
       {adPoolState === 'seller_fail' && (
        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border-[3px] border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] text-center font-bold">
         You do not meet the scale requirements for the micro-budget Ad Ne Bana Di Jodi.
        </div>
       )}
       {adPoolState === 'seller_pass' && (
        <div className="mt-8 pt-6 border-t-[3px] border-black">
         <h4 className="text-lg font-black text-[#410F29] mb-4 uppercase">Select Product to Pool</h4>
         <select
          value={adPoolProductId}
          onChange={(e) => runProductCheck(e.target.value)}
          className="block w-full pl-4 pr-10 py-3 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F47216] rounded-xl bg-gray-50 cursor-pointer"
         >
          <option value="">-- Select a product for Quality Check --</option>
          {products.map(p => (
           <option key={p.id} value={p.id}>{p.title} (₹{Number(p.price).toFixed(2)})</option>
          ))}
         </select>
        </div>
       )}
      </div>
     )}

     {(adPoolState === 'checking_product' || adPoolState === 'product_fail' || adPoolState === 'configure') && (
      <div className="mt-6 bg-white p-8 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-fade-in-up">
       <h3 className="text-xl font-black text-[#410F29] mb-6 flex items-center uppercase tracking-tight">
        {adPoolState === 'checking_product' && <Loader2 className="animate-spin h-5 w-5 mr-2 text-[#F47216]" />}
        Product Quality Checks
       </h3>
       <div className="space-y-4">
        {productChecks.map((chk, i) => (
         <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-fade-in-up">
          <span className="font-medium text-gray-700">{chk.name}</span>
          <div className="flex items-center gap-3">
           <span className="text-sm text-gray-500 font-mono">{chk.value}</span>
           {chk.pass ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-red-500" />}
          </div>
         </div>
        ))}
       </div>

       {adPoolState === 'product_fail' && (
        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border-[3px] border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] text-center font-bold">
         This product does not meet our high-quality threshold. Please select a different product.
        </div>
       )}
      </div>
     )}

     {adPoolState === 'configure' && (
      <div className="mt-6 space-y-6 bg-[#095955]/10 p-8 rounded-2xl border-[4px] border-[#095955] shadow-[6px_6px_0px_0px_rgba(9,89,85,1)] animate-fade-in-up">
       <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black text-[#095955] flex items-center uppercase tracking-tight">
         <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
         Eligible for Ad Ne Bana Di Jodi
        </h3>
       </div>
       <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
        <span>Set Daily Budget</span>
        <span className="bg-[#F47216]/10 text-[#F47216] px-3 py-1 rounded-full text-xs font-bold tracking-wide">₹{adPoolBudget}</span>
        </label>
        <input 
        type="range"
        min="50"
        max="150"
        step="5"
        value={adPoolBudget} 
        onChange={(e) => setAdPoolBudget(e.target.value)}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#F47216]"
        />
        <div className="flex justify-between text-xs font-medium text-gray-400 mt-3">
        <span>₹50</span>
        <span>₹150</span>
        </div>
       </div>
       
       {(metrics.pooling_count ?? 0) >= 3 && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border-2 border-amber-400 text-sm font-bold text-center">
         You already have 3 products in the pooling process (max limit).
        </div>
       )}

       <div className="pt-4">
        <button
        onClick={handleDecideToPool}
        disabled={isDeploying || (metrics.pooling_count ?? 0) >= 3}
        className="w-full flex justify-center items-center px-4 py-3.5 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none text-xl font-black uppercase tracking-wider text-white bg-[#095955] transition-all disabled:opacity-50"
        >
        <Zap className="h-6 w-6 mr-2 text-white"/>
        {isDeploying ? 'Joining Pool...' : 'Decide to Pool'}
        </button>
       </div>
      </div>
     )}

     {adPoolState === 'pooled_done' && (
      <div className="bg-white p-8 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center animate-fade-in-up">
       <div className="w-16 h-16 bg-emerald-100 border-[2px] border-black rounded-xl flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
       </div>
       <h3 className="text-2xl font-black text-[#410F29] mb-2 uppercase tracking-tight">You're in the pool!</h3>
       <p className="text-gray-700 font-bold mb-6 max-w-md mx-auto">
        Your product has been submitted. We'll notify you when your combo ad goes live — check back here for campaign performance.
       </p>
       <button
        onClick={() => { setIsAdPoolOpen(false); setAdPoolState('initial'); }}
        className="px-8 py-3 bg-[#095955] text-white font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all"
       >
        Done
       </button>
      </div>
     )}

    </div>
    </div>
   )}

   {(metrics.pooling_count ?? 0) > 0 && !metrics.active && (
    <div className="p-6 md:p-8 bg-[#095955]/5 border-t-[4px] border-[#095955] text-center">
     <p className="font-black text-[#410F29] uppercase tracking-tight">Campaign submitted</p>
     <p className="text-sm text-gray-700 font-bold mt-2 max-w-md mx-auto">
      We're setting up your combo ad. Performance stats will show here once it goes live.
     </p>
    </div>
   )}

   {/* Active Campaigns — one card per product with its own metrics */}
   {metrics.active && metrics.active_ads?.length > 0 && (
    <div className="p-8 bg-white border-t-[4px] border-black">
    <div className="flex items-center justify-between mb-6">
     <h3 className="text-2xl font-black tracking-tighter uppercase text-[#410F29]">Active Campaigns</h3>
     <span className="bg-[#F47216] text-[#410F29] text-xs font-black px-3 py-1 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider">Live</span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
     {metrics.active_ads.map(ad => {
      const myProduct = ad.products.find(p => p.seller_id === user.id);
      if (!myProduct) return null;
      const clicks = myProduct.clicks ?? 0;
      const remainingBudget = myProduct.remaining_budget ?? 0;
      const totalSpend = myProduct.total_spend ?? clicks * 2;
      const salesGenerated = myProduct.sales_generated ?? Math.round(clicks * 0.12 * 80);
      return (
       <div key={`${ad.id}-${myProduct.id}`} className="bg-[#F8F6F0] rounded-2xl overflow-hidden border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
        <img
         src={myProduct.image_url?.startsWith('/') ? `${API_URL}${myProduct.image_url}` : myProduct.image_url}
         alt={myProduct.title}
         className="w-full h-44 object-cover border-b-[3px] border-black"
        />
        <div className="p-5 flex-grow flex flex-col">
         <h5 className="font-black text-[#410F29] mb-1 uppercase tracking-tight text-lg">{myProduct.title}</h5>
         <p className="text-xs font-black text-[#F47216] mb-4 uppercase tracking-wider">
          Ad Slot #{ad.id}
          {ad.seconds_remaining != null && ` · ${Math.floor(ad.seconds_remaining / 60)}m ${ad.seconds_remaining % 60}s left`}
         </p>

         <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-4 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
           <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider block">Remaining Budget</span>
           <span className="text-2xl font-black text-[#410F29] mt-1">₹{remainingBudget.toFixed(2)}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
           <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider block">Clicks</span>
           <span className="text-2xl font-black text-[#410F29] mt-1">{clicks.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
           <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider block">Total Spend</span>
           <span className="text-2xl font-black text-[#410F29] mt-1">₹{totalSpend.toFixed(2)}</span>
          </div>
          <div className="bg-[#F47216] p-4 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
           <span className="text-[10px] font-black text-[#410F29] uppercase tracking-wider block">Sales Generated</span>
           <span className="text-2xl font-black text-white mt-1">₹{salesGenerated.toLocaleString()}</span>
          </div>
         </div>

         <div className="flex gap-3 mt-auto">
          <button
           onClick={() => handlePayBalance(myProduct.id)}
           className="flex-1 bg-[#410F29] text-white text-xs font-black uppercase tracking-wider py-2.5 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
           Pay Balance
          </button>
          <button
           onClick={() => handleRemoveFromPool(myProduct.id)}
           className="flex-1 bg-red-100 text-red-600 text-xs font-black uppercase tracking-wider py-2.5 rounded-xl border-[2px] border-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] hover:-translate-y-0.5 transition-all"
          >
           Remove from Pool
          </button>
         </div>
        </div>
       </div>
      );
     })}
    </div>
    </div>
   )}
   </div>

   <div className="flex justify-between items-center mb-8 mt-12">
   <div className="mb-2">
    <h2 className="text-3xl font-black tracking-tighter uppercase text-[#410F29]">Your Inventory</h2>
   </div>
   <button 
    onClick={() => setIsModalOpen(true)}
    className="flex items-center px-6 py-3 bg-[#095955] text-white font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
   >
    <Plus className="h-5 w-5 mr-1.5"/>
    Add Product
   </button>
   </div>

   {products.length === 0 ? (
   <div className="text-center py-20 bg-white rounded-3xl border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
    <div className="bg-[#F8F6F0] w-24 h-24 rounded-2xl border-[3px] border-black flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
    <Package className="h-10 w-10 text-[#410F29]"/>
    </div>
    <h3 className="text-2xl font-black uppercase tracking-tight text-[#410F29]">No products found</h3>
    <p className="mt-3 text-base text-gray-700 font-bold mb-8 max-w-sm mx-auto">Get started by creating a new product to list in your catalog and push to the Ad Ne Bana Di Jodi.</p>
    <button 
    onClick={() => setIsModalOpen(true)}
    className="inline-flex items-center px-8 py-3.5 text-lg font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white bg-[#095955] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
    >
    <Plus className="h-6 w-6 mr-2"/>
    Add First Product
    </button>
   </div>
   ) : (
   <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {products.map((product) => (
     <div key={product.id} className="bg-white overflow-hidden rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
      <div className="relative h-56 bg-[#F8F6F0] flex-shrink-0 border-b-[3px] border-black overflow-hidden">
      {product.image_url ? (
       <img 
       src={product.image_url.startsWith('/') ? `${API_URL}${product.image_url}` : product.image_url} 
       alt={product.title} 
       className="w-full h-full object-cover border-b-2 border-transparent"
       />
      ) : (
       <div className="flex items-center justify-center h-full w-full text-gray-300">
       <ImageIcon className="h-16 w-16"/>
       </div>
      )}
      {product.category && (
       <span className="absolute top-4 left-4 px-3 py-1 bg-[#F47216] text-[#410F29] text-xs font-black rounded-lg border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider">
       {product.category}
       </span>
      )}
      </div>
      <div className="p-6 flex flex-col flex-grow">
      <div className="flex justify-between items-start mb-2">
       <h3 className="text-xl font-black text-[#410F29] line-clamp-2 uppercase tracking-tight" title={product.title}>
       {product.title}
       </h3>
      </div>
      <div className="mt-auto flex items-center justify-between pt-4">
       <div className="text-2xl font-black text-[#095955]">
       ₹{Number(product.price).toFixed(2)}
       </div>
       <div className="text-xs font-black uppercase tracking-wider text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
       Stock: <span className={product.stock > 0 ? "text-[#095955] ml-1" : "text-red-500 ml-1"}>{product.stock}</span>
       </div>
      </div>
      </div>
     </div>
    ))}
   </div>
   )}
  </div>
  </main>

  {/* Add Product Modal */}
  {isModalOpen && (
  <div className="fixed inset-0 z-50 overflow-y-auto">
   <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
   {/* Background overlay */}
   <div 
    className="fixed inset-0 transition-opacity bg-[#410F29]/40 backdrop-blur-sm"
    aria-hidden="true"
    onClick={() => setIsModalOpen(false)}
   ></div>

   <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

   {/* Modal panel */}
   <div className="relative z-10 inline-block align-bottom bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left overflow-hidden transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
    <div className="px-6 pt-6 pb-6 sm:p-8">
    <div className="flex justify-between items-center mb-6">
     <h3 className="text-2xl font-black text-[#410F29] uppercase tracking-tighter">
     Add New Product
     </h3>
     <button 
     onClick={() => setIsModalOpen(false)}
     className="text-black bg-gray-100 border-[2px] border-black p-2 hover:bg-gray-200 transition-all"
     >
     <X className="h-5 w-5"/>
     </button>
    </div>
    
    <form onSubmit={handleSubmit} className="space-y-5">
     <div>
     <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1.5">Product Name</label>
     <input
      type="text"
      name="title"
      id="title"
      required
      value={formData.title}
      onChange={handleInputChange}
      className="block w-full border border-gray-200 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent text-gray-900 px-4 py-3 transition-all"
      placeholder="e.g. Premium Linen Shirt"
     />
     </div>
     
     <div className="grid grid-cols-2 gap-5">
     <div>
      <label htmlFor="price" className="block text-sm font-semibold text-gray-700 mb-1.5">Price (₹)</label>
      <input
      type="number"
      name="price"
      id="price"
      required
      min="0"
      step="0.01"
      value={formData.price}
      onChange={handleInputChange}
      className="block w-full border border-gray-200 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent text-gray-900 px-4 py-3 transition-all"
      placeholder="0.00"
      />
     </div>
     <div>
      <label htmlFor="stock" className="block text-sm font-semibold text-gray-700 mb-1.5">Stock Quantity</label>
      <input
      type="number"
      name="stock"
      id="stock"
      required
      min="0"
      value={formData.stock}
      onChange={handleInputChange}
      className="block w-full border border-gray-200 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent text-gray-900 px-4 py-3 transition-all"
      placeholder="0"
      />
     </div>
     </div>

     <div>
     <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
     <input
      type="text"
      name="category"
      id="category"
      required
      value={formData.category}
      onChange={handleInputChange}
      className="block w-full border border-gray-200 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent text-gray-900 px-4 py-3 transition-all"
      placeholder="e.g. Top, Bottom, Accessory"
     />
     </div>
     
     <div>
     <label htmlFor="image" className="block text-sm font-semibold text-gray-700 mb-1.5">Product Image</label>
     <input
      type="file"
      name="image"
      id="image"
      accept="image/*"
      required
      onChange={handleInputChange}
      className="block w-full border border-gray-200 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#095955] focus:border-transparent text-gray-900 px-4 py-3 transition-all"
     />
     {formData.image && (
      <div className="mt-4 h-40 bg-gray-50 rounded-2xl overflow-hidden border border-gray-200">
       <img 
       src={URL.createObjectURL(formData.image)} 
       alt="Preview"
       className="w-full h-full object-cover"
       />
      </div>
     )}
     </div>

     <div className="mt-8 sm:flex sm:flex-row-reverse gap-3 pt-4">
     <button
      type="submit"
      disabled={isSubmitting}
      className="w-full inline-flex justify-center items-center rounded-full shadow-md px-6 py-3 bg-[#095955] text-base font-bold text-white hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#074643] focus:outline-none transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md sm:w-auto"
     >
      {isSubmitting ? 'Adding...' : 'Add Product'}
     </button>
     <button
      type="button"
      onClick={() => setIsModalOpen(false)}
      className="mt-3 w-full inline-flex justify-center items-center rounded-full border border-gray-200 px-6 py-3 bg-white text-base font-bold text-gray-700 hover:bg-gray-50 focus:outline-none transition-all sm:mt-0 sm:w-auto"
     >
      Cancel
     </button>
     </div>
    </form>
    </div>
   </div>
   </div>
  </div>
  )}
 </div>
 );
}
