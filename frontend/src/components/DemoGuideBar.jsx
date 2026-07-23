import { useState } from 'react';
import { HelpCircle, BookOpen } from 'lucide-react';
import DemoGuideModal from './DemoGuideModal';
import DemoRulesModal from './DemoRulesModal';

function SidePanelButton({ onClick, icon: Icon, label, sublabel, variant, badge }) {
  const isGuide = variant === 'guide';
  return (
    <div className="relative flex-1 min-w-0">
      {badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            isGuide ? 'bg-[#F47216] text-[#410F29]' : 'bg-[#095955] text-white'
          }`}
        >
          {badge}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`
          w-full flex flex-col items-center justify-center gap-2
          px-3 sm:px-4 py-4 sm:py-5 pt-5 sm:pt-6 rounded-2xl border-[3px] border-black
          active:scale-[0.98]
          transition-[background-color] text-center
          ${isGuide ? 'bg-[#F47216] text-[#410F29] demo-guide-btn-blink' : 'bg-white text-[#410F29] demo-rules-btn-blink'}
        `}
      >
        <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${isGuide ? 'text-[#410F29]' : 'text-[#095955]'}`} />
        <span className="text-xs sm:text-sm font-black uppercase tracking-tight leading-tight">{label}</span>
        {sublabel && (
          <span className={`text-[10px] font-bold uppercase tracking-wider leading-snug ${isGuide ? 'text-[#410F29]/80' : 'text-gray-500'}`}>
            {sublabel}
          </span>
        )}
      </button>
    </div>
  );
}

export default function DemoGuideBar({ className = '', compact = false }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <div className={`flex w-full gap-3 sm:gap-4 justify-center max-w-2xl mx-auto ${className}`}>
        <SidePanelButton
          onClick={() => setGuideOpen(true)}
          icon={HelpCircle}
          label={compact ? 'How to Use' : 'How to Test Demo'}
          sublabel="Judge walkthrough"
          variant="guide"
          badge={compact ? 'Guide' : 'Start here ↓'}
        />
        <SidePanelButton
          onClick={() => setRulesOpen(true)}
          icon={BookOpen}
          label={compact ? 'What Is Happening' : 'What Actually Happens'}
          sublabel="Rules & pipeline"
          variant="rules"
          badge="System flow"
        />
      </div>
      <DemoGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <DemoRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}
