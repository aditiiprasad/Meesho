import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Terminal, X } from 'lucide-react';
import SellerLogin from './pages/SellerLogin';
import CustomerLogin from './pages/CustomerLogin';
import SellerRegister from './pages/SellerRegister';
import CustomerRegister from './pages/CustomerRegister';
import SellerDashboard from './pages/SellerDashboard';
import CustomerFeed from './pages/CustomerFeed';

function Home() {
    return (
        <div className="min-h-screen flex flex-col bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] relative overflow-hidden font-sans">
            
            {/* Header */}
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
                <div className="flex gap-4">
                    <a href="https://github.com" target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-[#F47216] text-[#410F29] font-black uppercase tracking-wider rounded-xl border-2 border-transparent hover:border-[#F8F6F0] transition-all">GITHUB</a>
                    <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-[#095955] text-[#F8F6F0] font-black uppercase tracking-wider rounded-xl border-2 border-transparent hover:border-[#F47216] transition-all">LINKEDIN</a>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-grow flex flex-col items-center justify-center p-4 py-12 md:py-16 z-10 relative">
                <div className="w-full max-w-2xl bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-3xl overflow-hidden p-8 md:p-12 text-center flex flex-col items-center justify-center transition-all">
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

            {/* Footer */}
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

import { Activity, ShieldCheck, Zap, Image as ImageIcon, Gavel, MousePointerClick, Network, Brain, LineChart, Layers, AlertTriangle } from 'lucide-react';

function BackendLogs() {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activeStep, setActiveStep] = useState(0);
    const [selectedStep, setSelectedStep] = useState(null);
    const logsEndRef = useRef(null);

    const [activeTab, setActiveTab] = useState('logs');
    const [poolStatus, setPoolStatus] = useState({ waiting_pool: [], active_ads: [], queued_ads: [] });

    const fetchPoolStatus = async () => {
        try {
            const url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
            const res = await fetch(`${url}/api/pool/status`);
            if (res.ok) {
                const data = await res.json();
                setPoolStatus(data);
            }
        } catch (e) {
            console.error("Failed to fetch pool status", e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchPoolStatus();
        }
    }, [isOpen]);

    useEffect(() => {
        const url = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/logs/stream` : 'http://127.0.0.1:8000/api/logs/stream';
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            const msg = event.data;
            setLogs((prev) => [...prev, msg]);

            if (msg.includes("[Gatekeeper]")) setActiveStep(1);
            else if (msg.includes("[Category Graph]") || msg.includes("[Semantic Jodi Maker]") || msg.includes("[Optimization Engine]") || msg.includes("[Jodi Maker]")) setActiveStep(2);
            else if (msg.includes("[Creative Compositor]")) setActiveStep(3);
            else if (msg.includes("[Bidder]")) setActiveStep(4);
            else if (msg.includes("[Safety Layer]") || msg.includes("[Attribution]") || msg.includes("[System]")) setActiveStep(5);

            if (msg.includes("[System]") || msg.includes("[Matchmaker]") || msg.includes("[Gatekeeper]") || msg.includes("[Attribution]")) {
                fetchPoolStatus();
            }
        };

        return () => eventSource.close();
    }, []);

    useEffect(() => {
        if (isOpen && logsEndRef.current && selectedStep === null) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen, selectedStep]);

    const steps = [
        { id: 1, name: 'Gatekeeper', icon: ShieldCheck, tags: ['[Gatekeeper]'] },
        { id: 2, name: 'Jodi Maker', icon: Brain, tags: ['[Category Graph]', '[Semantic Jodi Maker]', '[Optimization Engine]', '[Jodi Maker]'] },
        { id: 3, name: 'Ad Maker', icon: ImageIcon, tags: ['[Creative Compositor]'] },
        { id: 4, name: 'Bidding', icon: Gavel, tags: ['[Bidder]'] },
        { id: 5, name: 'Publish', icon: Activity, tags: ['[Safety Layer]', '[Attribution]', '[System]'] }
    ];

    const renderRichLog = (text) => {
        let result = text;
        if (result.includes("Fitness Score:")) {
            result = result.replace(/Fitness Score: ([\d.]+)/g, '<span class="bg-[#F47216]/15 text-[#d96213] font-extrabold px-2 py-0.5 rounded-md border border-[#F47216]/40">Fitness Score: $1</span>');
        }
        if (result.includes("Budget variance: Low")) {
            result = result.replace(/Budget variance: Low/g, '<span class="text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">Budget variance: Low</span>');
        }
        if (result.includes("Budget variance: Medium")) {
            result = result.replace(/Budget variance: Medium/g, '<span class="text-amber-600 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">Budget variance: Medium</span>');
        }
        if (result.includes("Budget variance: High")) {
            result = result.replace(/Budget variance: High/g, '<span class="text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">Budget variance: High</span>');
        }
        if (result.includes("SUCCESS!")) {
            result = result.replace(/SUCCESS!/g, '<span class="bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-md border-2 border-emerald-400">SUCCESS!</span>');
        }
        if (result.includes("FAILED")) {
            result = result.replace(/FAILED\./g, '<span class="bg-rose-100 text-rose-700 font-black px-2 py-0.5 rounded-md border-2 border-rose-400">FAILED.</span>');
        }
        if (result.includes("Rs.")) {
            result = result.replace(/Rs\.([\d.]+)/g, '<span class="font-extrabold text-[#095955]">₹$1</span>');
        }
        return <div dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const filteredLogs = selectedStep 
        ? logs.filter(log => steps.find(s => s.id === selectedStep)?.tags.some(tag => log.includes(tag)))
        : logs;

    return (
        <div className="">
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 p-4 bg-[#F47216] text-[#410F29] rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 group"
            >
                <Activity className="h-6 w-6 animate-pulse" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-sm font-bold px-1">
                    Agentic Pipeline Live View
                </span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#410F29]/80 backdrop-blur-md p-4 sm:p-6">
                    <div className="bg-[#F8F6F0] w-full max-w-6xl rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden border-[4px] border-black flex flex-col h-[85vh]">
                        <div className="bg-[#410F29] p-5 flex justify-between items-center border-b-[4px] border-black shadow-sm z-20">
                            <div className="flex items-center gap-3 text-[#F47216] text-2xl font-bold tracking-tight">
                                <Activity className="h-7 w-7 text-[#F8F6F0]" />
                                Ad Ne Bana Di Jodi AI Orchestration Live
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-xl font-bold transition-all border-2 border-transparent ${activeTab === 'logs' ? 'bg-[#F47216] text-[#410F29]' : 'bg-[#F8F6F0]/20 text-[#F8F6F0] hover:border-[#F47216]'}`}>
                                    Live Logs
                                </button>
                                <button onClick={() => { setActiveTab('visualise'); fetchPoolStatus(); }} className={`px-4 py-2 rounded-xl font-bold transition-all border-2 border-transparent ${activeTab === 'visualise' ? 'bg-[#F47216] text-[#410F29]' : 'bg-[#F8F6F0]/20 text-[#F8F6F0] hover:border-[#F47216]'}`}>
                                    Visualise
                                </button>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-[#F8F6F0] hover:text-[#F47216] p-2 rounded-xl border-[2px] border-transparent hover:border-[#F47216] hover:bg-[#F47216]/20 transition-all">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {activeTab === 'logs' ? (
                            <div className="flex flex-1 overflow-hidden">
                                {/* Left Side: Pipeline Visualization */}
                            <div className="w-1/3 border-r-[4px] border-black bg-gradient-to-b from-[#410F29] to-[#2A0A1A] p-8 overflow-y-auto hidden md:block relative scrollbar-hide">
                                <div className="absolute left-[47px] top-12 bottom-12 w-1.5 bg-[#095955]/40 z-0 rounded-full"></div>
                                <div className="space-y-4 relative z-10 py-4">
                                    <div 
                                        onClick={() => setSelectedStep(null)}
                                        className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-300 border-[2px] ${selectedStep === null ? 'bg-black/40 border-[#F47216] text-[#F47216]' : 'border-transparent text-white hover:bg-black/20'}`}
                                    >
                                        <Layers className="h-5 w-5" />
                                        <span className="font-bold text-lg">View All Logs</span>
                                    </div>
                                    <div className="h-4"></div>
                                    {steps.map((step) => {
                                        const isActive = activeStep === step.id;
                                        const isPassed = activeStep > step.id;
                                        const isSelected = selectedStep === step.id;

                                        return (
                                            <div 
                                                key={step.id} 
                                                onClick={() => setSelectedStep(isSelected ? null : step.id)}
                                                className={`flex items-start gap-5 cursor-pointer p-3 rounded-2xl transition-all duration-300 border-[2px] ${isSelected ? 'bg-black/30 border-[#F47216]' : 'border-transparent hover:bg-black/10'}`}
                                            >
                                                <div className={`w-12 h-12 rounded-xl border-[3px] border-black flex items-center justify-center flex-shrink-0 transition-all duration-500
                                                    ${isActive && !isSelected ? 'bg-[#F47216] text-[#410F29] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] scale-110' :
                                                    isSelected ? 'bg-[#F47216] text-[#410F29] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' :
                                                    isPassed ? 'bg-[#095955] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-[#F8F6F0]/20 text-[#F8F6F0]/40 border-[#F8F6F0]/20'}`}>
                                                    <step.icon className={`h-5 w-5 ${isActive && !isSelected ? 'animate-pulse' : ''}`} />
                                                </div>
                                                <div className="pt-2">
                                                    <h4 className={`font-bold transition-colors duration-300 text-lg tracking-tight ${isSelected || isActive ? 'text-[#F47216]' : isPassed ? 'text-white' : 'text-[#F8F6F0]/40'}`}>
                                                        {step.name}
                                                    </h4>
                                                    {isActive && <div className="text-xs text-[#F47216]/80 mt-1 font-semibold flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#F47216] animate-ping"></div>
                                                        Processing...
                                                    </div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Side: Log Stream Cards */}
                            <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                                <div className="space-y-4 max-w-3xl mx-auto">
                                    {filteredLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-[#095955]/40 py-32">
                                            <Activity className="h-20 w-20 mb-6 opacity-30 animate-pulse" />
                                            <p className="text-xl font-medium text-[#095955]/60">Awaiting {selectedStep ? steps.find(s=>s.id === selectedStep)?.name : 'orchestration'} events...</p>
                                        </div>
                                    ) : (
                                        filteredLogs.map((log, i) => {
                                            let matchedStep = steps.find(s => s.tags.some(t => log.includes(t)));
                                            let cleanLog = log;
                                            if (matchedStep) {
                                                matchedStep.tags.forEach(t => {
                                                    cleanLog = cleanLog.replace(t, '').trim();
                                                });
                                            }

                                            return (
                                                <div key={i} className="p-5 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex flex-col md:flex-row items-start gap-4 animate-fade-in-up hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                                                    {matchedStep && (
                                                        <div className="bg-[#410F29] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest shrink-0 mt-0.5 shadow-sm border border-black/10">
                                                            {matchedStep.name}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 text-[15px] text-gray-800 font-medium leading-relaxed break-words pt-0.5">
                                                        {renderRichLog(cleanLog)}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        </div>
                        ) : (
                            <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#F8F6F0] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 h-full max-w-7xl mx-auto">
                                    <div className="bg-white flex flex-col p-5 md:p-6 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <h3 className="text-xl font-black text-[#410F29] mb-4 border-b-[3px] border-black pb-3 uppercase tracking-tight flex items-center justify-between">
                                            <span>Waiting Pool</span>
                                            <span className="bg-[#410F29] text-white px-3 py-1 rounded-full text-sm">{poolStatus.waiting_pool?.length || 0}</span>
                                        </h3>
                                        <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                            {poolStatus.waiting_pool?.map(p => (
                                                <div key={p.id} className="p-3 bg-[#F8F6F0] border-2 border-black rounded-xl text-sm font-semibold flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                                    {p.image_url ? <img src={p.image_url.startsWith('http') ? p.image_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${p.image_url}`} alt="" className="w-12 h-12 object-cover rounded-lg border-[2px] border-black flex-shrink-0" /> : <div className="w-12 h-12 bg-gray-200 border-[2px] border-black rounded-lg flex-shrink-0" />}
                                                    <div className="min-w-0">
                                                        <div className="text-[#410F29] truncate">{p.title}</div>
                                                        <div className="text-[#095955] font-black mt-0.5">₹{p.price}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!poolStatus.waiting_pool || poolStatus.waiting_pool.length === 0) && (
                                                <div className="text-center p-8 text-gray-400 font-medium border-2 border-dashed border-gray-300 rounded-xl">Pool is empty</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white flex flex-col p-5 md:p-6 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <h3 className="text-xl font-black text-[#F47216] mb-4 border-b-[3px] border-black pb-3 uppercase tracking-tight flex items-center justify-between">
                                            <span>Queued Ads</span>
                                            <span className="bg-[#F47216] text-white px-3 py-1 rounded-full text-sm">{poolStatus.queued_ads?.length || 0}</span>
                                        </h3>
                                        <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                            {poolStatus.queued_ads?.map(ad => (
                                                <div key={ad.id} className="p-3 bg-orange-50 border-2 border-black rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="text-[#410F29]">Ad #{ad.id}</div>
                                                        <div className="text-[#F47216] font-black">₹{ad.total_budget}</div>
                                                    </div>
                                                    {ad.image_url && <img src={ad.image_url.startsWith('http') ? ad.image_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${ad.image_url}`} alt="" className="w-full h-24 object-cover rounded-lg border-[2px] border-black" />}
                                                </div>
                                            ))}
                                            {(!poolStatus.queued_ads || poolStatus.queued_ads.length === 0) && (
                                                <div className="text-center p-8 text-gray-400 font-medium border-2 border-dashed border-gray-300 rounded-xl">No queued ads</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#095955]/10 flex flex-col p-5 md:p-6 rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                                        <h3 className="text-xl font-black text-[#095955] mb-4 border-b-[3px] border-black pb-3 uppercase tracking-tight flex items-center justify-between relative z-10">
                                            <span>Active Ads</span>
                                            <span className="bg-[#095955] text-white px-3 py-1 rounded-full text-sm">{poolStatus.active_ads?.length || 0}</span>
                                        </h3>
                                        <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar relative z-10">
                                            {poolStatus.active_ads?.map(ad => (
                                                <div key={ad.id} className="p-3 bg-white border-2 border-black rounded-xl text-sm font-semibold shadow-sm hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="text-[#410F29] flex items-center gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                            Ad #{ad.id}
                                                        </div>
                                                        <div className="text-[#095955] font-black">₹{ad.total_budget}</div>
                                                    </div>
                                                    {ad.image_url && <img src={ad.image_url.startsWith('http') ? ad.image_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${ad.image_url}`} alt="" className="w-full h-24 object-cover rounded-lg border-[2px] border-black" />}
                                                </div>
                                            ))}
                                            {(!poolStatus.active_ads || poolStatus.active_ads.length === 0) && (
                                                <div className="text-center p-8 text-gray-400 font-medium border-2 border-dashed border-gray-400 rounded-xl bg-white/50">No active ads</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function App() {
    return (
        <Router>
            <BackendLogs />
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
