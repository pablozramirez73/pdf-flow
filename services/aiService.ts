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
  },

  async searchWeb(query: string): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "No results found.";
      
      // Extract grounding metadata
      // The structure is response.candidates[0].groundingMetadata.groundingChunks
      // Each chunk may have a 'web' property: { uri: string, title: string }
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      const sources = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title)
        .map((web: any) => ({
          title: web.title,
          uri: web.uri
        }));

      return { text, sources };
    } catch (error) {
      console.error("AI Search Error:", error);
      throw new Error("Failed to perform web search.");
    }
  }
};