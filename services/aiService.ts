import { GoogleGenAI } from "@google/genai";

// Initialize the client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (buffer: ArrayBuffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data-URL declaration (e.g. "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const aiService = {
  async summarizeDocument(pdfBuffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
      const base64Data = await fileToBase64(pdfBuffer);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            },
            {
              text: `Analyze the attached PDF document ("${fileName}"). Provide a concise summary of its key points, main topics, and any conclusions. Format the output with Markdown.`
            }
          ]
        }
      });

      return response.text || "No summary generated.";
    } catch (error) {
      console.error("AI Service Error:", error);
      throw new Error("Failed to analyze document with Gemini API. Please check your API Key.");
    }
  }
};