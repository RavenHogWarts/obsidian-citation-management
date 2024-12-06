import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Menu, TFile } from 'obsidian';
import "../style/styles.css";

interface CitationPluginSettings {
    citations: string[];
}

const DEFAULT_SETTINGS: CitationPluginSettings = {
    citations: []
}

class CitationModal extends Modal {
    citations: string[];
    onSubmit: (citation: string) => void;
    customCitation = '';

    constructor(app: App, citations: string[], onSubmit: (citation: string) => void) {
        super(app);
        this.citations = citations;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl('h2', {text: 'Insert Citation'});

        // Predefined citations
        if (this.citations.length > 0) {
            contentEl.createEl('h3', {text: 'Saved Citations'});
            const citationList = contentEl.createEl('div', {cls: 'citation-list'});
            
            this.citations.forEach(citation => {
                const btn = citationList.createEl('button', {text: citation});
                btn.onclick = () => {
                    this.onSubmit(citation);
                    this.close();
                };
            });
        }

        // Custom citation input
        contentEl.createEl('h3', {text: 'Custom Citation'});
        const inputContainer = contentEl.createEl('div', {cls: 'citation-input'});
        
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter custom citation'
        });
        input.value = this.customCitation;
        input.oninput = (e) => {
            this.customCitation = (e.target as HTMLInputElement).value;
        };

        const submitBtn = inputContainer.createEl('button', {text: 'Insert'});
        submitBtn.onclick = () => {
            if (this.customCitation) {
                this.onSubmit(this.customCitation);
                this.close();
            }
        };
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export default class CitationPlugin extends Plugin {
    settings: CitationPluginSettings;

    async onload() {
        await this.loadSettings();

        // Add context menu event
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
                menu.addItem((item) => {
                    item
                        .setTitle("Insert Citation")
                        .setIcon("quote-glyph")
                        .onClick(() => {
                            new CitationModal(this.app, this.settings.citations, (citation) => {
                                const selectedText = editor.getSelection();
                                const currentLine = editor.getCursor().line;
                                const lineContent = editor.getLine(currentLine);
                                
                                if (selectedText) {
                                    // If text is selected, append citation after selection
                                    editor.replaceSelection(`${selectedText}[${citation}]`);
                                } else {
                                    // If no text is selected, append to end of current line
                                    editor.setLine(currentLine, `${lineContent}[${citation}]`);
                                }
                            }).open();
                        });
                });
            })
        );

        // Add settings tab
        this.addSettingTab(new CitationSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CitationSettingTab extends PluginSettingTab {
    plugin: CitationPlugin;

    constructor(app: App, plugin: CitationPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Citation Management Settings'});

        // Add new citation
        new Setting(containerEl)
            .setName('Add New Citation')
            .setDesc('Add a new citation to the list')
            .addText(text => text
                .setPlaceholder('Enter citation')
                .then(textComponent => {
                    const button = new Setting(containerEl)
                        .addButton(btn => btn
                            .setButtonText('Add')
                            .onClick(async () => {
                                const value = textComponent.getValue();
                                if (value) {
                                    this.plugin.settings.citations.push(value);
                                    await this.plugin.saveSettings();
                                    textComponent.setValue('');
                                    this.display();
                                }
                            }));
                }));

        // List existing citations
        containerEl.createEl('h3', {text: 'Saved Citations'});
        
        this.plugin.settings.citations.forEach((citation, index) => {
            new Setting(containerEl)
                .setName(citation)
                .addButton(btn => btn
                    .setButtonText('Delete')
                    .onClick(async () => {
                        this.plugin.settings.citations.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });
    }
}
