import React, { useState } from 'react';
import { ResearchQuestion, ResearchGap } from '../types';

interface QuestionListProps {
  questions: ResearchQuestion[];
  gaps: ResearchGap[];
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const QuestionList: React.FC<QuestionListProps> = ({ questions, gaps, onRegenerate, isRegenerating }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  if (!Array.isArray(questions) || questions.length === 0) return null;
  
  const safeGaps = Array.isArray(gaps) ? gaps : [];

  const handleCopy = (q: ResearchQuestion) => {
    const text = `Research Question: ${q.question}\nRationale: ${q.rationale}\nNext Step: ${q.suggestedAction}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(q.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyLink = (q: ResearchQuestion) => {
    const url = `${window.location.origin}${window.location.pathname}#question-${q.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(q.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800">Novel Research Roadmap</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">High-Impact Scientific Inquiries</p>
          </div>
        </div>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-amber-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isRegenerating ? (
              <>
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Roadmap
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {questions.map((q) => {
          const connectedGap = safeGaps.find(g => g.id === q.connectedGapId);
          // Find other questions that address the same gap
          const relatedQuestions = questions
            .filter(oq => oq.connectedGapId === q.connectedGapId && oq.id !== q.id)
            .slice(0, 3);

          return (
            <div 
              key={q.id} 
              id={`question-${q.id}`}
              className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group scroll-mt-24"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase">Proposed Study</span>
                    {connectedGap && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">Addressing: {connectedGap.title}</span>
                    )}
                  </div>
                  <h4 className="text-xl font-extrabold text-slate-900 leading-tight mb-4 group-hover:text-amber-600 transition-colors">
                    {q.question}
                  </h4>
                  <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed italic border-l-2 border-slate-100 pl-4">
                    {q.rationale}
                  </p>
                  
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3 mb-4">
                    <div className="shrink-0 w-8 h-8 bg-white text-amber-600 rounded-lg flex items-center justify-center shadow-sm border border-amber-100">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">Recommended Next Step</span>
                      <p className="text-sm text-amber-900 font-bold leading-snug">{q.suggestedAction}</p>
                    </div>
                  </div>

                  {relatedQuestions.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.102 1.101" />
                        </svg>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Related Investigations for this Gap</span>
                      </div>
                      <div className="space-y-2">
                        {relatedQuestions.map((rq) => (
                          <div key={rq.id} className="flex items-start gap-2">
                            <div className="w-1 h-1 bg-amber-300 rounded-full mt-1.5 shrink-0"></div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed hover:text-amber-600 cursor-default">
                              {rq.question}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex lg:flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => handleCopy(q)}
                    className={`p-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold ${copiedId === q.id ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 hover:border-amber-200'}`}
                    title="Copy question details"
                  >
                    {copiedId === q.id ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs uppercase lg:hidden">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        <span className="text-xs uppercase lg:hidden">Copy Details</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => handleCopyLink(q)}
                    className={`p-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold ${copiedLinkId === q.id ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200'}`}
                    title="Copy link to this question"
                  >
                    {copiedLinkId === q.id ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs uppercase lg:hidden">Linked</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.102 1.101" />
                        </svg>
                        <span className="text-xs uppercase lg:hidden">Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionList;