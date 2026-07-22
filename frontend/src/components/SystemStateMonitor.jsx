import { useEffect, useState, useCallback } from 'react';
import { Activity, X, Clock } from 'lucide-react';
import { API_URL } from '../config';

const EMPTY = {
  waiting_pool: [],
  matchmade_ads: [],
  bidding_ads: [],
  queued_ads: [],
  active_ads: [],
  workflow_phase: 'idle',
};

const imgUrl = (url) => {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
};

const formatTime = (seconds) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

function Bucket({ title, count, color, children }) {
  return (
    <div className="flex flex-col min-h-[120px] max-h-[200px] bg-white rounded-xl border-2 border-black overflow-hidden">
      <div className={`px-3 py-2 border-b-2 border-black flex justify-between items-center ${color}`}>
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
        <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

function AdCard({ ad, onRemove, showRemove, showTimer, removing }) {
  const label = ad.ad_type === 'individual'
    ? (ad.big_seller_name || 'Enterprise')
    : `Trio #${ad.id}`;

  return (
    <div className="p-2 bg-gray-50 rounded-lg border border-black text-xs relative group">
      {showRemove && (
        <button
          onClick={() => onRemove(ad.id)}
          disabled={removing === ad.id}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-red-600 z-10 disabled:opacity-50"
          title="Remove active ad"
        >
          ✕
        </button>
      )}
      {ad.image_url && (
        <img src={imgUrl(ad.image_url)} alt="" className="w-full h-12 object-cover rounded border border-black mb-1" />
      )}
      <div className="font-bold text-[#410F29] truncate pr-5">{label}</div>
      <div className="text-[#095955] font-black">₹{ad.total_budget?.toFixed(0)}</div>
      {showTimer && ad.seconds_remaining != null && (
        <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-0.5">
          <Clock className="h-3 w-3" />
          {formatTime(ad.seconds_remaining)} left
        </div>
      )}
      {ad.products?.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {ad.products.map(p => (
            <div key={p.id} className="truncate text-gray-600">{p.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ item }) {
  return (
    <div className="p-2 bg-gray-50 rounded-lg border border-black text-xs flex items-center gap-2">
      {item.image_url && (
        <img src={imgUrl(item.image_url)} alt="" className="w-8 h-8 object-cover rounded border border-black flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-bold truncate">{item.title}</div>
        {item.budget != null && <div className="text-[#095955]">₹{item.budget.toFixed(0)}</div>}
      </div>
    </div>
  );
}

export default function SystemStateMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(EMPTY);
  const [removing, setRemoving] = useState(null);

  const fetchStatus = useCallback(() => {
    fetch(`${API_URL}/api/pool/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRemoveActive = async (adId) => {
    setRemoving(adId);
    try {
      const res = await fetch(`${API_URL}/api/ads/${adId}/remove`, { method: 'POST' });
      if (res.ok) fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setRemoving(null);
    }
  };

  const totalItems =
    (status.waiting_pool?.length || 0) +
    (status.matchmade_ads?.length || 0) +
    (status.bidding_ads?.length || 0) +
    (status.queued_ads?.length || 0) +
    (status.active_ads?.length || 0);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 bg-[#F47216] text-[#410F29] rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex items-center gap-2"
      >
        <Activity className="h-5 w-5 animate-pulse" />
        <span className="text-sm font-black uppercase hidden sm:inline">Live Pipeline</span>
        {totalItems > 0 && (
          <span className="bg-[#410F29] text-white text-xs font-black px-2 py-0.5 rounded-full">{totalItems}</span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4 pointer-events-none">
          <div
            className="pointer-events-auto bg-[#F8F6F0] w-full sm:w-[520px] max-h-[85vh] rounded-2xl border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden"
          >
            <div className="bg-[#410F29] p-4 flex justify-between items-center border-b-[3px] border-black">
              <div className="flex items-center gap-2 text-[#F47216]">
                <Activity className="h-5 w-5 text-white animate-pulse" />
                <span className="font-black uppercase tracking-tight text-white text-sm">Live Pipeline State</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white hover:text-[#F47216] p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-3">
              <Bucket title="Waiting to Pool" count={status.waiting_pool?.length || 0} color="bg-gray-100">
                {status.waiting_pool?.map(p => <ProductCard key={p.id} item={p} />)}
                {!status.waiting_pool?.length && <div className="text-gray-400 text-center py-4 text-xs">Empty</div>}
              </Bucket>

              <Bucket title="Matchmade" count={status.matchmade_ads?.length || 0} color="bg-purple-100">
                {status.matchmade_ads?.map(ad => <AdCard key={ad.id} ad={ad} />)}
                {!status.matchmade_ads?.length && <div className="text-gray-400 text-center py-4 text-xs">Empty</div>}
              </Bucket>

              <Bucket title="Bidding" count={status.bidding_ads?.length || 0} color="bg-orange-100">
                {status.bidding_ads?.map(ad => <AdCard key={ad.id} ad={ad} />)}
                {!status.bidding_ads?.length && <div className="text-gray-400 text-center py-4 text-xs">Empty</div>}
              </Bucket>

              <Bucket title="Queue" count={status.queued_ads?.length || 0} color="bg-yellow-100">
                {status.queued_ads?.map(ad => <AdCard key={ad.id} ad={ad} />)}
                {!status.queued_ads?.length && <div className="text-gray-400 text-center py-4 text-xs">Empty</div>}
              </Bucket>

              <Bucket title="Active Ads" count={`${status.active_ads?.length || 0}/3`} color="bg-emerald-100">
                {status.active_ads?.map(ad => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    showRemove
                    showTimer
                    removing={removing}
                    onRemove={handleRemoveActive}
                  />
                ))}
                {!status.active_ads?.length && <div className="text-gray-400 text-center py-4 text-xs">No active ads</div>}
              </Bucket>
            </div>

            <div className="p-2 border-t-2 border-black bg-white text-[10px] text-gray-500 text-center font-bold uppercase">
              Auto-refreshes every 2s · Phase: {status.workflow_phase?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
