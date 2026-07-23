import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, X, Clock, Gavel, Shuffle, Presentation,
  CheckCircle2, User, ShoppingBag, ChevronRight, Loader2,
} from 'lucide-react';
import { API_URL } from '../config';
import ButtonSpinner from './ButtonSpinner';

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

const PHASE_LABELS = {
  idle: 'Idle',
  ready_to_matchmake: 'Ready to matchmake',
  ready_to_bid: 'Ready to bid',
  bidding: 'Bidding in progress',
  lifecycle_active: 'Ads live',
};

function Bucket({ title, count, color, children }) {
  return (
    <div className="flex flex-col min-h-[100px] max-h-[180px] bg-white rounded-xl border-2 border-black overflow-hidden">
      <div className={`px-3 py-2 border-b-2 border-black flex justify-between items-center ${color}`}>
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
        <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
    <div className="p-2 bg-gray-50 rounded-lg border border-black text-xs relative">
      {showRemove && (
        <button
          onClick={() => onRemove(ad.id)}
          disabled={removing === ad.id}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-red-600 z-10 disabled:opacity-50"
          title="Remove active ad"
        >
          {removing === ad.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '✕'}
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

const DEMO_STEPS = [
  { id: 1, label: 'Seller joins pool', hint: 'Seller Dashboard → Join Ad Ne Bana Di Jodi', icon: User },
  { id: 2, label: 'Run AI matchmaking', hint: '7-layer optimizer groups complementary Jodis', icon: Shuffle, action: 'matchmake' },
  { id: 3, label: 'Run bidding', hint: 'Auction vs enterprise sellers', icon: Gavel, action: 'bidding' },
  { id: 4, label: 'View customer feed', hint: 'See live sponsored combo ads', icon: ShoppingBag, link: '/customer-feed' },
];

export default function DemoConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('orchestrator');
  const [status, setStatus] = useState(EMPTY);
  const [removing, setRemoving] = useState(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [isRunningBidding, setIsRunningBidding] = useState(false);
  const [toast, setToast] = useState('');

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleMatchmake = async () => {
    setIsMatchmaking(true);
    try {
      const res = await fetch(`${API_URL}/api/pool/matchmake`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const msg = data.no_valid_trio
          ? `Matchmade ${data.trios_created} trios — no valid cross-category trio (fallback used)`
          : `Matchmade ${data.trios_created} trios`;
        showToast(msg);
        fetchStatus();
      } else {
        showToast(data.detail || `Matchmake failed (${res.status})`);
      }
    } catch {
      showToast('Could not reach backend');
    } finally {
      setIsMatchmaking(false);
    }
  };

  const handleRunBidding = async () => {
    setIsRunningBidding(true);
    try {
      const res = await fetch(`${API_URL}/api/pool/bidding`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`${data.active_count} ads now live on customer feed`);
        fetchStatus();
      } else {
        showToast(data.detail || `Bidding failed (${res.status})`);
      }
    } catch {
      showToast('Could not reach backend');
    } finally {
      setIsRunningBidding(false);
    }
  };

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

  const phase = status.workflow_phase || 'idle';

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end gap-3 max-w-[min(100vw-2rem,20rem)]">
          {/* Speech cloud — guides judges to Demo Console */}
          <div
            className="demo-console-callout relative bg-white text-[#410F29] px-4 py-3 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center"
            role="note"
          >
            <p className="text-sm sm:text-base font-black uppercase tracking-wide leading-snug">
              Test the product
            </p>
            <p className="text-[10px] sm:text-xs font-bold text-[#F47216] mt-1 uppercase tracking-wider">
              Tap Demo Console below ↓
            </p>
            {/* Cloud tail pointing to button */}
            <span
              className="absolute -bottom-2.5 right-8 w-4 h-4 bg-white border-r-[3px] border-b-[3px] border-black rotate-45"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="demo-console-btn-blink p-3 bg-[#410F29] text-[#F47216] rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform flex items-center gap-2"
            title="Open Demo Console — run matchmaking and bidding"
            aria-label="Open Demo Console to test the product"
          >
            <Presentation className="h-5 w-5 shrink-0" />
            <span className="text-sm font-black uppercase">Demo Console</span>
            {totalItems > 0 && (
              <span className="bg-[#F47216] text-[#410F29] text-xs font-black px-2 py-0.5 rounded-full">{totalItems}</span>
            )}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-4">
          <div
            className="absolute inset-0 bg-[#410F29]/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-[#F8F6F0] w-full sm:w-[540px] max-h-[90vh] rounded-2xl border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
            <div className="bg-[#410F29] p-4 border-b-[3px] border-black">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Presentation className="h-5 w-5 text-[#F47216]" />
                    <span className="font-black uppercase tracking-tight text-white text-sm">Demo Console</span>
                  </div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider mt-1">
                    Presenter controls · not part of seller/customer UI
                  </p>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-white hover:text-[#F47216] p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                {[
                  { id: 'orchestrator', label: 'Orchestrator' },
                  { id: 'pipeline', label: 'Live Pipeline' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-black transition-all ${
                      tab === t.id
                        ? 'bg-[#F47216] text-[#410F29]'
                        : 'bg-transparent text-white/80 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {toast && (
              <div className="px-4 py-2 bg-green-100 border-b-2 border-green-500 text-green-900 text-xs font-bold text-center">
                {toast}
              </div>
            )}

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {tab === 'orchestrator' && (
                <>
                  <div className="p-3 bg-white rounded-xl border-2 border-black flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-gray-600">System phase</span>
                    <span className="text-sm font-black text-[#095955] uppercase">
                      {PHASE_LABELS[phase] || phase.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-gray-500 tracking-wider">Demo script</p>
                    {DEMO_STEPS.map((step) => {
                      const Icon = step.icon;
                      const isDone =
                        (step.id === 1 && (status.waiting_pool?.length || 0) > 0) ||
                        (step.id === 2 && (status.matchmade_ads?.length || 0) > 0 || phase === 'ready_to_bid' || phase === 'lifecycle_active') ||
                        (step.id === 3 && (status.active_ads?.length || 0) > 0) ||
                        (step.id === 4 && (status.active_ads?.length || 0) > 0);

                      return (
                        <div
                          key={step.id}
                          className={`p-3 rounded-xl border-2 border-black bg-white flex items-start gap-3 ${
                            isDone ? 'opacity-100' : ''
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center flex-shrink-0 ${
                            isDone ? 'bg-emerald-200' : 'bg-gray-100'
                          }`}>
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            ) : (
                              <span className="text-xs font-black">{step.id}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-[#095955]" />
                              <span className="font-black text-sm text-[#410F29] uppercase">{step.label}</span>
                            </div>
                            <p className="text-[11px] text-gray-600 font-bold mt-0.5">{step.hint}</p>

                            {step.action === 'matchmake' && (
                              <button
                                onClick={handleMatchmake}
                                disabled={isMatchmaking || (status.waiting_pool?.length || 0) < 3}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#F47216] text-[#410F29] text-xs font-black uppercase rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                              >
                                {isMatchmaking ? (
                                  <ButtonSpinner size="h-3.5 w-3.5" />
                                ) : (
                                  <Shuffle className="h-3.5 w-3.5" />
                                )}
                                {isMatchmaking ? 'Matchmaking...' : 'Run AI Matchmaking'}
                              </button>
                            )}

                            {step.action === 'bidding' && (
                              <button
                                onClick={handleRunBidding}
                                disabled={isRunningBidding || (status.matchmade_ads?.length || 0) === 0}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#410F29] text-white text-xs font-black uppercase rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                              >
                                {isRunningBidding ? (
                                  <ButtonSpinner size="h-3.5 w-3.5" className="text-white" />
                                ) : (
                                  <Gavel className="h-3.5 w-3.5" />
                                )}
                                {isRunningBidding ? 'Running auction...' : 'Run Bidding'}
                              </button>
                            )}

                            {step.link && (
                              <Link
                                to={step.link}
                                onClick={() => setIsOpen(false)}
                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#095955] text-white text-xs font-black uppercase rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Open Customer Feed
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-[#F47216]/10 rounded-xl border-2 border-dashed border-[#F47216] text-[11px] font-bold text-[#410F29] leading-relaxed">
                    Show the <strong>Seller Dashboard</strong> as the real product experience. Use this console only to
                    advance the backend pipeline between demo steps.
                  </div>
                </>
              )}

              {tab === 'pipeline' && (
                <>
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-500">
                    <Activity className="h-4 w-4 text-[#F47216] animate-pulse" />
                    Auto-refreshes every 2s
                  </div>

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
                </>
              )}
            </div>

            <div className="p-2 border-t-2 border-black bg-white text-[10px] text-gray-500 text-center font-bold uppercase">
              Phase: {phase.replace(/_/g, ' ')} · Waiting {status.waiting_pool?.length || 0} · Active {status.active_ads?.length || 0}/3
            </div>
          </div>
        </div>
      )}
    </>
  );
}
