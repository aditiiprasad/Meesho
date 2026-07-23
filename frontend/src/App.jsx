import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { HelpCircle, BookOpen } from 'lucide-react';
import SellerLogin from './pages/SellerLogin';
import CustomerLogin from './pages/CustomerLogin';
import SellerRegister from './pages/SellerRegister';
import CustomerRegister from './pages/CustomerRegister';
import SellerDashboard from './pages/SellerDashboard';
import CustomerFeed from './pages/CustomerFeed';
import DemoConsole from './components/DemoConsole';
import DemoGuideModal from './components/DemoGuideModal';
import DemoRulesModal from './components/DemoRulesModal';

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

function Home() {
    const [guideOpen, setGuideOpen] = useState(false);
    const [rulesOpen, setRulesOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] relative overflow-hidden font-sans">
            
            <header className="relative z-50 mt-4 mx-4 md:mt-8 md:mx-12 bg-[#410F29] border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
                <div className="flex flex-col items-center md:items-start">
                    <div className="flex flex-wrap items-baseline gap-2 justify-center md:justify-start">
                        <span className="text-3xl md:text-4xl text-[#F8F6F0] font-black tracking-tighter uppercase">meesho</span>
                        <span className="text-xl md:text-2xl text-[#F47216] font-bold tracking-tight">AD NE BANA DI JODI</span>
                    </div>
                    <div className="mt-1 text-sm md:text-base font-black tracking-wider uppercase">
                        <span className="text-[#095955] bg-white px-2 py-0.5 rounded border-2 border-black mr-2">ScriptedBy</span>
                        <span className="text-[#F8F6F0]">{'{}'}Her{'}'}</span>
                        <span className="text-[#F47216] ml-1.5 border-b-2 border-[#F47216]">2.0</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
                    <a href="https://github.com/aditiiprasad/Meesho" target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-[#F8F6F0] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-2 border-[#F8F6F0] hover:bg-white transition-all">REPOSITORY</a>
                    <a href="https://github.com/aditiiprasad" target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-[#F47216] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-2 border-transparent hover:border-[#F8F6F0] transition-all">GITHUB</a>
                    <a href="https://linkedin.com/in/aditiiprasad" target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-[#095955] text-[#F8F6F0] font-black uppercase tracking-wider rounded-xl border-2 border-transparent hover:border-[#F8F6F0] transition-all">LINKEDIN</a>
                </div>
            </header>

            <main className="flex-grow flex flex-col items-center justify-center p-4 py-8 md:py-12 z-10 relative w-full max-w-2xl mx-auto">
                <div className="flex w-full gap-3 sm:gap-4 mb-6 justify-center pt-2">
                    <SidePanelButton
                        onClick={() => setGuideOpen(true)}
                        icon={HelpCircle}
                        label="How to Test Demo"
                        sublabel="Judge walkthrough"
                        variant="guide"
                        badge="Start here ↓"
                    />
                    <SidePanelButton
                        onClick={() => setRulesOpen(true)}
                        icon={BookOpen}
                        label="What Actually Happens"
                        sublabel="Rules & pipeline"
                        variant="rules"
                        badge="System flow"
                    />
                </div>

                <div className="w-full bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-3xl overflow-hidden p-8 md:p-12 text-center flex flex-col items-center justify-center transition-all">
                        <h2 className="text-4xl md:text-6xl leading-none mb-8 font-black uppercase tracking-tighter flex flex-col gap-3">
                            <span className="text-[#410F29]">WELCOME TO</span>
                            <span className="text-[#095955] bg-[#095955]/10 py-2 border-y-4 border-black border-dashed">AD NE BANA DI JODI</span>
                            <span className="text-[#410F29]">FOR <span className="text-[#F47216]">MEESHO</span></span>
                        </h2>
                        <p className="text-[#410F29] mb-10 text-xl font-bold leading-relaxed max-w-lg">
                            THE AGENTIC JODI MAKER, POOLING MICRO-BUDGETS TO WIN PREMIUM AD SPACE.
                        </p>

                        <div className="space-y-4 w-full max-w-md">
                            <Link to="/customer-login" className="block w-full py-4 px-4 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl font-black uppercase tracking-wider text-[#410F29] bg-[#F47216] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
                                LOGIN AS CUSTOMER
                            </Link>
                            <Link to="/seller-login" className="block w-full py-4 px-4 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl font-black uppercase tracking-wider text-white bg-[#095955] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
                                LOGIN AS SELLER
                            </Link>
                        </div>
                    </div>
            </main>

            <DemoGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
            <DemoRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

            <footer className="relative z-10 w-full bg-[#095955] border-t border-white/10 p-6 md:p-10 text-center flex flex-col items-center justify-center">
                <div className="max-w-4xl space-y-3">
                    <p className="text-white/90 text-sm md:text-base font-medium leading-relaxed">
                        <strong className="font-bold text-[#F47216]">Ad Ne Bana Di Jodi</strong> is an agentic platform that empowers small sellers on Meesho by pooling their micro-budgets to collaboratively win premium ad spaces.
                    </p>
                    <p className="text-white/60 text-xs md:text-sm font-semibold uppercase tracking-widest mt-4">
                        © {new Date().getFullYear()} Meesho - Scripted By Her. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function App() {
    return (
        <Router>
            <DemoConsole />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/seller-login" element={<SellerLogin />} />
                <Route path="/customer-login" element={<CustomerLogin />} />
                <Route path="/seller-register" element={<SellerRegister />} />
                <Route path="/customer-register" element={<CustomerRegister />} />
                <Route path="/seller-dashboard" element={<SellerDashboard />} />
                <Route path="/customer-feed" element={<CustomerFeed />} />
            </Routes>
        </Router>
    );
}

export default App;
