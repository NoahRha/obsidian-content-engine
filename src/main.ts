import { Notice, Plugin, TFile } from "obsidian";
import { AnalyzeModal } from "./AnalyzeModal";
import { ContentEngineSettings, ContentEngineSettingTab, DEFAULT_SETTINGS, detectVaultPath } from "./settings";

export default class ContentEnginePlugin extends Plugin {
  settings: ContentEngineSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("rocket", "Content Engine", () => {
      this.openAnalyzeModal();
    });

    this.addCommand({
      id: "analyze-and-publish",
      name: "Analyze & Publish",
      callback: () => this.openAnalyzeModal(),
    });

    this.addSettingTab(new ContentEngineSettingTab(this.app, this));
  }

  onunload(): void {
    // Obsidian automatically cleans up registered commands, ribbon icons, and settings tabs.
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.platforms = Object.assign({}, DEFAULT_SETTINGS.platforms, this.settings.platforms || {});
    if (!this.settings.vaultPath) {
      this.settings.vaultPath = detectVaultPath(this.app);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private openAnalyzeModal(): void {
    const currentFile = this.app.workspace.getActiveFile();
    if (currentFile && currentFile instanceof TFile && currentFile.extension === "md") {
      new AnalyzeModal(this.app, this, currentFile).open();
      return;
    }

    if (this.app.vault.getMarkdownFiles().length === 0) {
      new Notice("분석할 Markdown 노트가 없습니다.");
      return;
    }

    new AnalyzeModal(this.app, this, null).open();
  }
}
