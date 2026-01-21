
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeHazards = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  // إنشاء مثيل جديد من GoogleGenAI عند كل استدعاء لضمان استخدام أحدث مفتاح API مفعل
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    بصفتك خبير سلامة مهنية (HSE Expert)، قم بتحليل الصورة/الفيديو المرفق لاستخراج كافة المخاطر الأمنية والصحية الملاحظة.
    
    المطلوب منك:
    1. قائمة بكافة المخاطر (hazards): لكل خطر حدد العنوان، الوصف الدقيق، مستوى الخطورة (عالي، متوسط، منخفض)، التصنيف، وخطوات المعالجة المقترحة.
    2. ملخص عام للحالة (overallSummary): تقييم سريع للوضع العام في الموقع.
    
    يجب أن يكون الرد باللغة العربية الفصحى وبأسلوب تقني واحترافي، وفي تنسيق JSON حصراً.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data.split(',')[1] || base64Data,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallSummary: { type: Type.STRING },
            hazards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  riskLevel: { type: Type.STRING },
                  category: { type: Type.STRING },
                  mitigation: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["title", "description", "riskLevel", "category", "mitigation"]
              }
            }
          },
          required: ["hazards", "overallSummary"]
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(resultText) as AnalysisResult;
  } catch (error: any) {
    console.error("Hazard Analysis Error:", error);
    
    // إذا كان الخطأ بسبب عدم العثور على المشروع أو الكيان (غالباً مشكلة في مفتاح API أو الفوترة)
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("ENTITY_NOT_FOUND");
    }
    
    throw new Error(error.message || "فشل في تحليل المخاطر. يرجى المحاولة مرة أخرى.");
  }
};
