
import React, { useState, useMemo } from 'react';
import { ResearchGap, GapType } from '../types';

interface GapCardProps {
  gap: ResearchGap;
  allGaps: ResearchGap[];
}

const GapCard: React.FC<GapCardProps> = ({ gap, allGaps }) => {
  const [shareCopied, setShareCopied] = useState(false);
  const [justificationCopied, setJustificationCopied] = useState(false);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeIcon = (type: GapType) => {
    switch (type) {
      case GapType.METHODOLOGICAL: return '🔬';
      case GapType.THEORETICAL: return '💡';
      case GapType.EMPIRICAL: return '📊';
      case GapType.KNOWLEDGE: return '📚';
      case GapType.PRACTICAL: return '🛠️';
      default: return '❓';
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/gap/${gap.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleCopyJustification = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gap.justification).then(() => {
      setJustificationCopied(true);
      setTimeout(() => setJustificationCopied(false), 2000);
    });
  };

  // Logic to find related gaps
  const relatedGaps = useMemo(() => {
    if (!allGaps || allGaps.length <= 1) return [];

    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'research', 'study', 'into', 'analysis', 'gap', 'lack', 'of', 'in', 'on', 'a', 'to']);
    
    const getKeywords = (g: ResearchGap) => {
      const text = `${g.title} ${g.description}`.toLowerCase();
      return new Set(
        text.split(/\W+/)
          .filter(word => word.length > 3 && !stopWords.has(word))
      );
    };

    const currentKeywords = getKeywords(gap);

    return allGaps
      .filter(g => g.id !== gap.id)
      .map(g => {
        const otherKeywords = getKeywords(g);
        const intersection = new Set([...currentKeywords].filter(x => otherKeywords.has(x)));
        return { gap: g, score: intersection.size };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.gap);
  }, [gap, allGaps]);

  const scrollToGap = (targetId: string) => {
    const element = document.getElementById(`gap-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
      setTimeout(() => element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2'), 2000);
    }
  };

  return (
    <div 
      id={`gap-${gap.id}`}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            {getTypeIcon(gap.type)} {gap.type} Gap
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getImpactColor(gap.potentialImpact)}`}>
              {gap.potentialImpact} Impact
            </span>
          </div>
        </div>
        <button 
          onClick={handleShare}
          className={`p-2 rounded-lg transition-all flex items-center gap-1.5 ${shareCopied ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
          title="Share research gap"
        >
          {shareCopied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[10px] font-bold">COPIED</span>
            </>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="flex-1">
        <h4 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
          {gap.title}
        </h4>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          {gap.description}
        </p>
        
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 relative group/justification">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Scientific Justification</span>
              <button 
                onClick={handleCopyJustification}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${justificationCopied ? 'bg-emerald-100 text-emerald-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
                title="Copy justification"
              >
                {justificationCopied ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[9px] font-bold uppercase">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span className="text-[9px] font-bold uppercase">Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed pr-8">{gap.justification}</p>
          </div>
          
          {gap.suggestedMethods && gap.suggestedMethods.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Suggested Methodologies</span>
              <div className="flex flex-wrap gap-2">
                {gap.suggestedMethods.map((m, i) => (
                  <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-medium">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {relatedGaps.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Related Research Gaps</span>
          <div className="space-y-2">
            {relatedGaps.map((rg) => (
              <button
                key={rg.id}
                onClick={() => scrollToGap(rg.id)}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group/related"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px]">{getTypeIcon(rg.type)}</span>
                  <p className="text-[11px] font-bold text-slate-700 line-clamp-1 group-hover/related:text-indigo-600">{rg.title}</p>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">{rg.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GapCard;
