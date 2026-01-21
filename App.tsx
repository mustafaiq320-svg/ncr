
import React, { useState, useRef, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HazardCard } from './components/HazardCard';
import { analyzeHazards } from './services/geminiService';
import { AnalysisState, ErrorType } from './types';

const App: React.FC = () => {
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
  
  // Camera Controls State
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  // Using any to support non-standard capabilities like zoom and torch which are not in standard MediaTrackCapabilities
  const [capabilities, setCapabilities] = useState<any | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === 'video' && !mediaData) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, mediaData]);

  // Handle Recording Timer
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: true 
      });
      
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const track = stream.getVideoTracks()[0];
      setVideoTrack(track);
      
      // Check for capabilities (Zoom/Torch)
      // Casting track to any as getCapabilities is not always present in standard type definitions
      if (track && (track as any).getCapabilities) {
        const caps = (track as any).getCapabilities();
        setCapabilities(caps);
        if (caps && caps.zoom) setZoomValue(caps.zoom.min || 1);
      }
      
      setAnalysis(prev => ({ ...prev, error: null, errorType: null }));
    } catch (err: any) {
      let errorMessage = "حدث خطأ عند تشغيل الكاميرا.";
      let type: ErrorType = 'UNKNOWN';
      if (err.name === 'NotAllowedError') {
        errorMessage = "تم رفض الوصول للكاميرا. يرجى تفعيل الصلاحيات للمتابعة.";
        type = 'CAMERA_DENIED';
      } else if (err.name === 'NotFoundError') {
        errorMessage = "لم يتم العثور على كاميرا في الجهاز.";
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
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setZoomValue(val);
    if (videoTrack && capabilities?.zoom) {
      try {
        await videoTrack.applyConstraints({
          advanced: [{ zoom: val } as any]
        });
      } catch (err) {
        console.error("Failed to apply zoom", err);
      }
    }
  };

  const toggleTorch = async () => {
    if (videoTrack && capabilities?.torch) {
      const nextState = !isTorchOn;
      try {
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.error("Failed to toggle torch", err);
      }
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
        setAnalysis({ 
          loading: false, 
          error: "يرجى اختيار صور أو فيديو فقط.", 
          errorType: 'FILE_FORMAT',
          result: null 
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaData({ data: reader.result as string, mimeType: file.type });
        setAnalysis({ loading: false, error: null, errorType: null, result: null });
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
      setAnalysis({ loading: false, error: err.message, errorType: 'AI_FAILED', result: null });
    }
  };

  const reset = () => {
    setMediaData(null);
    setAnalysis({ loading: false, error: null, errorType: null, result: null });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12 pb-24">
        
        {/* Header Hero Section */}
        <section className="text-center space-y-4 pt-8">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-yellow-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            تحليل ذكي فوري
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
            اكشف المخاطر <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-600">بلمحة بصر</span>
          </h2>
          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto">
            نظام SafeVision HSE يستخدم الذكاء الاصطناعي لرصد التهديدات وتأمين بيئة العمل بشكل استباقي.
          </p>
        </section>

        {/* Media Control Section */}
        <section className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
              <button onClick={() => {setMode('image'); reset();}} className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all duration-500 ${mode === 'image' ? 'bg-white shadow-xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                التقاط صورة
              </button>
              <button onClick={() => {setMode('video'); reset();}} className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all duration-500 ${mode === 'video' ? 'bg-white shadow-xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                تسجيل فيديو
              </button>
            </div>
          </div>

          <div className="group relative border-[3px] border-dashed border-slate-100 rounded-[3rem] overflow-hidden bg-slate-50 min-h-[450px] flex items-center justify-center transition-all duration-700 hover:border-yellow-400/40 hover:bg-yellow-50/10">
            {!mediaData ? (
              mode === 'image' ? (
                <div className="text-center p-12 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-yellow-500 text-slate-900 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-yellow-500/30 group-hover:rotate-12 group-hover:scale-110 transition-all duration-700">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/30 active:scale-95">رفع المشهد الميداني</button>
                  <p className="mt-8 text-slate-400 text-sm font-black tracking-wide">أو اسحب الملف وأفلته هنا</p>
                </div>
              ) : (
                <div className="relative w-full aspect-video group/camera">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  
                  {/* Camera Controls Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex flex-col justify-between p-6 opacity-0 group-hover/camera:opacity-100 transition-opacity duration-300">
                    
                    {/* Top Controls: Torch & Timer */}
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        {capabilities?.torch && (
                          <button 
                            onClick={toggleTorch}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md transition-all ${isTorchOn ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/40' : 'bg-black/40 text-white hover:bg-black/60'}`}
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      {isRecording && (
                        <div className="bg-red-600 text-white px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xl animate-pulse">
                          <div className="w-2.5 h-2.5 bg-white rounded-full" />
                          <span className="font-black text-sm tracking-widest">{formatTime(recordingSeconds)}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Controls: Zoom & Record Button */}
                    <div className="space-y-8">
                      {capabilities?.zoom && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-4 w-full max-w-xs bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            <span className="text-white font-black text-xs">1x</span>
                            <input 
                              type="range" 
                              min={capabilities.zoom.min || 1}
                              max={capabilities.zoom.max || 5}
                              step="0.1"
                              value={zoomValue}
                              onChange={handleZoomChange}
                              className="flex-grow accent-yellow-500 h-1.5 rounded-full"
                            />
                            <span className="text-white font-black text-xs">{zoomValue.toFixed(1)}x</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-4">
                        <button onClick={isRecording ? stopRecording : startRecording} className={`relative group/rec flex items-center justify-center w-24 h-24 rounded-full border-4 border-white backdrop-blur-md transition-all duration-500 ${isRecording ? 'scale-110' : 'hover:scale-105'} active:scale-95`}>
                          <div className={`transition-all duration-500 ${isRecording ? 'w-10 h-10 rounded-xl bg-white animate-pulse' : 'w-16 h-16 rounded-full bg-red-600 group-hover/rec:bg-red-500'}`} />
                          {isRecording && <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-40" />}
                        </button>
                        <div className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 ${isRecording ? 'bg-red-600 text-white' : 'bg-black/40 text-white backdrop-blur-sm'}`}>
                          {isRecording ? 'جاري التسجيل' : 'انقر للبدء'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="relative w-full group/media animate-in zoom-in-95 duration-700">
                {mediaData.mimeType.startsWith('video') ? <video src={mediaData.data} controls className="w-full max-h-[650px] object-contain rounded-[2.5rem]" /> : <img src={mediaData.data} className="w-full max-h-[650px] object-contain rounded-[2.5rem]" />}
                <div className="absolute top-8 right-8 flex gap-4 opacity-0 group-hover/media:opacity-100 transition-all duration-500 translate-y-2 group-hover/media:translate-y-0">
                  <button onClick={reset} className="bg-white/90 backdrop-blur-xl text-red-600 p-4 rounded-[1.5rem] shadow-2xl border border-red-50 hover:bg-red-50 transition-all active:scale-90">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
          </div>

          {mediaData && !analysis.loading && !analysis.result && (
            <button onClick={runAnalysis} className="w-full mt-10 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 text-slate-900 py-6 rounded-[2rem] font-black text-2xl hover:shadow-yellow-500/40 hover:scale-[1.01] transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              تفعيل الرؤية الحاسوبية
            </button>
          )}

          {analysis.loading && (
            <div className="mt-10 text-center p-16 bg-slate-50/50 rounded-[3rem] border border-slate-100 animate-in fade-in duration-700">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-[6px] border-yellow-100 rounded-full" />
                <div className="absolute inset-0 border-[6px] border-yellow-500 border-t-transparent rounded-full animate-spin shadow-inner" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">جاري مسح البيئة المحيطة</h3>
              <p className="text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">الذكاء الاصطناعي يقوم الآن بتحديد المخاطر وتصنيفها بناءً على معايير السلامة العالمية</p>
            </div>
          )}
        </section>

        {/* Results Visual Grid */}
        {analysis.result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b-2 border-slate-100 pb-8">
              <div className="flex items-center gap-6">
                <div className="bg-slate-900 text-yellow-500 p-5 rounded-[2rem] shadow-2xl shadow-slate-900/20">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 mb-1">تقرير الرصد البصري</h3>
                  <p className="text-slate-400 font-bold text-lg">تم اكتشاف {analysis.result.hazards.length} مخاطر محتملة في الموقع</p>
                </div>
              </div>
              <button onClick={reset} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                تحليل مشهد جديد
              </button>
            </div>

            {/* Overall Summary Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] text-yellow-500/80">الخلاصة التنفيذية</h4>
                </div>
                <p className="text-2xl font-bold leading-relaxed opacity-95 group-hover:opacity-100 transition-opacity">
                  {analysis.result.overallSummary}
                </p>
              </div>
            </div>

            {/* Hazards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {analysis.result.hazards.map((hazard, index) => (
                <div key={index} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 150}ms` }}>
                  <HazardCard hazard={hazard} />
                </div>
              ))}
            </div>

            {/* Safety Disclaimer Footer */}
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-center">
              <p className="text-slate-400 text-sm font-bold leading-relaxed max-w-2xl mx-auto">
                <span className="text-yellow-600 block mb-2 font-black uppercase tracking-widest text-[10px]">تنويه هام</span>
                هذا التحليل مقدم بواسطة الذكاء الاصطناعي للمساعدة في اتخاذ القرار ولا يغني عن التفتيش الميداني من قبل مختصي السلامة المؤهلين.
              </p>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {analysis.error && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-slate-900 text-white p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8">
            <div className="flex items-start gap-4">
              <div className="bg-red-500 p-3 rounded-2xl shrink-0 shadow-lg shadow-red-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="flex-grow">
                <h4 className="font-black text-lg text-red-400 mb-1">تنبيه فني</h4>
                <p className="text-sm font-bold text-slate-300 leading-relaxed">{analysis.error}</p>
                <div className="flex gap-4 mt-4">
                  <button onClick={() => { if (analysis.errorType?.includes('CAMERA')) startCamera(); else runAnalysis(); }} className="px-6 py-2 bg-white text-slate-900 rounded-xl text-xs font-black shadow-lg hover:bg-yellow-400 transition-all active:scale-95">إعادة المحاولة</button>
                  <button onClick={() => setAnalysis(p => ({...p, error: null}))} className="px-6 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-black hover:text-white transition-all">تجاهل</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        body { background-color: #fbfbfc; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        input[type=range] {
          -webkit-appearance: none;
          background: rgba(255,255,255,0.2);
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #eab308;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(234, 179, 8, 0.4);
        }
      `}</style>
    </Layout>
  );
};

export default App;
