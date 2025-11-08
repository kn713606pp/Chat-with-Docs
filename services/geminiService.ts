/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import { UrlContextMetadataItem } from '../types';

// IMPORTANT: The API key MUST be set as an environment variable `process.env.API_KEY`
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

// Model supporting URL context, consistent with user examples and documentation.
const MODEL_NAME = "gemini-2.5-flash"; 

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API 金鑰未設定。請設定 process.env.API_KEY。");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
}

export const generateContentWithUrlContext = async (
  prompt: string,
  urls: string[],
  fileContent?: string | null
): Promise<GeminiResponse> => {
  const currentAi = getAiInstance();
  
  const tools: Tool[] = [];
  if (urls.length > 0) {
    // The `urlContext` tool takes a list of URLs.
    // The backend service will fetch the content from these URLs and use it as context for the model.
    tools.push({ urlContext: { urls } });
  }

  // The prompt should no longer contain the list of URLs as they are now handled by the `urlContext` tool.
  // This makes the prompt cleaner, smaller, and uses the API as intended.
  let fullPrompt = `${prompt}\n\n請用繁體中文回答。`;
  
  if (fileContent) {
    fullPrompt += `\n\n也請參考以下上傳的檔案內容：\n---\n${fileContent}\n---`;
  }

  const contents: Content[] = [{ role: "user", parts: [{ text: fullPrompt }] }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: { 
        tools: tools,
        safetySettings: safetySettings,
      },
    });

    const text = response.text;
    const candidate = response.candidates?.[0];
    let extractedUrlContextMetadata: UrlContextMetadataItem[] | undefined = undefined;

    if (candidate && candidate.urlContextMetadata && candidate.urlContextMetadata.urlMetadata) {
      console.log("Raw candidate.urlContextMetadata.urlMetadata from API/SDK:", JSON.stringify(candidate.urlContextMetadata.urlMetadata, null, 2));
      // Assuming SDK converts snake_case to camelCase, UrlContextMetadataItem type (now camelCase) should match items in urlMetadata.
      extractedUrlContextMetadata = candidate.urlContextMetadata.urlMetadata as UrlContextMetadataItem[];
    } else if (candidate && candidate.urlContextMetadata) {
      // This case implies urlContextMetadata exists but urlMetadata field might be missing or empty.
      console.warn("candidate.urlContextMetadata is present, but 'urlMetadata' field is missing or empty:", JSON.stringify(candidate.urlContextMetadata, null, 2));
    } else {
      // console.log("No urlContextMetadata found in the Gemini API response candidate.");
    }
    
    return { text, urlContextMetadata: extractedUrlContextMetadata };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("API 金鑰無效。請檢查您的 GEMINI_API_KEY 環境變數。");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("已超過 API 配額。請檢查您的 Gemini API 配額。");
      }
      if (googleError.type === 'GoogleGenAIError' && googleError.message) {
        throw new Error(`Gemini API 錯誤： ${googleError.message}`);
      }
      throw new Error(`無法從 AI 取得回應： ${error.message}`);
    }
    throw new Error("因未知錯誤，無法從 AI 取得回應。");
  }
};

// This function now aims to get a JSON array of string suggestions.
export const getInitialSuggestions = async (urls: string[]): Promise<GeminiResponse> => {
  if (urls.length === 0) {
    // This case should ideally be handled by the caller, but as a fallback:
    return { text: JSON.stringify({ suggestions: ["新增一些 URL 以取得主題建議。"] }) };
  }
  const currentAi = getAiInstance();
  const urlList = urls.join('\n');
  
  // Prompt updated to request JSON output of short questions in Traditional Chinese
  const promptText = `根據以下文件 URL 的內容，提供 3-4 個開發人員可能會問的簡潔且可操作的問題，以探索這些文件。這些問題應適合作為快速入門的提示。請僅回傳一個 JSON 物件，其中包含一個名為 "suggestions" 的鍵，其值為這些問題字串的陣列。例如：{"suggestions": ["速率限制是多少？", "如何取得 API 金鑰？", "解釋一下模型 X。"]}

Relevant URLs:
${urlList}`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        safetySettings: safetySettings,
        responseMimeType: "application/json", // Request JSON output
      },
    });

    const text = response.text; // This should be the JSON string
    // urlContextMetadata is not expected here because tools cannot be used with responseMimeType: "application/json"
    // const urlContextMetadata = response.candidates?.[0]?.urlContextMetadata?.urlMetadata as UrlContextMetadataItem[] | undefined;
    
    return { text /*, urlContextMetadata: undefined */ }; // Explicitly undefined or not included

  } catch (error) {
    console.error("Error calling Gemini API for initial suggestions:", error);
     if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("用於建議的 API 金鑰無效。請檢查您的 GEMINI_API_KEY 環境變數。");
      }
      // Check for the specific error message and re-throw a more informative one if needed
      if (googleError.message && googleError.message.includes("Tool use with a response mime type: 'application/json' is unsupported")) {
        throw new Error("設定錯誤：無法將工具與 JSON 回應類型一起用於建議。這應該在程式碼中修正。");
      }
      throw new Error(`無法從 AI 取得初始建議： ${error.message}`);
    }
    throw new Error("因未知錯誤，無法從 AI 取得初始建議。");
  }
};