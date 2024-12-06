import { App, Editor, Modal, Plugin, PluginSettingTab, Menu, MarkdownView, Notice } from 'obsidian';
import "../style/styles.css";

interface CitationPluginSettings {
    citations: string[];
    history: string[];
}

const DEFAULT_SETTINGS: CitationPluginSettings = {
    citations: [],
    history: []
}

class CitationModal extends Modal {
    citations: string[];
    history: string[];
    onSubmit: (citation: string, editor: Editor) => void;
    customCitation = '';
    suggestionContainer: HTMLDivElement;
    editor: Editor;

    constructor(app: App, settings: CitationPluginSettings, editor: Editor, onSubmit: (citation: string, editor: Editor) => void) {
        super(app);
        this.citations = settings.citations;
        this.history = settings.history;
        this.onSubmit = onSubmit;
        this.editor = editor;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('obsidian-citation-plugin');
        contentEl.createEl('h2', {text: 'Insert Citation'});

        // Input field with floating suggestions
        const inputContainer = contentEl.createEl('div', {cls: 'citation-input-container'});
        
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter citation or type to search'
        });
        input.value = this.customCitation;

        // Floating suggestion container
        this.suggestionContainer = inputContainer.createEl('div', {
            cls: 'citation-suggestions'
        });
        this.suggestionContainer.style.display = 'none';

        // 计算建议框的位置
        const updateSuggestionPosition = () => {
            const rect = input.getBoundingClientRect();
            this.suggestionContainer.style.top = rect.bottom + 'px';
            this.suggestionContainer.style.left = rect.left + 'px';
            this.suggestionContainer.style.width = rect.width + 'px';
        };

        input.oninput = (e) => {
            const value = (e.target as HTMLInputElement).value;
            this.customCitation = value;
            this.updateSuggestions(value);
            updateSuggestionPosition();
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter' && this.customCitation) {
                e.preventDefault();
                this.onSubmit(this.customCitation, this.editor);
                this.close();
            }
        };

        // Collapsible saved citations section
        if (this.citations.length > 0) {
            const citationsSection = contentEl.createEl('div', {cls: 'citations-section'});
            
            // Create collapsible header
            const header = citationsSection.createEl('div', {cls: 'citations-header'});
            const collapseIcon = header.createEl('span', {cls: 'collapse-icon'});
            header.createEl('span', {text: 'Saved Citations'});
            
            // Create collapsible content
            const citationsList = citationsSection.createEl('div', {cls: 'citations-list'});
            
            this.citations.forEach(citation => {
                const citationItem = citationsList.createEl('div', {
                    cls: 'citation-item',
                    text: citation
                });
                citationItem.onclick = () => {
                    this.onSubmit(citation, this.editor);
                    this.close();
                };
            });

            // Toggle collapse on header click
            let isCollapsed = false;
            header.onclick = () => {
                isCollapsed = !isCollapsed;
                citationsList.style.display = isCollapsed ? 'none' : 'block';
                collapseIcon.classList.toggle('collapsed', isCollapsed);
            };
        }
    }

    updateSuggestions(inputValue: string) {
        this.suggestionContainer.empty();
        
        if (!inputValue) {
            this.suggestionContainer.style.display = 'none';
            return;
        }

        // Only show history items in suggestions
        const matches = this.history.filter(citation => 
            citation.toLowerCase().includes(inputValue.toLowerCase())
        );

        if (matches.length === 0) {
            this.suggestionContainer.style.display = 'none';
            return;
        }

        this.suggestionContainer.style.display = 'block';
        matches.forEach(match => {
            const suggestion = this.suggestionContainer.createEl('div', {
                text: match,
                cls: 'citation-suggestion'
            });
            suggestion.onclick = () => {
                this.customCitation = match;
                this.onSubmit(match, this.editor);
                this.close();
            };
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export default class CitationPlugin extends Plugin {
    settings: CitationPluginSettings;

    // 通用的排序函数
    public sortCitations(citations: string[]): string[] {
        return [...citations].sort((a, b) => {
            // 移除特殊字符进行比较
            const cleanA = a.replace(/[^\w\s\u4e00-\u9fa5]/g, '').toLowerCase();
            const cleanB = b.replace(/[^\w\s\u4e00-\u9fa5]/g, '').toLowerCase();
            
            if (cleanA === cleanB) {
                // 如果清理后相同，使用原始字符串比较
                return a.localeCompare(b, 'zh-CN');
            }
            return cleanA.localeCompare(cleanB, 'zh-CN');
        });
    }

    async onload() {
        await this.loadSettings();

        // 添加引用命令
        this.addCommand({
            id: 'insert-citation',
            name: '插入引用',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                try {
                    // 检查是否在编辑模式
                    if (!view.file) {
                        new Notice('请先打开一个文件');
                        return;
                    }
                    this.openCitationModal(editor);
                } catch (error) {
                    console.error('执行命令时发生错误:', error);
                    new Notice('执行命令时发生错误');
                }
            }
        });

        // 添加右键菜单
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
                if (!view.file) return;

                menu.addItem((item) => {
                    item
                        .setTitle("插入引用")
                        .setIcon("quote-glyph")
                        .onClick(() => {
                            this.openCitationModal(editor);
                        });
                });
            })
        );

        // 添加设置面板
        this.addSettingTab(new CitationSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private insertCitation(editor: Editor, citation: string) {
        try {
            if (!editor || !editor.getCursor()) {
                new Notice('无法获取编辑器光标位置');
                return;
            }

            const selectedText = editor.getSelection();
            const cursor = editor.getCursor();
            const lineContent = editor.getLine(cursor.line);

            if (selectedText) {
                // 处理选中的文本
                const lines = selectedText.split('\n');
                const processedLines = lines.map(line => 
                    // 只在非空行后添加引用
                    line.trim() ? line + `[${citation}]` : line
                );
                editor.replaceSelection(processedLines.join('\n'));
            } else {
                // 没有选中文本时，在当前行末插入引用
                const newLine = lineContent + `[${citation}]`;
                
                editor.transaction({
                    changes: [{
                        from: { line: cursor.line, ch: 0 },
                        to: { line: cursor.line, ch: lineContent.length },
                        text: newLine
                    }]
                });

                // 将光标移动到行末
                editor.setCursor({ line: cursor.line, ch: newLine.length });
            }
        } catch (error) {
            console.error('插入引用时发生错误:', error);
            new Notice('插入引用时发生错误');
        }
    }

    private openCitationModal(editor: Editor) {
        try {
            if (!editor) {
                new Notice('无法获取编辑器');
                return;
            }

            // 对预设引用进行排序后再传入 Modal
            const sortedCitations = this.sortCitations(this.settings.citations);
            const modalSettings = {
                ...this.settings,
                citations: sortedCitations
            };

            new CitationModal(this.app, modalSettings, editor, async (citation, activeEditor) => {
                try {
                    if (!this.settings.citations.includes(citation)) {
                        if (!this.settings.history.includes(citation)) {
                            this.settings.history.push(citation);
                        } else {
                            const index = this.settings.history.indexOf(citation);
                            this.settings.history.splice(index, 1);
                            this.settings.history.push(citation);
                        }
                        await this.saveSettings();
                    }
                    
                    this.insertCitation(activeEditor, citation);
                } catch (error) {
                    console.error('处理引用时发生错误:', error);
                    new Notice('处理引用时发生错误');
                }
            }).open();
        } catch (error) {
            console.error('打开引用对话框时发生错误:', error);
            new Notice('打开引用对话框时发生错误');
        }
    }
}

class CitationSettingTab extends PluginSettingTab {
    plugin: CitationPlugin;

    constructor(app: App, plugin: CitationPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('obsidian-citation-plugin');
        containerEl.addClass('citation-settings');

        containerEl.createEl('h2', { text: '引用管理设置' });

        // 预设引用区域
        const citationsHeader = containerEl.createEl('div', { cls: 'citation-header' });
        citationsHeader.createEl('h3', { text: '预设引用' });

        // 添加引用区域
        const addCitationContainer = containerEl.createEl('div', { cls: 'add-citation' });
        const input = addCitationContainer.createEl('input', {
            type: 'text',
            placeholder: '输入引用内容'
        });

        const addButton = addCitationContainer.createEl('button', {
            text: '添加',
            cls: 'citation-btn'
        });
        addButton.onclick = async () => {
            const value = input.value;
            if (value.trim() && !this.plugin.settings.citations.includes(value)) {
                this.plugin.settings.citations.push(value);
                this.plugin.settings.citations = this.plugin.sortCitations(this.plugin.settings.citations);
                await this.plugin.saveSettings();
                input.value = '';
                this.display();
            }
        };

        // 预设引用列表
        const citationList = containerEl.createEl('div', { cls: 'citation-list' });
        this.plugin.sortCitations(this.plugin.settings.citations)
            .forEach(citation => {
                const citationItem = citationList.createEl('div', { cls: 'setting-item' });
                citationItem.createEl('div', { 
                    cls: 'setting-item-name',
                    text: citation 
                });
                const control = citationItem.createEl('div', { cls: 'setting-item-control' });
                const deleteBtn = control.createEl('button', {
                    cls: 'citation-btn citation-delete-btn',
                    text: '删除'
                });
                deleteBtn.onclick = async () => {
                    const index = this.plugin.settings.citations.indexOf(citation);
                    if (index > -1) {
                        this.plugin.settings.citations.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }
                };
            });

        // 历史记录区域
        const historyHeader = containerEl.createEl('div', { cls: 'citation-header' });
        historyHeader.createEl('h3', { text: '历史记录' });
        
        if (this.plugin.settings.history.length > 0) {
            const clearBtn = historyHeader.createEl('button', {
                cls: 'citation-btn citation-delete-btn',
                text: '清空历史记录'
            });
            clearBtn.onclick = async () => {
                this.plugin.settings.history = [];
                await this.plugin.saveSettings();
                this.display();
            };
        }

        // 历史记录列表
        const historyList = containerEl.createEl('div', { cls: 'citation-list' });
        this.plugin.settings.history.forEach(citation => {
            const historyItem = historyList.createEl('div', { cls: 'setting-item' });
            historyItem.createEl('div', {
                cls: 'setting-item-name',
                text: citation
            });
            const control = historyItem.createEl('div', { cls: 'setting-item-control' });
            
            // 保存为预设按钮
            const saveBtn = control.createEl('button', {
                cls: 'citation-btn',
                text: '保存为预设'
            });
            saveBtn.onclick = async () => {
                if (!this.plugin.settings.citations.includes(citation)) {
                    this.plugin.settings.citations.push(citation);
                    const index = this.plugin.settings.history.indexOf(citation);
                    if (index > -1) {
                        this.plugin.settings.history.splice(index, 1);
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }
            };

            // 删除按钮
            const deleteBtn = control.createEl('button', {
                cls: 'citation-btn citation-delete-btn',
                text: '删除'
            });
            deleteBtn.onclick = async () => {
                const index = this.plugin.settings.history.indexOf(citation);
                if (index > -1) {
                    this.plugin.settings.history.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                }
            };
        });
    }
}