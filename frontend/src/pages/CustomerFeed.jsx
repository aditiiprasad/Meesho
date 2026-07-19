import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, ShoppingCart, LogOut } from 'lucide-react';

const resolveImageUrl = (url) => {
  if (!url) return '';
  return url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}${url}` : url;
};

function SmartComboAd({ comboAd }) {
  if (!comboAd) return null;
  
  const isBigSeller = comboAd.is_big_seller;
  if (!isBigSeller && (!comboAd.products || comboAd.products.length < 3)) return null;

  const handleAdClick = async (productId, adId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/ads/click`, {
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
      <div className="bg-white/80 backdrop-blur-md overflow-hidden rounded-3xl border border-white/60 shadow-xl flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 relative group">
        <div className="absolute top-0 right-0 bg-[#095955] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider z-10 shadow-lg rounded-bl-2xl">
          Sponsored
        </div>
        <div className="h-56 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
          {comboAd.image_url ? (
            <img 
              src={resolveImageUrl(comboAd.image_url)} 
              alt="Premium Ad"
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
              onClick={() => handleAdClick(null, adId)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#F47216]/20 to-[#095955]/20 backdrop-blur-md"></div>
          )}
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-xl font-bold text-[#410F29] truncate">Premium Collection</h3>
          <p className="mt-2 text-sm text-gray-500 line-clamp-2 font-medium">Discover premium picks and exclusive trending styles.</p>
          <div className="mt-auto pt-6 flex items-center justify-between">
            <span className="text-sm font-bold text-[#F47216]">Promoted</span>
            <button onClick={() => handleAdClick(null, adId)} className="px-5 py-2.5 bg-[#F47216] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:bg-[#d96213] hover:-translate-y-0.5 transition-all">
              Shop Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pooled Ad - Rectangular grid item design
  const products = comboAd.products || [];
  return (
    <div className="bg-white/80 backdrop-blur-md overflow-hidden rounded-3xl border border-white/60 shadow-xl flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 relative group sm:col-span-2 lg:col-span-2">
      <div className="absolute top-0 right-0 bg-[#F47216] text-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider z-20 shadow-lg rounded-bl-xl">
        Sponsored Combo
      </div>
      
      {/* Composited Background Image */}
      <div className="h-56 bg-gray-50 relative overflow-hidden flex-shrink-0">
        {comboAd.image_url ? (
          <img 
            src={resolveImageUrl(comboAd.image_url)} 
            alt="Combo Ad"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#F47216]/20 to-[#095955]/20 backdrop-blur-md"></div>
        )}

        {/* Tap Zones overlaid on top for combo ads */}
        <div className="absolute inset-0 flex w-full h-full z-10">
          {products.slice(0, 3).map((product, index) => (
            <div 
              key={product.id}
              onClick={() => handleAdClick(product.id, adId)}
              className="flex-1 cursor-pointer hover:bg-black/20 transition-colors flex flex-col justify-end p-2 sm:p-4 pb-4 sm:pb-6 group/zone border-r border-white/10 last:border-0"
              title={`Click to view ${product.title}`}
            >
              <div className="opacity-0 group-hover/zone:opacity-100 text-[#410F29] font-bold bg-white/95 backdrop-blur-sm shadow-xl text-[10px] sm:text-xs text-center py-2 px-1 rounded-xl transition-all transform translate-y-2 group-hover/zone:translate-y-0">
                Shop {product.title.split(' ').slice(0,2).join(' ')}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 sm:p-6 flex flex-col flex-grow bg-gradient-to-br from-[#095955]/5 to-transparent">
        <h3 className="text-xl font-bold text-[#410F29]">Trending Ad Ne Bana Di Jodi</h3>
        <p className="mt-2 text-sm text-gray-500 line-clamp-2 font-medium">A perfect match curated for you.</p>
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
    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/products`)
      .then(res => res.json())
      .then(data => setProducts(data));

    // Fetch combo ad
    const fetchCombo = () => {
      fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/combo-ads/active`)
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
  <div className="min-h-screen bg-[#F8F6F0] text-[#410F29] relative overflow-hidden font-sans">
    
    {/* Background Blobs */}
    <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#095955] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>
    <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#F47216] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none z-0"></div>

    <nav className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm transition-all">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-20">
      <div className="flex items-center">
        <ShoppingBag className="h-6 w-6 text-[#095955] mr-2"/>
        <span className="text-[#095955] text-xl font-bold tracking-tight">Customer Feed</span>
      </div>
      
      {/* Header Branding */}
      <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#410F29]">meesho</span>
        <span className="text-sm font-semibold text-[#095955]">ScriptedBy{'{'}Her{'}'} 2.0</span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative hidden sm:block">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400"/>
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 sm:text-sm border border-transparent rounded-full bg-gray-100/80 text-gray-900 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F47216] focus:border-transparent transition-all shadow-inner"
          placeholder="Search products..."
        />
        </div>
        <button className="p-2.5 bg-white border border-gray-100 rounded-full text-gray-600 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all relative">
        <ShoppingCart className="h-5 w-5"/>
        <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-[#F47216] border-2 border-white"></span>
        </button>
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
      <div className="mb-8">
      <h2 className="text-3xl font-extrabold tracking-tight text-[#410F29]">Discover</h2>
      <p className="text-gray-500 font-medium mt-1">Personalized products and sponsored collections.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {feedItems.map((item, index) => {
        if (item.isAd) {
          return <SmartComboAd key={`ad-${item.data.id}-${index}`} comboAd={item.data} />;
        }
        
        const product = item.data;
        return (
          <div key={`prod-${product.id}`} className="bg-white/80 backdrop-blur-md overflow-hidden rounded-3xl border border-white/60 shadow-xl flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group">
          <div className="h-56 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
            {product.image_url ? (
            <img 
              src={resolveImageUrl(product.image_url)} 
              alt={product.title} 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
            ) : (
            <ShoppingBag className="h-16 w-16 text-gray-300 group-hover:scale-110 transition-transform duration-500"/>
            )}
          </div>
          <div className="p-6 flex flex-col flex-grow">
            <h3 className="text-xl font-bold text-[#410F29] truncate">{product.title}</h3>
            <p className="mt-2 text-sm text-gray-500 line-clamp-2 font-medium">{product.description ||"Premium quality product."}</p>
            <div className="mt-auto pt-6 flex items-center justify-between">
            <span className="text-2xl font-black text-[#095955]">₹{product.price.toFixed(2)}</span>
            <button onClick={() => alert("Added to cart!")} className="px-5 py-2.5 bg-[#F47216] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:bg-[#d96213] hover:-translate-y-0.5 transition-all">
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
