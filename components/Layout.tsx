
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-yellow-200 selection:text-slate-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[60]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-2xl shadow-xl shadow-slate-900/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none">SafeVision</h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600">Smart HSE Intelligence</span>
            </div>
          </div>
          
          <nav className="hidden md:flex gap-10 text-sm font-black text-slate-400">
            <a href="#" className="text-slate-900 hover:text-yellow-600 transition-colors">الرئيسية</a>
            <a href="#" className="hover:text-yellow-600 transition-colors">كيف يعمل؟</a>
            <a href="#" className="hover:text-yellow-600 transition-colors">المعايير</a>
            <a href="#" className="hover:text-yellow-600 transition-colors">تواصل معنا</a>
          </nav>

          <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95">
            تسجيل الدخول
          </button>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2 rounded-xl">
                <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-slate-900">SafeVision HSE</h2>
            </div>
            <p className="text-slate-500 font-bold max-w-sm leading-relaxed">
              منصة ذكية متخصصة في تعزيز معايير السلامة المهنية باستخدام تقنيات الذكاء الاصطناعي والرؤية الحاسوبية المتقدمة.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">روابط سريعة</h4>
            <ul className="space-y-4 text-slate-500 font-bold text-sm">
              <li><a href="#" className="hover:text-yellow-600 transition-colors">دليل المستخدم</a></li>
              <li><a href="#" className="hover:text-yellow-600 transition-colors">سياسة الخصوصية</a></li>
              <li><a href="#" className="hover:text-yellow-600 transition-colors">شروط الاستخدام</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">تواصل معنا</h4>
            <ul className="space-y-4 text-slate-500 font-bold text-sm">
              <li>info@safevision.ai</li>
              <li>+966 800 123 4567</li>
              <li className="flex gap-4 pt-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-yellow-500 hover:text-white transition-all cursor-pointer">𝕏</div>
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-yellow-500 hover:text-white transition-all cursor-pointer">in</div>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-slate-50 text-center">
          <p className="text-slate-300 font-black text-[10px] uppercase tracking-[0.3em]">© {new Date().getFullYear()} SafeVision AI - كل الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
};
