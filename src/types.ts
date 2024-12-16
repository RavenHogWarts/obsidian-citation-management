export interface Citation {
    text: string;      // 引用文本
    order: number;     // 排序索引
}

export interface CitationPluginSettings {
    citations: Citation[];
    history: string[];
    historyLimit: number;
}

export const DEFAULT_SETTINGS: CitationPluginSettings = {
    citations: [],
    history: [],
    historyLimit: 50
}

export function createCitation(text: string, order: number): Citation {
    return {
        text: text,
        order: order
    };
}

export function sortCitations(citations: Citation[]): Citation[] {
    return [...citations].sort((a, b) => a.order - b.order);
}