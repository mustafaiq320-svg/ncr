
import React from 'react';
import { Hazard } from '../types';

interface HazardCardProps {
  hazard: Hazard;
}

export const HazardCard: React.FC<HazardCardProps> = ({ hazard }) => {
  const getRiskStyles = (level: string) => {
    switch (level) {
      case 'عالي':
        return { 
          bg: 'bg-red-50', 
          border: 'border-red-100', 
          text: 'text-red-700', 
          badge: 'bg-red-600',
          icon: '⚠️'
        };
      case 'متوسط':
        return { 
          bg: 'bg-amber-50', 
          border: 'border-amber-100', 
          text: 'text-amber-700', 
          badge: 'bg-amber-500',
          icon: '🔔'
        };
      default:
        return { 
          bg: 'bg-emerald-50', 
          border: 'border-emerald-100', 
          text: 'text-emerald-700', 
          badge: 'bg-emerald-600',
          icon: '✔️'
        };
    }
  };

  const styles = getRiskStyles(hazard.riskLevel);

  return (
    <div className={`group bg-white border-2 ${styles.border} rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}>
      <div className="flex justify-between items-start mb-4">
        <span className={`${styles.badge} text-white px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase`}>
          مستوى {hazard.riskLevel}
        </span>
        <span className="text-2xl">{styles.icon}</span>
      </div>
      
      <div className="mb-4">
        <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-yellow-600 transition-colors">
          {hazard.title}
        </h3>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          {hazard.description}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-yellow-500 rounded-full" />
          <h4 className="font-black text-xs text-slate-400 uppercase tracking-wider">خطة المعالجة والوقاية</h4>
        </div>
        <ul className="grid gap-2">
          {hazard.mitigation.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-2xl text-xs font-bold text-slate-700 border border-slate-100/50">
              <span className="text-yellow-600 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-300 uppercase">{hazard.category}</span>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </div>
  );
};
