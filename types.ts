
export type ErrorType = 'CAMERA_DENIED' | 'CAMERA_NOT_FOUND' | 'FILE_FORMAT' | 'AI_FAILED' | 'NETWORK' | 'SAFETY' | 'UNKNOWN';

export interface Hazard {
  title: string;
  description: string;
  riskLevel: 'عالي' | 'متوسط' | 'منخفض';
  category: 'معدات وقاية' | 'مخاطر بيئية' | 'سلامة إنشائية' | 'مخاطر كهربائية' | 'أخرى';
  mitigation: string[];
}

export interface AnalysisResult {
  hazards: Hazard[];
  overallSummary: string;
}

export interface AnalysisState {
  loading: boolean;
  error: string | null;
  errorType: ErrorType | null;
  result: AnalysisResult | null;
}
