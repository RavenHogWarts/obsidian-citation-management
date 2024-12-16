import { App, PluginSettingTab, Setting } from 'obsidian';
import CitationPlugin from './main';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs';
import { Citation, createCitation } from './types';

export class CitationSettingTab extends PluginSettingTab {
    plugin: CitationPlugin;
    citationListEl: HTMLElement;

    constructor(app: App, plugin: CitationPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.addClass('obsidian-citation-plugin-settings');
        containerEl.createEl('h2', {text: '引用管理设置'});

        new Setting(containerEl)
            .setName('历史记录数量限制')
            .setDesc('设置要保存的最大历史记录数量')
            .addText(text => text
                .setValue(this.plugin.settings.historyLimit.toString())
                .onChange(async (value) => {
                    const limit = parseInt(value);
                    if (!isNaN(limit) && limit > 0) {
                        this.plugin.settings.historyLimit = limit;
                        // 如果当前历史记录超过新的限制，裁剪掉多余的
                        if (this.plugin.settings.history.length > limit) {
                            this.plugin.settings.history = this.plugin.settings.history.slice(0, limit);
                        }
                        await this.plugin.saveSettings();
                    }
                }));

        // 添加新引用的输入框
        new Setting(containerEl)
            .setName('添加新引用')
            .setDesc('输入新的引用并点击添加')
            .addText(text => text
                .setPlaceholder('输入引用文本')
                .onChange(async (value) => {
                    // 实时验证可以在这里添加
                }))
            .addButton(button => button
                .setButtonText('添加')
                .onClick(async () => {
                    const input = containerEl.querySelector('input');
                    if (input && input.value) {
                        const citation = createCitation(
                            input.value,
                            this.plugin.settings.citations.length
                        );
                        this.plugin.settings.citations.push(citation);
                        await this.plugin.saveSettings();
                        input.value = '';
                        this.display();
                    }
                }));

        // 引用列表设置
        const citationsEl = containerEl.createEl('div', { cls: 'citations-section' });
        
        // 创建可折叠的标题
        const citationsHeader = citationsEl.createEl('div', { cls: 'section-header' });
        citationsHeader.createEl('span', { cls: 'collapse-icon', text: '▼' });
        citationsHeader.createEl('h3', { text: '已保存的引用' });
        
        const citationsContent = citationsEl.createEl('div', { cls: 'section-content' });

        // 添加折叠功能
        citationsHeader.onclick = () => {
            citationsHeader.classList.toggle('collapsed');
            citationsContent.style.display = citationsHeader.classList.contains('collapsed') ? 'none' : 'block';
        };

        // 创建可排序的引用列表
        this.citationListEl = citationsContent.createEl('div', {
            cls: 'citation-list sortable-list'
        });

        if (this.plugin.settings.citations.length === 0) {
            this.citationListEl.createEl('div', {
                cls: 'citation-empty',
                text: '没有保存的引用'
            });
        } else {
            this.plugin.settings.citations.forEach((citation, index) => {
                const itemEl = this.createCitationItem(citation, index);
                this.citationListEl.appendChild(itemEl);
            });

            // 初始化拖拽排序
            this.initSortable();
        }

        // 历史记录部分
        this.displayHistorySection(containerEl);
    }

    private createCitationItem(citation: Citation, index: number): HTMLElement {
        const itemEl = createEl('div', {
            cls: 'citation-item sortable-item',
            attr: { 'data-index': String(index) }
        });

        // 创建一个容器来包含拖动手柄和文本
        const contentContainer = itemEl.createEl('div', {
            cls: 'citation-content'
        });

        // 拖动手柄
        contentContainer.createEl('div', {
            cls: 'drag-handle',
            text: '⋮⋮'
        });

        // 引用文本
        contentContainer.createEl('div', {
            cls: 'citation-text',
            text: citation.text
        });

        // 删除按钮
        const deleteBtn = itemEl.createEl('button', {
            cls: 'citation-delete-btn',
            text: '删除'
        });
        
        deleteBtn.onclick = async () => {
            this.plugin.settings.citations.splice(index, 1);
            // 更新剩余引用的顺序
            this.plugin.settings.citations.forEach((c, i) => {
                c.order = i;
            });
            await this.plugin.saveSettings();
            this.display();
        };

        return itemEl;
    }

    private initSortable() {
        if (!this.citationListEl) return;
        
        new Sortable(this.citationListEl, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: async (evt: SortableEvent) => {
                const citations = this.plugin.settings.citations;
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;
                
                if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
                    // 更新数组顺序
                    const [movedItem] = citations.splice(oldIndex, 1);
                    citations.splice(newIndex, 0, movedItem);
                    
                    // 更新所有项的顺序
                    citations.forEach((citation, index) => {
                        citation.order = index;
                    });
                    
                    // 保存更新后的设置
                    await this.plugin.saveSettings();
                }
            }
        });
    }

    private displayHistorySection(containerEl: HTMLElement) {
        const historyEl = containerEl.createEl('div', { cls: 'history-section' });
        
        // 创建可折叠的标题
        const historyHeader = historyEl.createEl('div', { cls: 'section-header' });
        historyHeader.createEl('span', { cls: 'collapse-icon', text: '▼' });
        historyHeader.createEl('h3', { text: '历史记录' });

        const historyContent = historyEl.createEl('div', { cls: 'section-content' });

        // 添加折叠功能
        historyHeader.onclick = () => {
            historyHeader.classList.toggle('collapsed');
            historyContent.style.display = historyHeader.classList.contains('collapsed') ? 'none' : 'block';
        };

        // 清空历史记录按钮
        if (this.plugin.settings.history.length > 0) {
            new Setting(historyContent)
                .addButton(button => button
                    .setButtonText('清空历史记录')
                    .onClick(async () => {
                        this.plugin.settings.history = [];
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        }

        if (this.plugin.settings.history.length === 0) {
            historyContent.createEl('div', {
                cls: 'citation-empty',
                text: '没有历史记录'
            });
            return;
        }

        const historyList = historyContent.createEl('div', {cls: 'history-list'});
        
        this.plugin.settings.history.forEach((text, index) => {
            const historyContainer = historyList.createEl('div', {cls: 'history-container'});
            
            historyContainer.createEl('span', {
                text: text,
                cls: 'history-text'
            });

            // 删除按钮
            const deleteButton = historyContainer.createEl('button', {
                text: '删除',
                cls: 'history-delete-btn'
            });
            
            deleteButton.onclick = async () => {
                this.plugin.settings.history.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            };

            // 添加到引用按钮
            const addButton = historyContainer.createEl('button', {
                text: '添加到引用',
                cls: 'history-add-btn'
            });

            addButton.onclick = async () => {
                const citation = createCitation(
                    text,
                    this.plugin.settings.citations.length
                );
                this.plugin.settings.citations.push(citation);
                await this.plugin.saveSettings();
                this.display();
            };
        });
    }
}