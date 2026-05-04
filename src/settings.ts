import { App, FileSystemAdapter, PluginSettingTab, Setting } from "obsidian";
import type ContentEnginePlugin from "./main";

export interface PlatformSettings {
  facebook: boolean;
  instagram: boolean;
  threads: boolean;
  youtube: boolean;
}

export interface ContentEngineSettings {
  apiUrl: string;
  vaultPath: string;
  platforms: PlatformSettings;
}

export const DEFAULT_SETTINGS: ContentEngineSettings = {
  apiUrl: "http://localhost:8000",
  vaultPath: "",
  platforms: {
    facebook: true,
    instagram: true,
    threads: true,
    youtube: true,
  },
};

export function detectVaultPath(app: App): string {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return "";
}

export class ContentEngineSettingTab extends PluginSettingTab {
  plugin: ContentEnginePlugin;

  constructor(app: App, plugin: ContentEnginePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Content Engine 설정" });

    new Setting(containerEl)
      .setName("API URL")
      .setDesc("로컬 Content Engine 웹 서비스 주소")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8000")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim() || DEFAULT_SETTINGS.apiUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Vault 경로")
      .setDesc("현재 옵시디언 vault 경로입니다. 비워두면 자동 감지합니다.")
      .addText((text) =>
        text
          .setPlaceholder(detectVaultPath(this.app) || "자동 감지 불가")
          .setValue(this.plugin.settings.vaultPath)
          .onChange(async (value) => {
            this.plugin.settings.vaultPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "게시 플랫폼" });

    this.addPlatformToggle("threads", "Threads");
    this.addPlatformToggle("instagram", "Instagram");
    this.addPlatformToggle("facebook", "Facebook");
    this.addPlatformToggle("youtube", "YouTube");
  }

  private addPlatformToggle(platform: keyof PlatformSettings, label: string): void {
    new Setting(this.containerEl)
      .setName(label)
      .setDesc(`${label} 콘텐츠 생성/게시 기능 사용`)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.platforms[platform])
          .onChange(async (value) => {
            this.plugin.settings.platforms[platform] = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
