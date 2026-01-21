
import React, { useState, useRef, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HazardCard } from './components/HazardCard';
import { analyzeHazards } from './services/geminiService';
import { AnalysisState, ErrorType } from './types';

// Fix: Adjusted declaration of window.aistudio to avoid modifier mismatch errors with environment-provided types.
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [mediaData, setMediaData] = useState<{ data: string; mimeType: string } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    loading: false,
    error: null,
    errorType: null,
    result: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  
  // Fix: Mandatory API Key selection state for Gemini 3 Pro models
  const [isApiKeySelected, setIsApiKeySelected] = useState<boolean>(true);

  // Camera Controls State
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [capabilities, setCapabilities] = useState<any | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Fix: Check for API key selection on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsApiKeySelected(hasKey);
        } catch (e) {
          console.error("Error checking API key:", e);
        }
      }
    };
    checkApiKey();
  }, []);

  // Fix: Function to trigger the API key selection dialog
  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success as per guidelines to mitigate race condition
      setIsApiKeySelected(true);
    }
  };

  useEffect(() => {
    if (hasStarted && mode === 'video' && !mediaData) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, mediaData, hasStarted]);

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setAnalysis(prev => ({ ...prev, error: null, errorType: null }));
    
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      };

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول للكاميرا. يرجى التأكد من استخدام متصفح حديث واتصال آمن HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setCameraLoading(false);
          } catch (e) {
            console.error("Auto-play failed:", e);
          }
        };
      }

      const track = stream.getVideoTracks()[0];
      setVideoTrack(track);

      if (track && (track as any).getCapabilities) {
        const caps = (track as any).getCapabilities();
        setCapabilities(caps);
        if (caps && caps.zoom) setZoomValue(caps.zoom.min || 1);
      }
    } catch (err: any) {
      setCameraLoading(false);
      let errorMessage = "فشل تشغيل الكاميرا. يرجى منح الصلاحيات واستخدام رابط HTTPS.";
      let type: ErrorType = 'UNKNOWN';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "تم رفض الوصول للكاميرا. يرجى تفعيل الصلاحية من إعدادات المتصفح.";
        type = 'CAMERA_DENIED';
      } else if (err.name === 'NotFoundError') {
        errorMessage = "لم يتم العثور على كاميرا في هذا الجهاز.";
        type = 'CAMERA_NOT_FOUND';
      }
      
      setAnalysis(prev => ({ ...prev, error: errorMessage, errorType: type }));
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setVideoTrack(null);
    setCapabilities(null);
    setIsTorchOn(false);
    setCameraLoading(false);
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setZoomValue(val);
    if (videoTrack && capabilities?.zoom) {
      try {
        await videoTrack.applyConstraints({ advanced: [{ zoom: val } as any] });
      } catch (err) { console.error("Zoom error", err); }
    }
  };

  const toggleTorch = async () => {
    if (videoTrack && capabilities?.torch) {
      const nextState = !isTorchOn;
      try {
        await videoTrack.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setIsTorchOn(nextState);
      } catch (err) { console.error("Torch error", err); }
    }
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(videoRef.current.srcObject as MediaStream);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => setMediaData({ data: reader.result as string, mimeType: 'video/webm' });
      reader.readAsDataURL(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setAnalysis({ loading: false, error: "يرجى اختيار صور أو فيديو فقط.", errorType: 'FILE_FORMAT', result: null });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaData({ data: reader.result as string, mimeType: file.type });
        setAnalysis({ loading: false, error: null, errorType: null, result: null });
        setHasStarted(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!mediaData) return;
    setAnalysis({ loading: true, error: null, errorType: null, result: null });
    try {
      const result = await analyzeHazards(mediaData.data, mediaData.mimeType);
      setAnalysis({ loading: false, error: null, errorType: null, result });
    } catch (err: any) {
      let errorMessage = err.message;
      // Fix: Handle ENTITY_NOT_FOUND error by prompting for API key selection again
      if (errorMessage === "ENTITY_NOT_FOUND") {
        setIsApiKeySelected(false);
        errorMessage = "المشروع أو مفتاح API غير صالح. يرجى اختيار مفتاح من مشروع مدفوع مفعل به نظام الفوترة.";
      }
      setAnalysis({ loading: false, error: errorMessage, errorType: 'AI_FAILED', result: null });
    }
  };

  const reset = () => {
    setMediaData(null);
    setAnalysis({ loading: false, error: null, errorType: null, result: null });
    setHasStarted(false);
  };

  // Fix: Show API key selection screen if no key is selected (Mandatory for Gemini 3 Pro)
  if (!isApiKeySelected) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-700">
          <div className="bg-yellow-500/10 p-6 rounded-[2.5rem] border border-yellow-500/20">
            <svg className="w-16 h-16 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div className="space-y-4 max-w-md">
            <h2 className="text-3xl font-black text-slate-900">إعداد مفتاح الوصول</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              يتطلب SafeVision استخدام مفتاح API من مشروع Google Cloud مفعل به نظام الفوترة (Paid Project) لضمان أفضل أداء ودقة في التحليل.
            </p>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block text-yellow-600 font-bold text-sm underline hover:text-amber-700 transition-colors"
            >
              تعرف على كيفية تفعيل الفوترة
            </a>
          </div>
          <button 
            onClick={handleOpenKeySelector}
            className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl hover:scale-105 active:scale-95"
          >
            اختيار مفتاح API للبدء
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-20 pb-32">
        
        {/* Landing Hero Section */}
        {!hasStarted ? (
          <section className="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-10 animate-in fade-in duration-1000">
            <div className="space-y-6 max-w-4xl">
              <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-600 px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest border border-yellow-500/20">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
                مستقبل السلامة المهنية الذكي
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1]">
                اجعل موقع العمل <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-600">أكثر أماناً بذكاء</span>
              </h1>
              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                SafeVision HSE هو نظامك المتطور لرصد المخاطر الميدانية لحظياً باستخدام الرؤية الحاسوبية، لحماية فريقك وضمان الالتزام بالمعايير العالمية.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
              <button 
                onClick={() => {setHasStarted(true); setMode('video');}}
                className="flex-1 bg-slate-900 text-white px-10 py-6 rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                ابدأ المسح المباشر
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white text-slate-900 px-10 py-6 rounded-[2rem] font-black text-xl border-2 border-slate-100 hover:border-yellow-400 transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                رفع صورة/فيديو
              </button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full pt-16">
              {[
                { title: 'تحليل فوري', desc: 'رصد المخاطر في أقل من ثوانٍ معدودة.', icon: '⚡' },
                { title: 'دقة عالية', desc: 'مدعوم بأحدث نماذج الذكاء الاصطناعي.', icon: '🎯' },
                { title: 'توصيات عملية', desc: 'خطط معالجة مبنية على معايير HSE.', icon: '📋' }
              ].map((f, i) => (
                <div key={i} className="p-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 text-right space-y-3">
                  <div className="text-4xl">{f.icon}</div>
                  <h3 className="font-black text-xl text-slate-900">{f.title}</h3>
                  <p className="text-slate-500 font-bold leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          /* Dashboard / Scanning View */
          <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
            <div className="flex items-center justify-between">
              <button onClick={reset} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                العودة للرئيسية
              </button>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button onClick={() => {setMode('image'); reset(); setHasStarted(true);}} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'image' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>صور</button>
                <button onClick={() => {setMode('video'); reset(); setHasStarted(true);}} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${mode === 'video' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>فيديو مباشر</button>
              </div>
            </div>

            <section className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="relative aspect-video md:aspect-[21/9] bg-slate-900 rounded-[2rem] overflow-hidden group">
                {!mediaData ? (
                  mode === 'image' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-20 h-20 bg-yellow-500 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-yellow-500/20 group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <h3 className="text-white text-2xl font-black mb-2">اختر صورة للمشهد</h3>
                      <p className="text-slate-400 font-bold">انقر للرفع أو اسحب الملف هنا</p>
                    </div>
                  ) : (
                    <div className="absolute inset-0">
                      {cameraLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 text-white">
                          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
                          <p className="font-bold tracking-widest uppercase text-xs">جاري تهيئة الكاميرا</p>
                        </div>
                      )}
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                      
                      {!cameraLoading && (
                        <div className="absolute inset-0 flex flex-col justify-between p-8 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 via-transparent to-black/40">
                          <div className="flex justify-between items-start">
                            {capabilities?.torch && (
                              <button onClick={toggleTorch} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isTorchOn ? 'bg-yellow-500 text-slate-900' : 'bg-white/10 text-white backdrop-blur-md hover:bg-white/20'}`}>
                                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM14.243 14.243a1 1 0 111.414 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707zM6.464 14.95a1 1 0 11-1.414-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707z" /></svg>
                              </button>
                            )}
                            {isRecording && <div className="bg-red-600 text-white px-6 py-2 rounded-2xl font-black flex items-center gap-3 animate-pulse"> <span className="w-2 h-2 bg-white rounded-full" /> {formatTime(recordingSeconds)} </div>}
                          </div>

                          <div className="flex flex-col items-center gap-8">
                            {capabilities?.zoom && (
                              <input type="range" min={capabilities.zoom.min} max={capabilities.zoom.max} step="0.1" value={zoomValue} onChange={handleZoomChange} className="w-full max-w-xs accent-yellow-500" />
                            )}
                            <button onClick={isRecording ? stopRecording : startRecording} className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center group/btn active:scale-95 transition-transform">
                              <div className={`transition-all duration-300 ${isRecording ? 'w-10 h-10 bg-white rounded-lg' : 'w-16 h-16 bg-red-600 rounded-full group-hover/btn:scale-110'}`} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 group/preview">
                    {mediaData.mimeType.startsWith('video') ? <video src={mediaData.data} controls className="w-full h-full object-contain" /> : <img src={mediaData.data} className="w-full h-full object-contain" />}
                    <button onClick={reset} className="absolute top-6 right-6 bg-red-600 text-white p-4 rounded-2xl shadow-2xl opacity-0 group-hover/preview:opacity-100 transition-opacity">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>

              {mediaData && !analysis.loading && !analysis.result && (
                <button onClick={runAnalysis} className="w-full mt-10 bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-900 py-6 rounded-[2rem] font-black text-2xl hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  تحليل المشهد الآن
                </button>
              )}

              {analysis.loading && (
                <div className="mt-10 py-16 text-center space-y-6">
                  <div className="w-20 h-20 border-8 border-slate-100 border-t-yellow-500 rounded-full animate-spin mx-auto" />
                  <h3 className="text-2xl font-black text-slate-900">جاري الكشف عن المخاطر...</h3>
                  <p className="text-slate-400 font-bold max-w-md mx-auto leading-relaxed">الذكاء الاصطناعي يقوم الآن بمسح العناصر ومقارنتها بمعايير السلامة المهنية المعتمدة</p>
                </div>
              )}
            </section>

            {analysis.result && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                   <div className="relative z-10 space-y-4">
                    <h3 className="text-yellow-500 font-black tracking-widest uppercase text-xs">الخلاصة الميدانية</h3>
                    <p className="text-2xl font-bold leading-relaxed">{analysis.result.overallSummary}</p>
                   </div>
                   <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {analysis.result.hazards.map((h, i) => <HazardCard key={i} hazard={h} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {analysis.error && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-[100]">
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl border border-white/10 flex items-start gap-4">
              <div className="bg-red-500 p-3 rounded-2xl shrink-0"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <div className="flex-grow space-y-4">
                <h4 className="font-black text-red-400">تنبيه النظام</h4>
                <p className="text-sm font-bold opacity-80">{analysis.error}</p>
                <div className="flex gap-4">
                  <button onClick={() => { if (analysis.errorType?.includes('CAMERA')) startCamera(); else runAnalysis(); }} className="px-6 py-2 bg-white text-slate-900 rounded-xl text-xs font-black">إعادة محاولة</button>
                  <button onClick={() => setAnalysis(p => ({...p, error: null}))} className="px-6 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-black">إغلاق</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
      </div>

      <style>{`
        body { background-color: #fcfcfd; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: #eab308; cursor: pointer; }
      `}</style>
    </Layout>
  );
};

export default App;
