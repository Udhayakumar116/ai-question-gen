
export enum GapType {
  METHODOLOGICAL = 'Methodological',
  THEORETICAL = 'Theoretical',
  EMPIRICAL = 'Empirical',
  PRACTICAL = 'Practical',
  KNOWLEDGE = 'Knowledge'
}

export interface ResearchGap {
  id: string;
  title: string;
  description: string;
  type: GapType;
  justification: string;
  potentialImpact: 'High' | 'Medium' | 'Low';
  suggestedMethods: string[];
}

export interface ResearchQuestion {
  id: string;
  question: string;
  rationale: string;
  connectedGapId: string;
  suggestedAction: string;
}

export interface ConceptNode {
  id: string;
  group: number;
  val: number;
}

export interface ConceptLink {
  source: string;
  target: string;
}

export interface AnalysisResult {
  gaps: ResearchGap[];
  concepts: { nodes: ConceptNode[]; links: ConceptLink[] };
  saturationData: { name: string; saturation: number; potential: number }[];
  summary: string;
  questions?: ResearchQuestion[];
}

export interface UploadedFile {
  name: string;
  type: string;
  data: string; // Base64 for images or raw text for PPTX/PDF
  preview?: string;
}

export interface SavedAnalysis {
  id: string;
  timestamp: number;
  title: string;
  result: AnalysisResult;
}
