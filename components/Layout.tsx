
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-500 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">SafeVision HSE</h1>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <a href="#" className="hover:text-yellow-500 transition-colors">الرئيسية</a>
            <a href="#" className="hover:text-yellow-500 transition-colors">عن التطبيق</a>
            <a href="#" className="hover:text-yellow-500 transition-colors">التعليمات</a>
          </nav>
        </div>
      </header>
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-sm">
        <p>© {new Date().getFullYear()} SafeVision HSE - مدعوم بالذكاء الاصطناعي لتحليل المخاطر</p>
      </footer>
    </div>
  );
};
