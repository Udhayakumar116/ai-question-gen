
import React, { useState, useRef, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist';
import { analyzeLiterature, generateResearchVideo, startAnalysisChat, generateResearchQuestions, generateQuestionsFromContent } from './services/geminiService';
import { AnalysisResult, UploadedFile, GapType, SavedAnalysis, ResearchQuestion } from './types';
import GapCard from './components/GapCard';
import ConceptGraph from './components/ConceptGraph';
import SaturationChart from './components/SaturationChart';
import QuestionList from './components/QuestionList';
import { Chat, GenerateContentResponse } from "@google/genai";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_KEY = 'scholargap_history_v1';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // History State
  const [savedHistory, setSavedHistory] = useState<SavedAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Video State
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoStatus, setVideoStatus] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);

  // Filter States
  const [filterType, setFilterType] = useState<GapType | 'All'>('All');
  const [filterImpact, setFilterImpact] = useState<'High' | 'Medium' | 'Low' | 'All'>('All');

  // Export State
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Chat Assistant State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [currentChatInput, setCurrentChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fast Question State
  const [fastQuestionLoading, setFastQuestionLoading] = useState(false);
  const [showBulkQuestionPicker, setShowBulkQuestionPicker] = useState(false);
  const [desiredQuestionCount, setDesiredQuestionCount] = useState<number>(3);

  // Auto-expand textarea effect
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load history on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedHistory(parsed);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = () => {
    if (!result) return;
    const newEntry: SavedAnalysis = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      title: inputText.slice(0, 40) || "Research Session " + new Date().toLocaleDateString(),
      result: result
    };
    setSavedHistory(prev => [newEntry, ...(Array.isArray(prev) ? prev : [])]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...savedHistory]));
  };

  const loadFromHistory = (entry: SavedAnalysis) => {
    setResult(entry.result);
    setFilterType('All');
    setFilterImpact('All');
    setShowHistory(false);
    setChatSession(startAnalysisChat(entry.result));
    setChatMessages([{ role: 'ai', text: "Analysis loaded. How can I help you explore these research gaps?" }]);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedHistory.filter(h => h.id !== id);
    setSavedHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  const exportGapsCSV = () => {
    if (!result || !Array.isArray(result.gaps)) return;
    const headers = ["ID", "Title", "Type", "Impact", "Description", "Justification", "Suggested Methods"];
    const rows = result.gaps.map(gap => [
      gap.id,
      `"${gap.title.replace(/"/g, '""')}"`,
      gap.type,
      gap.potentialImpact,
      `"${gap.description.replace(/"/g, '""')}"`,
      `"${gap.justification.replace(/"/g, '""')}"`,
      `"${(gap.suggestedMethods || []).join("; ").replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    downloadFile(csvContent, "research_gaps.csv", "text/csv");
    setShowExportMenu(false);
  };

  const exportSaturationCSV = () => {
    if (!result || !Array.isArray(result.saturationData)) return;
    const headers = ["Topic Name", "Saturation", "Potential"];
    const rows = result.saturationData.map(d => [
      `"${d.name.replace(/"/g, '""')}"`,
      d.saturation,
      d.potential
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    downloadFile(csvContent, "saturation_data.csv", "text/csv");
    setShowExportMenu(false);
  };

  const exportMarkdown = () => {
    if (!result) return;
    let md = `# Research Landscape Analysis Report\n\n`;
    md += `## Executive Summary\n${result.summary}\n\n`;
    md += `## Identified Gaps\n\n`;
    (result.gaps || []).forEach((gap, i) => {
      md += `### ${i + 1}. ${gap.title}\n`;
      md += `**Type:** ${gap.type} | **Impact:** ${gap.potentialImpact}\n\n`;
      md += `> ${gap.description}\n\n`;
      md += `**Scientific Justification:**\n${gap.justification}\n\n`;
      if (gap.suggestedMethods?.length) {
        md += `**Suggested Methods:**\n- ${gap.suggestedMethods.join("\n- ")}\n\n`;
      }
      md += `---\n\n`;
    });
    md += `*Generated by ScholarGap AI*`;
    downloadFile(md, "research_report.md", "text/markdown");
    setShowExportMenu(false);
  };

  const exportJSON = () => {
    if (!result) return;
    downloadFile(JSON.stringify(result, null, 2), "analysis_raw_data.json", "application/json");
    setShowExportMenu(false);
  };

  const handleAnimateImage = async (file: UploadedFile) => {
    if (!file.preview || !file.type.startsWith('image/')) return;
    try {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
      setIsGeneratingVideo(true);
      setVideoError(null);
      setVideoStatus("Initializing Veo Laboratory...");
      const url = await generateResearchVideo(
        file.data.split(',')[1],
        file.type,
        `A high-detail scientific documentary style animation based on this research figure: ${file.name}. Motion is smooth, showing a progression of discovery.`,
        videoAspectRatio
      );
      setVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      setVideoError("Video generation failed. Please check your paid API key and balance.");
    } finally {
      setIsGeneratingVideo(false);
      setVideoStatus("");
    }
  };

  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        
        const lines: Map<number, any[]> = new Map();
        
        items.forEach(item => {
          if (!item.str || item.str.trim() === '') return;
          const y = item.transform[5];
          let foundKey: number | null = null;
          for (const lineY of lines.keys()) {
            if (Math.abs(lineY - y) < 5) {
              foundKey = lineY;
              break;
            }
          }
          if (foundKey !== null) {
            lines.get(foundKey)?.push(item);
          } else {
            lines.set(y, [item]);
          }
        });
        
        const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);
        let pageText = '';
        sortedY.forEach(y => {
          const lineItems = lines.get(y) || [];
          lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
          let lineStr = '';
          for (let j = 0; j < lineItems.length; j++) {
            const current = lineItems[j];
            const next = lineItems[j + 1];
            lineStr += current.str;
            if (next) {
              const gap = next.transform[4] - (current.transform[4] + (current.width || 0));
              if (gap > 20) lineStr += '    ';
              else if (gap > 2) lineStr += ' ';
            }
          }
          pageText += lineStr + '\n';
        });
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      return fullText;
    } catch (err) {
      console.error("PDF extraction error:", err);
      throw new Error("Failed to extract text from PDF. The file might be corrupted or complex.");
    }
  };

  const extractPptxText = async (file: File): Promise<string> => {
    const zip = await JSZip.loadAsync(file);
    let fullText = "";
    
    const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));
    for (const slideFile of slideFiles) {
      const slideNum = slideFile.match(/slide(\d+)\.xml/)?.[1] || "??";
      const content = await zip.files[slideFile].async("string");
      const matches = content.match(/<a:t>([^<]*)<\/a:t>/g);
      if (matches) {
        fullText += `--- Slide ${slideNum} ---\n` + matches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ") + "\n";
      }
      
      const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`;
      if (zip.files[notesFile]) {
        const notesContent = await zip.files[notesFile].async("string");
        const notesMatches = notesContent.match(/<a:t>([^<]*)<\/a:t>/g);
        if (notesMatches) {
          fullText += `[Slide ${slideNum} Notes: ${notesMatches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ")}]\n`;
        }
      }
    }
    return fullText;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = [];
    setError(null);
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 50MB limit.`);
        continue;
      }
      if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newFiles.push({ name: file.name, type: file.type, data: base64, preview: base64 });
      } else if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        try {
          const text = await extractPdfText(file);
          newFiles.push({ name: file.name, type: 'application/pdf', data: text });
        } catch (err: any) {
          setError(err.message || "Failed to parse PDF file.");
        }
      } else if (file.name.toLowerCase().endsWith('.pptx')) {
        try {
          const text = await extractPptxText(file);
          newFiles.push({ name: file.name, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', data: text });
        } catch (err) {
          setError("Failed to parse PPTX file.");
        }
      } else {
        setError(`Unsupported file type: ${file.name}`);
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setSelectedFileIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
    });
  };

  const toggleFileSelection = (index: number) => {
    setSelectedFileIndices(prev => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
    });
  };

  const selectAllFiles = () => {
    const all = files.map((_, i) => i);
    setSelectedFileIndices(new Set(all));
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && files.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setFilterType('All');
    setFilterImpact('All');
    try {
      const data = await analyzeLiterature(inputText, files);
      setResult(data);
      const session = startAnalysisChat(data);
      setChatSession(session);
      setChatMessages([{ role: 'ai', text: "Analysis complete! I've synthesized the research landscape, including specific research gaps and novel questions. What would you like to explore first?" }]);
    } catch (err: any) {
      setError("Analysis failed. Large files might exceed AI processing limits.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegenerateQuestions = async () => {
    if (!result) return;
    setIsGeneratingQuestions(true);
    try {
      const newQuestions = await generateResearchQuestions(result);
      setResult(prev => prev ? { ...prev, questions: newQuestions } : null);
    } catch (err) {
      setError("Failed to regenerate roadmap questions.");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleBulkFastQuestion = async () => {
    const selectedFiles = files.filter((_, i) => selectedFileIndices.has(i));
    if (selectedFiles.length === 0) return;
    
    setFastQuestionLoading(true);
    setShowBulkQuestionPicker(false);
    setError(null);
    setResult(null);
    try {
      const questions = await generateQuestionsFromContent(selectedFiles, desiredQuestionCount);
      setResult({
        summary: `Fast-track generation of ${desiredQuestionCount} research questions from ${selectedFiles.length} selected documents. This focused synthesis identifies immediate actionable scientific inquiries across the provided context.`,
        gaps: [],
        concepts: { nodes: [], links: [] },
        saturationData: [],
        questions: questions
      });
      window.scrollTo({ top: 600, behavior: 'smooth' });
    } catch (err: any) {
      setError("Quick question extraction failed.");
    } finally {
      setFastQuestionLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!currentChatInput.trim() || !chatSession || isChatTyping) return;
    const userText = currentChatInput;
    setCurrentChatInput('');
    setChatMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'user', text: userText }]);
    setIsChatTyping(true);

    try {
      const responseStream = await chatSession.sendMessageStream({ message: userText });
      let aiResponseText = '';
      setChatMessages(prev => [...prev, { role: 'ai', text: '' }]);

      for await (const chunk of responseStream) {
        if (!chunk) continue;
        const c = chunk as GenerateContentResponse;
        aiResponseText += (c.text || "");
        setChatMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = aiResponseText;
          return newMessages;
        });
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "I'm sorry, I encountered an error. Please try asking again." }]);
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleExample = () => {
    setInputText(`Recent advancements in Large Language Models (LLMs) have demonstrated impressive capabilities in code generation and creative writing. However, their reliability in high-stakes domain-specific reasoning remains inconsistent. There is a lack of rigorous benchmarking for ethical decision-making in autonomous clinical diagnostics.`);
  };

  const filteredGaps = useMemo(() => {
    if (!result || !Array.isArray(result.gaps)) return [];
    return result.gaps.filter(gap => {
      const typeMatch = filterType === 'All' || gap.type === filterType;
      const impactMatch = filterImpact === 'All' || gap.potentialImpact === filterImpact;
      return typeMatch && impactMatch;
    });
  }, [result, filterType, filterImpact]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M20 12l-8 8-8-8"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">ScholarGap AI</h1>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">Multi-modal Research Discovery</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              History ({Array.isArray(savedHistory) ? savedHistory.length : 0})
            </button>
            <button onClick={handleExample} className="text-xs font-semibold text-slate-400 hover:text-indigo-600">Try Example</button>
          </div>
        </div>
      </header>

      {showHistory && (
        <div className="fixed inset-0 z-40 flex">
          <div className="bg-black/20 backdrop-blur-sm flex-1" onClick={() => setShowHistory(false)} />
          <div className="w-80 bg-white shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">Saved Analyses</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {(!Array.isArray(savedHistory) || savedHistory.length === 0) ? (
                <div className="text-center py-12 text-slate-400 text-sm">No history yet.</div>
              ) : (
                savedHistory.map((h) => (
                  <div 
                    key={h.id} 
                    onClick={() => loadFromHistory(h)}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-400 transition-all group"
                  >
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{new Date(h.timestamp).toLocaleString()}</div>
                    <div className="text-sm font-bold text-slate-800 line-clamp-2 mb-2">{h.title}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">{(h.result.gaps || []).length} Gaps</span>
                      <button onClick={(e) => deleteFromHistory(h.id, e)} className="text-slate-300 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {result && (
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-2xl z-40 flex items-center justify-center transition-all transform active:scale-95 ${isChatOpen ? 'bg-slate-800 rotate-90 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {isChatOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
          )}
        </button>
      )}

      {isChatOpen && (
        <div className="fixed bottom-24 right-8 w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-40 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z"/></svg>
              </div>
              <div>
                <h4 className="text-sm font-bold">Research Assistant</h4>
                <p className="text-[10px] text-indigo-100 uppercase tracking-widest font-bold">Scientific Dialogue</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {Array.isArray(chatMessages) && chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'}`}>
                  {msg.text || (idx === chatMessages.length - 1 && isChatTyping ? '...' : '')}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input 
              type="text"
              placeholder="Ask about the results..."
              value={currentChatInput}
              onChange={(e) => setCurrentChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
              className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={handleSendChatMessage}
              disabled={!currentChatInput.trim() || isChatTyping}
              className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="text-sm font-bold text-slate-700 block mb-2">Literature Context (Text)</label>
              <div className="relative">
                <textarea
                  ref={textAreaRef}
                  className="w-full min-h-[44px] max-h-[200px] p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 text-sm overflow-y-auto resize-none transition-all shadow-inner"
                  placeholder="Paste abstracts, problem statements, or upload documents..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleAnalyze();
                    }
                  }}
                />
                <div className="absolute right-4 bottom-3 text-[10px] font-bold text-slate-400 pointer-events-none">
                  Ctrl + Enter
                </div>
              </div>
            </div>
            <div className="lg:col-span-1 flex flex-col">
              <label className="text-sm font-bold text-slate-700 block mb-2">Supplement with Files (PDF/PPTX/Images)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-xs font-bold text-slate-500">Upload Documents</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Accepts PDF, PPTX & Scientific Figures</p>
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pptx,.pdf" onChange={handleFileChange} />
              </div>
            </div>
          </div>

          {Array.isArray(files) && files.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-700">Uploaded Materials ({files.length})</h3>
                    <div className="flex gap-2">
                        <button onClick={selectAllFiles} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">Select All</button>
                        <button onClick={() => setSelectedFileIndices(new Set())} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">Deselect</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                {files.map((file, i) => (
                    <div 
                        key={i} 
                        onClick={() => toggleFileSelection(i)}
                        className={`relative group w-28 h-28 bg-white rounded-xl overflow-hidden border transition-all cursor-pointer shadow-sm ${selectedFileIndices.has(i) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                    {file.preview ? (
                        <>
                        <img src={file.preview} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleAnimateImage(file); }}
                                className="bg-indigo-600 text-white rounded-md px-1.5 py-0.5 text-[8px] font-bold shadow-lg"
                            >
                                ANIMATE
                            </button>
                        </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <svg className={`w-8 h-8 mb-1 ${file.type.includes('pdf') ? 'text-red-500' : 'text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] font-bold text-slate-600 truncate w-full px-1">{file.name}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{file.type.split('/')[1]?.split('-')[0] || 'Doc'}</span>
                        </div>
                    )}
                    
                    {/* Selection Checkbox */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedFileIndices.has(i) ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-slate-300 opacity-0 group-hover:opacity-100'}`}>
                        {selectedFileIndices.has(i) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        )}
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                        className="absolute bottom-1 right-1 bg-white/90 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all border border-slate-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    </div>
                ))}
                </div>
            </div>
          )}

          <div className="mt-8 flex flex-col md:flex-row justify-end gap-3 border-t border-slate-50 pt-6">
            {selectedFileIndices.size > 0 && (
                <div className="relative flex items-center gap-2 mr-auto">
                    <span className="text-xs font-bold text-indigo-600">{selectedFileIndices.size} selected</span>
                    <button
                        onClick={() => setShowBulkQuestionPicker(!showBulkQuestionPicker)}
                        className="bg-amber-100 text-amber-700 px-6 py-3 rounded-xl font-bold hover:bg-amber-200 transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z"/></svg>
                        Generate Questions from Selected
                    </button>
                    {showBulkQuestionPicker && (
                        <div className="absolute left-0 bottom-full mb-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                             <p className="text-[10px] font-bold text-slate-700 mb-3 uppercase tracking-wider">Number of Questions</p>
                            <div className="flex items-center gap-2 mb-4">
                                {[3, 5, 8, 12].map(n => (
                                <button 
                                    key={n}
                                    onClick={() => setDesiredQuestionCount(n)}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${desiredQuestionCount === n ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {n}
                                </button>
                                ))}
                            </div>
                            <button 
                                onClick={handleBulkFastQuestion}
                                className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all"
                            >
                                START GENERATION
                            </button>
                        </div>
                    )}
                </div>
            )}

             {result && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                    <button onClick={exportGapsCSV} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-2"><span className="text-emerald-500">CSV</span> Gaps</button>
                    <button onClick={exportSaturationCSV} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-2"><span className="text-emerald-500">CSV</span> Topics</button>
                    <button onClick={exportMarkdown} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-2"><span className="text-indigo-500">MD</span> Report</button>
                    <button onClick={exportJSON} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"><span className="text-slate-400">JSON</span> Raw</button>
                  </div>
                )}
              </div>
             )}
             {result && (
              <button
                onClick={saveToHistory}
                className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                Save
              </button>
             )}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || fastQuestionLoading || (!inputText.trim() && files.length === 0)}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:bg-slate-300 transition-all shadow-md active:scale-95"
            >
              {isAnalyzing || fastQuestionLoading ? (fastQuestionLoading ? `Synthesizing from ${selectedFileIndices.size} files...` : "Synthesizing Landscape...") : "Full Landscape Analysis"}
            </button>
          </div>
          {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100">{error}</div>}
        </section>

        {(isGeneratingVideo || videoUrl || videoError) && (
          <section className="bg-white rounded-2xl border border-indigo-100 p-8 shadow-lg animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z"/></svg>
                  </span>
                  Veo Visualization Lab
                </h3>
              </div>
              <button onClick={() => {setVideoUrl(null); setVideoError(null);}} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            {isGeneratingVideo ? (
              <div className="flex flex-col items-center py-12">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <div className="text-lg font-bold text-slate-800 animate-pulse">{videoStatus}</div>
              </div>
            ) : videoUrl ? (
              <div className={`mt-6 rounded-xl overflow-hidden shadow-2xl bg-black flex items-center justify-center mx-auto ${videoAspectRatio === '16:9' ? 'aspect-video w-full max-w-4xl' : 'aspect-[9/16] h-[600px]'}`}><video controls autoPlay loop src={videoUrl} className="w-full h-full object-contain" /></div>
            ) : videoError && (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center"><p className="text-amber-600 text-sm mb-4">{videoError}</p><button onClick={() => { 
                // @ts-ignore
                window.aistudio.openSelectKey() 
                }} className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold">Fix API Key</button></div>
            )}
          </section>
        )}

        {result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {result.concepts.nodes.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConceptGraph data={result.concepts} />
                <SaturationChart data={result.saturationData} />
              </div>
            )}
            
            <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="relative z-10">
                <h2 className="text-2xl font-extrabold mb-3">Landscape Summary</h2>
                <p className="text-indigo-50 leading-relaxed font-medium text-lg">{result.summary}</p>
              </div>
            </div>

            {result.questions && result.questions.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <QuestionList 
                  questions={result.questions} 
                  gaps={result.gaps} 
                  onRegenerate={handleRegenerateQuestions}
                  isRegenerating={isGeneratingQuestions}
                />
              </section>
            )}

            {result.gaps.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-slate-800">Identified Gaps ({filteredGaps.length})</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
                      <span className="px-2 text-[10px] uppercase text-slate-400">Type:</span>
                      {['All', ...Object.values(GapType)].map(type => (
                        <button key={type} onClick={() => setFilterType(type as any)} className={`px-3 py-1 rounded-md transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-50 hover:text-indigo-600'}`}>{type}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {filteredGaps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredGaps.map((gap) => <GapCard key={gap.id} gap={gap} allGaps={result.gaps} />)}
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400">No gaps match your filters.</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 text-center mt-auto">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">ScholarGap AI Multi-Modal Engine</p>
      </footer>
    </div>
  );
};

export default App;
