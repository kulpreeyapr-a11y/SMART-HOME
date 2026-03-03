"use client";
import React, { useState, useEffect, useMemo } from 'react';
import mqtt from 'mqtt';
import {
    Lightbulb, Wind, Activity, History, Clock,
    LayoutDashboard, Mic, MicOff, BarChart3,
    ShieldAlert, ShieldCheck, TrendingUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie // เพิ่ม PieChart และ Pie
} from 'recharts';

const monthlyCostData = [
    { month: 'Dec/ธ.ค.', cost: 520 },
    { month: 'Jan/ม.ค.', cost: 585 },
    { month: 'Feb/ก.พ.', cost: 608 },
];

// เพิ่มโทนสีสำหรับอุปกรณ์ต่างๆ
const COLORS = ['#FFFFFF', '#EF4444', '#F87171', '#3B82F6', '#A855F7', '#EA580C'];

const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-blue-500/50 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{payload[0].payload.month}</p>
                <p className="text-sm font-black text-yellow-400">฿ {payload[0].value.toLocaleString()}</p>
                <p className="text-[9px] text-blue-400 font-bold uppercase italic">Monthly Usage</p>
            </div>
        );
    }
    return null;
};

export default function SmartHomeFinal() {
    const [led1, setLed1] = useState(false);
    const [led2, setLed2] = useState(false);
    const [led3, setLed3] = useState(false);
    const [led4, setLed4] = useState(false);
    const [fan, setFan] = useState(false);
    const [soundActive, setSoundActive] = useState(false);
    const [isNoisy, setIsNoisy] = useState(false);
    const [time, setTime] = useState(new Date());
    const [intruder, setIntruder] = useState(false);
    const [isSecurityOn, setIsSecurityOn] = useState(false);

    const [temp, setTemp] = useState(0);
    const [humi, setHumi] = useState(0);
    const [units, setUnits] = useState(145.51);
    const [cost, setCost] = useState(608.50);
    const [client, setClient] = useState<any>(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // คำนวณ Device Share สำหรับ UI
    const devicePieData = useMemo(() => [
        { name: 'Door Light', value: led1 ? 0.00005 : 0 },
        { name: 'Left Light', value: led2 ? 0.00005 : 0 },
        { name: 'Right Light', value: led3 ? 0.00005 : 0 },
        { name: 'Fan', value: fan ? 0.00015 : 0 },
    ].filter(item => item.value > 0), [led1, led2, led3, fan]);

    const topDevice = useMemo(() => {
        if (devicePieData.length === 0) return "Standby";
        return [...devicePieData].sort((a, b) => b.value - a.value)[0].name;
    }, [devicePieData]);

    // การเชื่อมต่อ MQTT
    useEffect(() => {
        const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
        mqttClient.on('connect', () => {
            console.log("MQTT Connected");
            mqttClient.subscribe(['home/temp', 'home/humi', 'home/security', 'home/sound_status']);
        });

        mqttClient.on('message', (topic, message) => {
            const val = message.toString();
            if (topic === 'home/temp') setTemp(parseFloat(val));
            if (topic === 'home/humi') setHumi(parseFloat(val));
            if (topic === 'home/sound_status') setIsNoisy(val === 'DETECTED');
            if (topic === 'home/security' && val === 'ALERT') {
                setIntruder(true);
                setLed4(true);
                setTimeout(() => {
                    setIntruder(false);
                    setLed4(false);
                }, 5000);
            }
        });
        setClient(mqttClient);
        return () => { if (mqttClient) mqttClient.end(); };
    }, []);

    const toggleDevice = (topic: string, state: boolean, setter: Function) => {
        const newState = !state;
        setter(newState);
        if (client) {
            client.publish(topic, newState ? 'ON' : 'OFF');
        }
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (led1 || led2 || led3 || led4 || fan) {
            timer = setInterval(() => {
                setUnits((prev) => {
                    const consumption = (led1 ? 0.00005 : 0) + (led2 ? 0.00005 : 0) + (led3 ? 0.00005 : 0) + (led4 ? 0.00008 : 0) + (fan ? 0.00015 : 0);
                    const nextUnits = prev + consumption;
                    setCost(nextUnits * 4.18);
                    return nextUnits;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [led1, led2, led3, led4, fan]);

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 p-4 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            <LayoutDashboard size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl lg:text-2xl font-black italic uppercase bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent leading-tight">
                                Smart Home System
                            </h1>
                            <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] tracking-widest uppercase mt-1">
                                <span className="flex items-center gap-1"><Activity size={12} className="text-green-500 animate-pulse" /> Live</span>
                                <span suppressHydrationWarning className="flex items-center gap-1"><Clock size={12} /> {time.toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 flex items-center gap-6 shadow-xl">
                        <div className="text-right border-r border-white/10 pr-6">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Units</p>
                            <p className="text-xl font-black text-blue-400 tabular-nums">{units.toFixed(4)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Cost</p>
                            <p className="text-xl font-black text-yellow-400 tabular-nums">฿ {cost.toFixed(2)}</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sensors */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
                        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-orange-400 uppercase">Temp</span>
                                <span className="text-[12px] font-bold text-slate-500">อุณหภูมิ</span>
                            </div>
                            <span className="text-2xl font-black">{temp.toFixed(1)}°C</span>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase">Humi</span>
                                <span className="text-[12px] font-bold text-slate-500">ความชื้น</span>
                            </div>
                            <span className="text-2xl font-black">{humi.toFixed(1)}%</span>
                        </div>

                        <div
                            onClick={() => toggleDevice('home/security_mode', isSecurityOn, setIsSecurityOn)}
                            className={`p-5 rounded-3xl border cursor-pointer transition-all duration-500 flex items-center justify-between ${isSecurityOn ? (intruder ? 'bg-red-600 animate-bounce' : 'bg-green-600/20 border-green-500') : 'bg-white/5 border-white/10 opacity-50'}`}
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase">Security Mode</span>
                                <span className="text-[12px] font-bold">{isSecurityOn ? 'ระบบเปิดอยู่' : 'ระบบปิดอยู่'}</span>
                            </div>
                            {intruder ? <ShieldAlert className="text-white" /> : <ShieldCheck className={isSecurityOn ? "text-green-500" : "text-slate-500"} />}
                        </div>

                        <div className={`p-5 rounded-3xl border transition-all duration-500 flex items-center justify-between ${soundActive ? (isNoisy ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-green-500/10 border-green-500/50') : 'bg-white/5 border-white/10 opacity-50'}`}>
                            <div className="flex flex-col italic">
                                <span className="text-[10px] font-bold uppercase">Sound Detection</span>
                                <span className="text-[12px] font-bold">ตรวจจับเสียง</span>
                            </div>
                            {soundActive ? (isNoisy ? <Mic className="text-red-500" /> : <Mic className="text-green-500" />) : <MicOff className="text-slate-500" />}
                        </div>
                    </div>

                    {/* Middle: House View */}
                    <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
                        <div className="bg-slate-900 border border-white/10 rounded-[3rem] p-4 relative flex items-center justify-center min-h-[420px] shadow-2xl overflow-hidden group">
                            <div className="relative w-full max-w-lg">
                                <div className={`absolute inset-0 transition-opacity duration-1000 blur-[100px] opacity-20 ${led1 ? 'bg-white' : (led2 || led3) ? 'bg-red-500' : 'bg-transparent'}`}></div>

                                <img src="/house-model.jpg" className={`w-full h-auto rounded-xl transition-all duration-1000 ${led1 || led2 || led3 ? 'brightness-110' : 'brightness-50 grayscale'}`} alt="House" />

                                <div onClick={() => toggleDevice('home/led1', led1, setLed1)} className={`absolute top-[43.5%] left-[53.2%] cursor-pointer p-2 rounded-full border-2 transition-all ${led1 ? 'bg-white border-blue-200 scale-125 shadow-[0_0_25px_white]' : 'bg-black/40 border-white/20'}`}>
                                    <Lightbulb size={16} className={led1 ? 'text-blue-600' : 'text-slate-400'} />
                                </div>

                                <div onClick={() => toggleDevice('home/led2', led2, setLed2)} className={`absolute top-[43.5%] left-[43.2%] cursor-pointer p-2 rounded-full border-2 transition-all ${led2 ? 'bg-red-500 border-white scale-125 shadow-[0_0_25px_red]' : 'bg-black/40 border-red-500/50'}`}>
                                    <Lightbulb size={16} className="text-white" />
                                </div>

                                <div onClick={() => toggleDevice('home/led3', led3, setLed3)} className={`absolute top-[43.5%] left-[63.2%] cursor-pointer p-2 rounded-full border-2 transition-all ${led3 ? 'bg-red-500 border-white scale-125 shadow-[0_0_25px_red]' : 'bg-black/40 border-red-500/50'}`}>
                                    <Lightbulb size={16} className="text-white" />
                                </div>

                                <div onClick={() => toggleDevice('home/fan', fan, setFan)} className={`absolute top-[30.5%] right-[8.5%] cursor-pointer w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all ${fan ? 'bg-blue-500 border-white animate-spin-slow shadow-[0_0_20px_#3b82f6]' : 'bg-black/80 border-white/20'}`}>
                                    <Wind size={24} className="text-white" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            {[
                                { id: led1, s: setLed1, t: 'home/led1', l: 'Door', th: 'ไฟประตู', active: 'bg-white text-black' },
                                { id: led2, s: setLed2, t: 'home/led2', l: 'Left', th: 'ไฟซ้าย', active: 'bg-red-600 text-white' },
                                { id: led3, s: setLed3, t: 'home/led3', l: 'Right', th: 'ไฟขวา', active: 'bg-red-600 text-white' },
                                { id: fan, s: setFan, t: 'home/fan', l: 'Fan', th: 'พัดลม', active: 'bg-blue-600 text-white' },
                                { id: soundActive, s: setSoundActive, t: 'home/sound_sensor', l: 'Sound', th: 'ตรวจเสียง', active: 'bg-purple-600 text-white' },
                                { id: isSecurityOn, s: setIsSecurityOn, t: 'home/security_mode', l: 'Security', th: 'กันขโมย', active: 'bg-orange-600 text-white' }
                            ].map((b, i) => (
                                <button key={i} onClick={() => toggleDevice(b.t, b.id, b.s)} className={`p-3 rounded-2xl border transition-all transform active:scale-95 flex flex-col items-center ${b.id ? b.active : 'bg-white/5 border-white/10 opacity-60'}`}>
                                    <p className="text-[9px] font-black uppercase">{b.l}</p>
                                    <p className="text-[10px] font-bold">{b.th}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: History & Device Share */}
                    <div className="col-span-12 lg:col-span-3 space-y-6">

                        {/* ส่วนที่เพิ่มใหม่: กราฟวงกลม Energy Share */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] shadow-lg">
                            <h3 className="text-[10px] font-black uppercase text-slate-300 mb-4 flex items-center gap-2 italic">
                                <TrendingUp size={16} className="text-green-400" /> Device Energy Share
                            </h3>
                            <div className="h-40 relative">
                                {devicePieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={devicePieData}
                                                innerRadius={45}
                                                outerRadius={60}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {devicePieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '10px', fontSize: '10px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-500 text-[10px] uppercase font-bold">
                                        Standby Mode
                                    </div>
                                )}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Active</span>
                                    <span className="text-[10px] font-black text-blue-400">{devicePieData.length}</span>
                                </div>
                            </div>
                            <div className="mt-2 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Highest: {topDevice}</p>
                            </div>
                        </div>

                        {/* กราฟแท่งเดิม */}
                        <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] h-64 shadow-lg">
                            <h3 className="text-[10px] font-black uppercase text-slate-300 mb-6 flex items-center gap-2 italic">
                                <History size={16} className="text-blue-400" /> Usage History
                            </h3>
                            <ResponsiveContainer width="100%" height="70%">
                                <BarChart data={monthlyCostData}>
                                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#ffffff05' }} />
                                    <Bar dataKey="cost" radius={[4, 4, 4, 4]} barSize={25}>
                                        {monthlyCostData.map((e, i) => <Cell key={i} fill={i === 2 ? '#3b82f6' : '#1e293b'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}