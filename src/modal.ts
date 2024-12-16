import { App, Editor, Modal } from 'obsidian';
import { CitationPluginSettings, Citation, createCitation } from './types';

export class CitationModal extends Modal {
    settings: CitationPluginSettings;
    onSubmit: (citation: Citation, editor: Editor) => void;
    customCitation = '';
    suggestionContainer: HTMLDivElement;
    editor: Editor;

    constructor(app: App, settings: CitationPluginSettings, editor: Editor, onSubmit: (citation: Citation, editor: Editor) => void) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
        this.editor = editor;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('obsidian-citation-plugin-modal');
        contentEl.createEl('h2', {text: '插入引用'});

        // 带有浮动建议的输入框
        const inputContainer = contentEl.createEl('div', {cls: 'citation-input-container'});
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: '输入引用文本或搜索'
        });
        input.value = this.customCitation;

        // 创建建议容器
        this.suggestionContainer = inputContainer.createEl('div', {
            cls: 'citation-suggestions'
        });
        this.suggestionContainer.style.display = 'none';

        // 处理输入事件
        input.onfocus = () => {
            this.updateSuggestions(this.customCitation);
        };

        input.onblur = () => {
            // 使用setTimeout让点击建议项的事件能够先触发
            setTimeout(() => {
                this.suggestionContainer.style.display = 'none';
            }, 200);
        };

        input.oninput = (e) => {
            const target = e.target as HTMLInputElement;
            this.customCitation = target.value;
            this.updateSuggestions(target.value);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter' && this.customCitation) {
                e.preventDefault();
                const citation = createCitation(this.customCitation, this.settings.citations.length);
                this.onSubmit(citation, this.editor);
                this.close();
            }
        };

        // 可折叠的已保存引用部分
        if (this.settings.citations.length > 0) {
            const citationsSection = contentEl.createEl('div', {cls: 'citations-section'});
            
            // 创建可折叠的标题
            const header = citationsSection.createEl('div', {cls: 'citations-header'});
            const collapseIcon = header.createEl('span', {cls: 'collapse-icon', text: '▼'});
            header.createEl('span', {text: '已保存的引用'});
            
            // 创建可折叠的内容
            const citationsList = citationsSection.createEl('div', {cls: 'citations-list'});
            
            this.settings.citations.forEach(citation => {
                const citationItem = citationsList.createEl('div', {
                    cls: 'citation-item',
                    text: citation.text
                });
                citationItem.onclick = () => {
                    this.onSubmit(citation, this.editor);
                    this.close();
                };
            });

            header.onclick = () => {
                collapseIcon.classList.toggle('collapsed');
                citationsList.style.display = collapseIcon.classList.contains('collapsed') ? 'none' : 'block';
            };
        }
    }

    updateSuggestions(inputValue: string) {
        this.suggestionContainer.empty();

        // 当输入为空时，显示所有历史记录
        const matches = inputValue 
            ? this.settings.history.filter(text => text.toLowerCase().includes(inputValue.toLowerCase()))
            : this.settings.history;

        if (matches.length === 0) {
            this.suggestionContainer.style.display = 'none';
            return;
        }

        this.suggestionContainer.style.display = 'block';
        matches.forEach(text => {
            const suggestion = this.suggestionContainer.createEl('div', {
                text: text,
                cls: 'citation-suggestion'
            });
            suggestion.onclick = () => {
                const citation = createCitation(text, this.settings.citations.length);
                this.onSubmit(citation, this.editor);
                this.close();
            };
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}