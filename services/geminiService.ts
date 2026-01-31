
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, GapType, UploadedFile, ResearchQuestion } from "../types";

export async function analyzeLiterature(text: string, files: UploadedFile[]): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  
  let prompt = `Act as a senior scientific research strategist. Analyze the provided literature materials to synthesize a comprehensive research landscape report.
  
  Your analysis must include:
  1. A summary of the current state of the field.
  2. Identification of 5-8 distinct research gaps (Methodological, Theoretical, Empirical, Practical, or Knowledge).
  3. A conceptual network map of key entities.
  4. Topic saturation levels vs novelty potential.
  5. 3-5 novel, actionable, and scientifically rigorous research questions that directly address the identified gaps. Each question must include a clear rationale and a specific "next step" for a researcher.

  Main Text Context: ${text}\n\n`;

  files.filter(f => !f.type.startsWith('image/')).forEach(f => {
    prompt += `Content from file (${f.name}):\n${f.data}\n\n`;
  });

  parts.push({ text: prompt });

  files.filter(f => f.type.startsWith('image/')).forEach(f => {
    parts.push({
      inlineData: {
        mimeType: f.type,
        data: f.data.split(',')[1]
      }
    });
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          gaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING, description: "One of: Methodological, Theoretical, Empirical, Practical, Knowledge" },
                justification: { type: Type.STRING },
                potentialImpact: { type: Type.STRING, description: "One of: High, Medium, Low" },
                suggestedMethods: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['id', 'title', 'description', 'type', 'justification', 'potentialImpact', 'suggestedMethods']
            }
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                rationale: { type: Type.STRING },
                connectedGapId: { type: Type.STRING, description: "The ID of the gap this question addresses" },
                suggestedAction: { type: Type.STRING, description: "Concrete next step for a researcher" }
              },
              required: ['id', 'question', 'rationale', 'connectedGapId', 'suggestedAction']
            }
          },
          concepts: {
            type: Type.OBJECT,
            properties: {
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    group: { type: Type.NUMBER },
                    val: { type: Type.NUMBER }
                  },
                  required: ['id', 'group', 'val']
                }
              },
              links: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING }
                  },
                  required: ['source', 'target']
                }
              }
            },
            required: ['nodes', 'links']
          },
          saturationData: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                saturation: { type: Type.NUMBER },
                potential: { type: Type.NUMBER }
              },
              required: ['name', 'saturation', 'potential']
                }
              }
            },
        required: ['summary', 'gaps', 'concepts', 'saturationData', 'questions']
      },
      thinkingConfig: { thinkingBudget: 8000 }
    }
  });

  const rawJson = response.text;
  if (!rawJson) throw new Error("No response text received from the model.");
  try {
    const parsed = JSON.parse(rawJson.trim());
    return {
      summary: parsed.summary || "",
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      concepts: parsed.concepts || { nodes: [], links: [] },
      saturationData: Array.isArray(parsed.saturationData) ? parsed.saturationData : []
    } as AnalysisResult;
  } catch (e) {
    throw new Error("Failed to parse analysis JSON: " + (e as Error).message);
  }
}

export async function generateQuestionsFromContent(files: UploadedFile[], numQuestions: number = 3): Promise<ResearchQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let combinedContent = "";
  files.forEach(f => {
    combinedContent += `\nFILE NAME: ${f.name}\nCONTENT:\n${f.data}\n---\n`;
  });

  const prompt = `Act as an expert academic strategist. I have provided ${files.length} documents.
  The contents extracted are:
  
  --- START COMBINED CONTENT ---
  ${combinedContent}
  --- END COMBINED CONTENT ---
  
  Generate EXACTLY ${numQuestions} high-quality, scientifically rigorous research questions that a researcher could pursue to extend this work. 
  Try to synthesize connections BETWEEN the documents if possible.
  For each question:
  1. State the question clearly.
  2. Provide a brief rationale based on specific points found in the content.
  3. Suggest a concrete next methodological step.
  
  Return the result as a JSON array of objects with fields: id, question, rationale, connectedGapId (set to "direct"), and suggestedAction.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            rationale: { type: Type.STRING },
            connectedGapId: { type: Type.STRING },
            suggestedAction: { type: Type.STRING }
          },
          required: ['id', 'question', 'rationale', 'connectedGapId', 'suggestedAction']
        }
      },
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  const rawJson = response.text;
  if (!rawJson) throw new Error("No response text received from the model.");
  try {
    const parsed = JSON.parse(rawJson.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    throw new Error("Failed to parse questions JSON");
  }
}

export async function generateResearchQuestions(result: AnalysisResult): Promise<ResearchQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Based on the following research gaps and landscape summary, generate 3-5 novel, actionable research questions that build upon these gaps. 
  Each question should be precise, scientifically rigorous, and include a clear suggested next step for a researcher.
  
  SUMMARY: ${result.summary}
  GAPS: ${JSON.stringify(result.gaps)}
  
  Provide the output in valid JSON format matching the specified schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            rationale: { type: Type.STRING },
            connectedGapId: { type: Type.STRING },
            suggestedAction: { type: Type.STRING }
          },
          required: ['id', 'question', 'rationale', 'connectedGapId', 'suggestedAction']
        }
      },
      thinkingConfig: { thinkingBudget: 2000 }
    }
  });

  const rawJson = response.text;
  if (!rawJson) throw new Error("No response text received from the model.");
  const parsed = JSON.parse(rawJson.trim());
  return Array.isArray(parsed) ? parsed : [];
}

export function startAnalysisChat(result: AnalysisResult): Chat {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are an expert Research Assistant. You have access to the following literature analysis:
      Summary: ${result.summary}
      Identified Gaps: ${JSON.stringify(result.gaps || [])}
      Topic Saturation: ${JSON.stringify(result.saturationData || [])}
      Generated Questions: ${JSON.stringify(result.questions || [])}
      
      Your goal is to help the user explore these findings, answer questions about the gaps, suggest further reading, or refine research questions. 
      Keep your tone professional, academic, yet encouraging. Use Markdown for formatting.`,
    },
  });
}

export async function generateResearchVideo(
  imageBytesBase64: string, 
  mimeType: string, 
  prompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> {
  const sessionAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let operation = await sessionAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt || 'A cinematic visualization of scientific data transitioning into a future technology breakthrough, high detail, scientific documentary style',
    image: { imageBytes: imageBytesBase64, mimeType: mimeType },
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await sessionAi.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const videoBlob = await response.blob();
  return URL.createObjectURL(videoBlob);
}
