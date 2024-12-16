import { Editor, Plugin, MarkdownView, Menu, Notice } from 'obsidian';
import { CitationPluginSettings, DEFAULT_SETTINGS, Citation } from './types';
import { CitationModal } from './modal';
import { CitationSettingTab } from './settingTab';
import '../style/styles.css';

export default class CitationPlugin extends Plugin {
    settings: CitationPluginSettings;

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

    openCitationModal(editor: Editor) {
        const onSubmit = async (citation: Citation, editor: Editor) => {
            this.insertCitation(editor, citation.text);
            
            // 添加到历史记录
            if (!this.settings.citations.find(c => c.text === citation.text)) {
                if (!this.settings.history.includes(citation.text)) {
                    this.settings.history.unshift(citation.text);
                    // 限制历史记录数量
                    if (this.settings.history.length > this.settings.historyLimit) {
                        this.settings.history.pop();
                    }
                }
            }
            await this.saveSettings();      
        };

        new CitationModal(this.app, this.settings, editor, onSubmit).open();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        // 确保所有引用都有正确的顺序值
        this.settings.citations.forEach((citation, index) => {
            citation.order = index;
        });
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}