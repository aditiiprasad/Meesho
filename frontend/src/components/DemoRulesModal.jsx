import {
  X,
  BookOpen,
  Shield,
  Store,
  Users,
  Layers,
  Sparkles,
  Gavel,
  ListOrdered,
  Radio,
  MousePointerClick,
  RefreshCw,
  Clock,
  ChevronDown,
  Zap,
} from 'lucide-react';

function FlowArrow({ label, manual }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-4 bg-black" />
      <ChevronDown className="h-5 w-5 text-black -my-1" strokeWidth={3} />
      {label && (
        <span
          className={`mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border-2 border-black ${
            manual ? 'bg-[#F47216] text-[#410F29]' : 'bg-white text-gray-700'
          }`}
        >
          {manual ? `⚡ Demo: ${label}` : label}
        </span>
      )}
    </div>
  );
}

function FlowNode({ icon: Icon, title, stage, color, badge, children }) {
  return (
    <div
      className={`w-full rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${color}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b-[3px] border-black bg-white/40">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          {stage && (
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70 block">{stage}</span>
          )}
          <h3 className="font-black uppercase tracking-tight text-sm leading-tight">{title}</h3>
        </div>
        {badge && (
          <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 bg-black text-white rounded border border-black">
            {badge}
          </span>
        )}
      </div>
      {children && (
        <div className="px-3 py-2.5 text-xs font-bold text-gray-800 leading-relaxed space-y-1">{children}</div>
      )}
    </div>
  );
}

function LayerPill({ n, label, weight }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-full px-1.5 py-2 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <span className="text-[9px] font-black text-[#095955]">L{n}</span>
        <p className="text-[10px] font-black uppercase leading-tight mt-0.5">{label}</p>
        {weight && <p className="text-[9px] font-bold text-[#F47216] mt-0.5">{weight}</p>}
      </div>
    </div>
  );
}

function BranchRow({ left, right }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      <div className="rounded-xl border-[2px] border-dashed border-red-500 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">
        {left}
      </div>
      <div className="rounded-xl border-[2px] border-dashed border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
        {right}
      </div>
    </div>
  );
}

export default function DemoRulesModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="fixed inset-0 bg-[#410F29]/50 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-rules-title"
          className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#F8F6F0] border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-2xl"
        >
          <div className="sticky top-0 z-10 bg-[#095955] border-b-[4px] border-black px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">System flow</p>
              <h2
                id="demo-rules-title"
                className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-2"
              >
                <BookOpen className="h-7 w-7 shrink-0" />
                What Actually Happens
              </h2>
              <p className="text-sm font-bold text-white/90 mt-2">Follow the pipeline top → bottom</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 bg-white border-[2px] border-black rounded-xl hover:bg-gray-100 transition-all"
              aria-label="Close rules"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 sm:px-8 py-6">
            {/* Main vertical flowchart */}
            <div className="max-w-xl mx-auto flex flex-col items-center">
              <FlowNode
                icon={Store}
                stage="Step 1 · Seller action"
                title="Join Ad Ne Bana Di Jodi"
                color="bg-[#095955]/15"
                badge="Max 3"
              >
                <p>Pick product + budget <strong className="text-[#410F29]">₹50–₹150</strong></p>
                <p>Eligibility: rating ≥ 4.0 · return &lt; 10% · spend &lt; ₹150</p>
                <p>Withdraw anytime from pipeline to free a slot</p>
              </FlowNode>

              <FlowArrow label="Product enters pool" />

              <FlowNode
                icon={Users}
                stage="Step 2 · Waiting pool"
                title="Waiting Pool"
                color="bg-gray-100"
              >
                <p>Your product + <strong className="text-[#410F29]">auto-seeded</strong> catalog (~15–30 others)</p>
                <p>Enables trios even with one real seller in the demo</p>
                <p>Goal: groups of <strong className="text-[#410F29]">3 products · 3 sellers</strong></p>
              </FlowNode>

              <FlowArrow label="Run Matchmaking" manual />

              {/* Matchmaking sub-flowchart */}
              <div className="w-full rounded-xl border-[3px] border-black bg-purple-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-3 py-2 bg-purple-200 border-b-[3px] border-black flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span className="font-black uppercase text-sm tracking-tight">7-Layer Jodi Maker</span>
                </div>
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <LayerPill n="1" label="Gatekeeper" />
                    <LayerPill n="2" label="Template" />
                    <LayerPill n="3" label="Semantic" weight="40%" />
                    <LayerPill n="4" label="Audience" weight="30%" />
                    <LayerPill n="5" label="Budget" weight="20%" />
                    <LayerPill n="6" label="CTR" weight="10%" />
                    <LayerPill n="7" label="Wildcard" />
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black bg-white px-1 py-2">
                      <Sparkles className="h-4 w-4 text-[#F47216]" />
                      <p className="text-[9px] font-black uppercase mt-1">Combo banner</p>
                      <p className="text-[9px] font-bold text-gray-600">900×300</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-gray-600 text-center uppercase tracking-wide">
                    Templates: Outfit · Home Decor · Cricket Kit
                  </p>
                </div>
              </div>

              <FlowArrow />

              <FlowNode
                icon={Sparkles}
                stage="Step 3"
                title="Matchmade Jodi"
                color="bg-purple-100"
              >
                <p>3 products stitched into one combo ad</p>
                <p>Status in seller pipeline: <strong className="text-[#410F29]">Matchmade</strong></p>
              </FlowNode>

              <FlowArrow label="Run Bidding" manual />

              <FlowNode
                icon={Gavel}
                stage="Step 4 · Auction"
                title="Bidding vs Enterprise"
                color="bg-orange-100"
              >
                <p>Jodis compete with <strong className="text-[#410F29]">5 big-brand ads</strong></p>
                <p>Ranked by <strong className="text-[#410F29]">bid amount</strong> (highest wins)</p>
              </FlowNode>

              <FlowArrow label="Auction result" />

              <BranchRow
                left={
                  <>
                    <strong className="uppercase text-[10px] tracking-wide">Losers →</strong>
                    <br />
                    All 3 products back to Waiting Pool (budget ÷ 3 each)
                  </>
                }
                right={
                  <>
                    <strong className="uppercase text-[10px] tracking-wide">Top 3 winners →</strong>
                    <br />
                    Move to Queue (waiting for feed slot)
                  </>
                }
              />

              <FlowArrow label="Slot opens (max 3 live)" />

              <FlowNode
                icon={ListOrdered}
                stage="Step 5"
                title="Queue → Active"
                color="bg-yellow-100"
              >
                <p>Max <strong className="text-[#410F29]">3 ads live</strong> on Customer Feed</p>
                <p>Highest-bid queued ad auto-promotes when slot opens</p>
                <p>Runtime: <strong className="text-[#410F29]">1 hour</strong> (orchestrator every 30s)</p>
              </FlowNode>

              <FlowArrow />

              <FlowNode
                icon={Radio}
                stage="Step 6 · Live"
                title="Active on Customer Feed"
                color="bg-emerald-100"
                badge="Live"
              >
                <p>Sponsored combo ad shown at top of feed</p>
                <p>Seller sees per-product metrics in Active Campaigns</p>
              </FlowNode>

              <FlowArrow label="Customer clicks ad zone" />

              <FlowNode
                icon={MousePointerClick}
                stage="Step 7 · Attribution"
                title="Clicks & Budget"
                color="bg-[#F47216]/20"
              >
                <p><strong className="text-[#410F29]">₹2</strong> per click from shared Jodi budget</p>
                <p>Clicks tracked <strong className="text-[#410F29]">per product</strong> (Redis)</p>
                <p>Sales = demo formula (clicks × 0.12 × ₹80)</p>
              </FlowNode>

              <FlowArrow label="Budget ₹0 or 1 hour elapsed" />

              <FlowNode
                icon={RefreshCw}
                stage="Step 8 · End / loop"
                title="Expire · Exhaust · Withdraw"
                color="bg-white"
              >
                <p>Ad removed → remaining products return to <strong className="text-[#410F29]">Waiting Pool</strong></p>
                <p>Next queued ad promotes to Active</p>
                <p>
                  <strong className="text-[#410F29]">1 seller withdraws</strong> → Jodi split; other 2 go back to
                  waiting
                </p>
              </FlowNode>

              {/* Loop-back visual */}
              <div className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-[2px] border-dashed border-[#095955] bg-[#095955]/10">
                <RefreshCw className="h-4 w-4 text-[#095955] shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-wide text-[#095955] text-center">
                  Cycle repeats — products re-enter pool → matchmake → bid → queue → live
                </p>
              </div>
            </div>

            {/* Legend + demo note */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              <div className="flex items-start gap-2 p-3 rounded-xl border-2 border-[#F47216] bg-[#F47216]/10">
                <Zap className="h-4 w-4 text-[#F47216] shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-gray-700 leading-relaxed">
                  <strong className="uppercase text-[#410F29]">Demo shortcuts:</strong> Matchmaking &amp; bidding are
                  manual via Demo Console. Production can auto-run on schedule / when pool is ready.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl border-2 border-black bg-white">
                <Clock className="h-4 w-4 text-[#095955] shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-gray-700 leading-relaxed">
                  <strong className="uppercase text-[#410F29]">Timers:</strong> Orchestrator 30s · Ad runtime 1h · Max 3
                  active slots · Click cost ₹2
                </p>
              </div>
            </div>

            <div className="mt-4 max-w-xl mx-auto flex items-start gap-3 p-4 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Shield className="h-5 w-5 text-[#095955] shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-gray-700 leading-relaxed">
                Architecture mirrors production: gatekeeper → AI-scored trios → auction → capped feed → click
                attribution → budget lifecycle. Demo seeding &amp; manual controls keep the full loop testable in minutes.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 border-t-[4px] border-black bg-white px-6 py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border-[3px] border-black font-black uppercase tracking-wider text-white bg-[#095955] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
