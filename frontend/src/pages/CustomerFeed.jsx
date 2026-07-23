import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, ShoppingCart, LogOut } from 'lucide-react';
import { API_URL } from '../config';

const resolveImageUrl = (url) => {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
};

function SmartComboAd({ comboAd }) {
  if (!comboAd) return null;
  
  const isBigSeller = comboAd.is_big_seller;
  if (!isBigSeller && (!comboAd.products || comboAd.products.length < 3)) return null;

  const handleAdClick = async (productId, adId) => {
    try {
      const response = await fetch(`${API_URL}/api/ads/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, ad_id: adId })
      });
      if (response.ok) {
        console.log("Click attributed");
      }
    } catch (error) {
      console.error("Ad click failed", error);
    }
  };

  const adId = comboAd.id;

   if (isBigSeller) {
    return (
      <div className="bg-white overflow-hidden rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 relative group">
        <div className="absolute top-0 right-0 bg-[#095955] text-white px-4 py-1.5 text-xs font-black uppercase tracking-wider z-10 border-b-[3px] border-l-[3px] border-black shadow-[-4px_4px_0px_0px_rgba(0,0,0,1)] rounded-bl-xl">
          Sponsored
        </div>
        <div className="h-56 bg-[#F8F6F0] flex items-center justify-center border-b-[3px] border-black relative overflow-hidden">
          {comboAd.image_url ? (
            <img 
              src={resolveImageUrl(comboAd.image_url)} 
              alt="Premium Ad"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => handleAdClick(null, adId)}
            />
          ) : (
            <div className="w-full h-full bg-[#095955]/10"></div>
          )}
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-xl font-black uppercase tracking-tight text-[#410F29] truncate">Premium Collection</h3>
          <p className="mt-2 text-sm text-gray-700 line-clamp-2 font-bold uppercase tracking-wider">Discover premium picks and exclusive trending styles.</p>
          <div className="mt-auto pt-6 flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-wider text-[#F47216]">Promoted</span>
            <button onClick={() => handleAdClick(null, adId)} className="px-5 py-2.5 bg-[#F47216] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
              Shop Now
            </button>
          </div>
        </div>
      </div>
    );
  }

   const products = comboAd.products || [];
  const showInvalidTrio = comboAd.valid_trio === false;
  return (
    <div className="bg-white overflow-hidden rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 relative group sm:col-span-2 lg:col-span-2">
      <div className="absolute top-0 right-0 bg-[#F47216] text-[#410F29] px-4 py-1.5 text-[10px] font-black uppercase tracking-wider z-20 border-b-[3px] border-l-[3px] border-black shadow-[-4px_4px_0px_0px_rgba(0,0,0,1)] rounded-bl-xl">
        Sponsored Combo
      </div>
      
      {/* Composited Background Image */}
      <div className="h-56 bg-[#F8F6F0] relative overflow-hidden flex-shrink-0 border-b-[3px] border-black">
        {comboAd.image_url ? (
          <img 
            src={resolveImageUrl(comboAd.image_url)} 
            alt="Combo Ad"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#095955]/10"></div>
        )}

        {/* Tap Zones overlaid on top for combo ads */}
        <div className="absolute inset-0 flex w-full h-full z-10">
          {products.slice(0, 3).map((product, index) => (
            <div 
              key={product.id}
              onClick={() => handleAdClick(product.id, adId)}
              className="flex-1 cursor-pointer hover:bg-black/20 transition-colors flex flex-col justify-end p-2 sm:p-4 pb-4 sm:pb-6 group/zone border-r-[3px] border-transparent hover:border-black last:border-0"
              title={`Click to view ${product.title}`}
            >
              <div className="opacity-0 group-hover/zone:opacity-100 text-[#410F29] font-black uppercase tracking-wider bg-white border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[10px] sm:text-xs text-center py-2 px-1 rounded-xl transition-all transform translate-y-2 group-hover/zone:translate-y-0">
                Shop {product.title.split(' ').slice(0,2).join(' ')}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 sm:p-6 flex flex-col flex-grow bg-white">
        <h3 className="text-xl font-black uppercase tracking-tight text-[#410F29]">Trending Ad Ne Bana Di Jodi</h3>
        {showInvalidTrio ? (
          <>
            <p className="mt-3 text-sm font-black uppercase tracking-wide text-red-700 bg-red-50 border-2 border-red-600 rounded-xl px-3 py-2">
              No valid trio — pool needs Top + Bottom + Accessory (or another full template set).
            </p>
            <p className="mt-2 text-xs text-gray-600 font-bold uppercase tracking-wider">
              Showing best available combo until a proper Jodi can be formed.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-700 line-clamp-2 font-bold uppercase tracking-wider">A perfect match curated for you.</p>
        )}
      </div>
    </div>
  );
}

export default function CustomerFeed() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [comboAds, setComboAds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/customer-login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'customer') {
      navigate('/');
      return;
    }
    setUser(parsedUser);
    
    // Fetch products
    fetch(`${API_URL}/api/products`)
      .then(res => res.json())
      .then(data => setProducts(data));

    // Fetch combo ad
    const fetchCombo = () => {
      fetch(`${API_URL}/api/combo-ads/active`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setComboAds(data);
        }
      })
      .catch(err => console.error("Failed to fetch combo ad", err));
    };
    fetchCombo();
    const interval = setInterval(fetchCombo, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!user) return null;

  // Interleave ads into the product feed
  const feedItems = [];
  let adIndex = 0;
  for (let i = 0; i < products.length; i++) {
    // Insert an ad every 4 products
    if (i > 0 && i % 4 === 0 && adIndex < comboAds.length) {
      feedItems.push({ isAd: true, data: comboAds[adIndex] });
      adIndex++;
    }
    feedItems.push({ isAd: false, data: products[i] });
  }
  // If products are few but we have ads, append them at the end
  while(adIndex < comboAds.length) {
    feedItems.push({ isAd: true, data: comboAds[adIndex] });
    adIndex++;
  }

  return (
  <div className="min-h-screen bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-[#410F29] relative overflow-hidden font-sans">

    <nav className="bg-[#F8F6F0] border-b-[4px] border-black sticky top-0 z-50 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-20">
      <div className="flex items-center">
        <ShoppingBag className="h-6 w-6 text-[#095955] mr-2"/>
        <span className="text-[#095955] text-xl font-black uppercase tracking-tight">Customer Feed</span>
      </div>
      
      {/* Header Branding */}
      <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-baseline gap-2">
        <span className="text-3xl font-black uppercase tracking-tighter text-[#410F29]">meesho</span>
        <span className="text-sm font-black uppercase tracking-wider text-[#095955] bg-[#095955]/10 px-2 py-0.5 border-[2px] border-black rounded-lg">ScriptedBy{'{'}Her{'}'} 2.0</span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative hidden sm:block">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-700"/>
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 sm:text-sm border-[3px] border-black rounded-xl font-bold bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-[#F47216]/20 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          placeholder="Search products..."
        />
        </div>
        <button className="p-2.5 bg-white border-[3px] border-black rounded-xl text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all relative">
        <ShoppingCart className="h-5 w-5"/>
        <span className="absolute -top-2 -right-2 block h-4 w-4 rounded-full bg-[#F47216] border-[2px] border-black"></span>
        </button>
        <button 
        onClick={handleLogout}
        className="p-2.5 bg-red-400 border-[3px] border-black rounded-xl text-[#410F29] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
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
      <div className="mb-8 mt-4">
      <h2 className="text-3xl font-black uppercase tracking-tight text-[#410F29]">Discover</h2>
      <p className="text-gray-700 font-bold uppercase tracking-wider mt-2">Personalized products and sponsored collections.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {feedItems.map((item, index) => {
        if (item.isAd) {
          return <SmartComboAd key={`ad-${item.data.id}-${index}`} comboAd={item.data} />;
        }
        
        const product = item.data;
        return (
          <div key={`prod-${product.id}`} className="bg-white overflow-hidden rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 group">
          <div className="h-56 bg-[#F8F6F0] flex items-center justify-center border-b-[3px] border-black relative overflow-hidden">
            {product.image_url ? (
            <img 
              src={resolveImageUrl(product.image_url)} 
              alt={product.title} 
              className="w-full h-full object-cover"
            />
            ) : (
            <ShoppingBag className="h-16 w-16 text-[#095955]/20 group-hover:scale-110 transition-transform duration-500"/>
            )}
          </div>
          <div className="p-6 flex flex-col flex-grow">
            <h3 className="text-xl font-black uppercase tracking-tight text-[#410F29] truncate">{product.title}</h3>
            <p className="mt-2 text-sm text-gray-700 line-clamp-2 font-bold uppercase tracking-wider">{product.description ||"Premium quality product."}</p>
            <div className="mt-auto pt-6 flex items-center justify-between">
            <span className="text-2xl font-black text-[#095955]">₹{product.price.toFixed(2)}</span>
            <button onClick={() => alert("Added to cart!")} className="px-5 py-2.5 bg-[#F47216] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
              Add to Cart
            </button>
            </div>
          </div>
          </div>
        );
      })}
      </div>
    </div>
    </main>
  </div>
  );
}
