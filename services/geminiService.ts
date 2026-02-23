import { GoogleGenAI, Type } from "@google/genai";
import { HeadlessManifest, ComponentMetadata } from "../types";
import { getEnv } from "./figmaService";

// Initialize Gemini
// We assume process.env.API_KEY is populated (via window.env injection -> process.env polyfill in index.tsx)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface VisualAnalysisResult {
  analysis: string;
  options: string[];
}

export const generateMarketingCopy = async (
  templateName: string,
  bgName: string,
  heroName: string
): Promise<string> => {
  try {
    const model = 'gemini-3-flash-preview';
    const prompt = `
      You are a creative copywriter for a design automation tool.
      Write a short, punchy, engaging marketing headline (max 10 words) for a visual composition with the following attributes:
      - Template Type: ${templateName}
      - Mood/Background: ${bgName}
      - Hero Subject: ${heroName}

      Return only the headline text. Do not use quotes.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text?.trim() || "Create something amazing today.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Create something amazing today.";
  }
};

export const analyzeDesignSystem = async (manifest: HeadlessManifest): Promise<string> => {
    try {
        const componentNames = Object.values(manifest.components).map(c => c.name).join(', ');
        const total = manifest.totalComponents;
        
        const prompt = `
            You are a Design System Architect. I have a Figma manifest with ${total} components.
            Here is the list of component names found: 
            ${componentNames}

            Please provide a 3-bullet point summary of this design system:
            1. What kind of components seem to be present? (e.g. basic elements, marketing assets)
            2. Are there any naming inconsistencies or suggestions for better organization?
            3. A short "ReadMe" intro paragraph for developers using this system.

            Keep it professional and concise.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || "Could not generate analysis.";

    } catch (e) {
        console.error("Analysis failed", e);
        return "AI Analysis unavailable. Check API Key.";
    }
};

export const analyzeComponentVisuals = async (base64Images: string[], contextName: string): Promise<VisualAnalysisResult | null> => {
    try {
        const prompt = `
            You are a Creative Director at a top-tier Digital Marketing Agency.
            
            Your Task:
            1. Analyze the VISUAL STYLE of the provided design components (images). Look at the typography, color palette, use of whitespace, and overall "vibe" (e.g., minimalist, bold, luxury, playful).
            2. Based on this visual analysis, generate 3 NEW text options (Headlines or CTAs) that would perfectly fit this design style.
            
            The new text should be catchy, modern, and aligned with the visual identity you observe.
            
            Context: These components belong to the set "${contextName}".
        `;

        // Prepare parts: Text prompt + Images
        const parts: any[] = [{ text: prompt }];
        
        base64Images.forEach(b64 => {
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: b64
                }
            });
        });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.STRING,
                            description: "A brief, professional agency-style breakdown of the visual design language (max 2 sentences).",
                        },
                        options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "3 distinct, creative text options that fit the design.",
                        }
                    },
                    required: ["analysis", "options"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as VisualAnalysisResult;
        }
        return null;

    } catch (e) {
        console.error("Visual analysis failed", e);
        return null;
    }
};

export const analyzeComponentSetContent = async (components: ComponentMetadata[], setName: string): Promise<string> => {
    // Legacy text-only analysis (kept for fallback if needed, but UI now uses visual analysis)
    try {
        const textContent = components
            .map(c => c.textContent)
            .filter(t => t && t.length > 2)
            .join('\n---\n');

        if (!textContent) return `No significant text content found in ${setName} to analyze.`;

        const prompt = `
            Analyze the extracted text content from the "${setName}" design components:
            ${textContent.slice(0, 5000)}
            Provide a brief tone analysis and 3 optimized copy alternatives.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || "Could not analyze content.";
    } catch (e) {
        return "AI Analysis unavailable.";
    }
};
