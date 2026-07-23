import { Link } from 'react-router-dom';
import { X, Store, Zap, TrendingUp, Gavel, ListOrdered, ShoppingBag, MousePointerClick, BarChart3 } from 'lucide-react';

const STEPS = [
  {
    phase: 'Seller — join the pool',
    icon: Store,
    color: 'bg-[#095955]',
    items: [
      'Click **Login as Seller**, then **Login as Guest Seller**.',
      'On Seller Dashboard, open **Ad Ne Bana Di Jodi**.',
      'Pick a product, set budget (₹50–150), click **Decide to Pool**.',
      'Scroll to **Your Ad Pipeline** — product should show stage **Waiting to Pool**.',
    ],
  },
  {
    phase: 'Demo Console — matchmake & bid',
    icon: Zap,
    color: 'bg-[#F47216]',
    items: [
      'Find the blinking **Demo Console** button (bottom-right).',
      'Click **Run Matchmaking** → check pipeline: stage becomes **Matchmade**.',
      'Click **Run Bidding** → check pipeline again: **In Queue** or **Live**.',
      'If **Live**, metrics appear under **Active Campaigns** on the dashboard.',
    ],
  },
  {
    phase: 'Customer — see & click the ad',
    icon: ShoppingBag,
    color: 'bg-[#410F29]',
    items: [
      'Log out (top-right), go home → **Login as Customer** → **Login as Guest Customer**.',
      'On Customer Feed, find the sponsored **combo ad** at the top.',
      'Click a product zone in the ad — click is attributed to that product.',
    ],
  },
  {
    phase: 'Seller — verify metrics',
    icon: BarChart3,
    color: 'bg-[#095955]',
    items: [
      'Log out, log back in as **Guest Seller**.',
      'Open **Active Campaigns** — check **Clicks**, **Spend**, and **Sales Generated** updated.',
      'Optional: use **Withdraw** in the pipeline to free a slot and re-join.',
    ],
  },
];

function renderInlineBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-[#410F29] font-black">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

export default function DemoGuideModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="fixed inset-0 bg-[#410F29]/50 backdrop-blur-sm"
          aria-hidden="true"
          onClick={onClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-guide-title"
          className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-2xl"
        >
          <div className="sticky top-0 z-10 bg-[#F47216] border-b-[4px] border-black px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#410F29]/80 mb-1">
                Judge walkthrough
              </p>
              <h2
                id="demo-guide-title"
                className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#410F29] flex items-center gap-2"
              >
                <ListOrdered className="h-7 w-7 shrink-0" />
                How to Test Demo
              </h2>
              <p className="text-sm font-bold text-[#410F29]/90 mt-2 max-w-md">
                Follow these steps end-to-end — seller pool → matchmaking → customer feed → metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 bg-white border-[2px] border-black rounded-xl hover:bg-gray-100 transition-all"
              aria-label="Close guide"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-6">
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="px-2 py-1 bg-gray-100 border-2 border-black rounded-lg flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Waiting
              </span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 bg-purple-100 border-2 border-black rounded-lg">Matchmade</span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 bg-orange-100 border-2 border-black rounded-lg flex items-center gap-1">
                <Gavel className="h-3 w-3" /> Auction
              </span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 bg-yellow-100 border-2 border-black rounded-lg">Queue</span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 bg-emerald-100 border-2 border-black rounded-lg">Live</span>
            </div>

            {STEPS.map((section, sectionIdx) => {
              const Icon = section.icon;
              return (
                <section
                  key={section.phase}
                  className="rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                >
                  <div className={`${section.color} px-4 py-3 border-b-[3px] border-black flex items-center gap-2`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 border-2 border-black/30 text-white font-black text-sm">
                      {sectionIdx + 1}
                    </span>
                    <Icon className="h-5 w-5 text-white shrink-0" />
                    <h3 className="font-black uppercase tracking-tight text-white text-sm sm:text-base">
                      {section.phase}
                    </h3>
                  </div>
                  <ol className="bg-[#F8F6F0] px-4 py-4 space-y-3 list-none">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex gap-3 text-sm font-bold text-gray-800 leading-relaxed">
                        <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-white border-2 border-black text-[10px] font-black text-[#095955]">
                          {itemIdx + 1}
                        </span>
                        <span>{renderInlineBold(item)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}

            <div className="flex items-start gap-3 p-4 bg-[#095955]/10 border-[2px] border-[#095955] rounded-xl">
              <MousePointerClick className="h-5 w-5 text-[#095955] shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-gray-700 leading-relaxed">
                <strong className="text-[#410F29] uppercase tracking-wide">Tip:</strong> Keep the Demo Console
                open while testing — it shows live pipeline status and presenter controls for matchmaking and bidding.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 border-t-[4px] border-black bg-white px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border-[3px] border-black font-black uppercase tracking-wider text-[#410F29] bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
            >
              Got it
            </button>
            <Link
              to="/seller-login"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border-[3px] border-black font-black uppercase tracking-wider text-white bg-[#095955] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all text-center"
            >
              Start as Guest Seller
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
