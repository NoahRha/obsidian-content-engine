import { App, FileSystemAdapter, PluginSettingTab, Setting } from "obsidian";
import type ContentEnginePlugin from "./main";

export interface PlatformSettings {
  instagram: boolean;
  threads: boolean;
  youtube: boolean;
  twitter: boolean;
  github: boolean;
}

export interface ContentEngineSettings {
  apiUrl: string;
  vaultPath: string;
  platforms: PlatformSettings;
  selectedModel: string;
  customModel: string;
  templates: {
    blog: string;
    instagram: string;
    threads: string;
    youtube: string;
    twitter: string;
    github: string;
  };
}

export const AVAILABLE_MODELS = [
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "claude-3-opus", name: "Claude 3 Opus" },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku", name: "Claude 3 Haiku" },
  { id: "deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek-coder", name: "DeepSeek Coder" },
  { id: "custom", name: "직접 입력" },
];

export const DEFAULT_SETTINGS: ContentEngineSettings = {
  apiUrl: "http://localhost:8000",
  vaultPath: "",
  platforms: {
    instagram: true,
    threads: true,
    youtube: true,
    twitter: true,
    github: true,
  },
  selectedModel: "gpt-4",
  customModel: "",
  templates: {
    blog: "{title}\n\n{content}\n\n#발행 #{tags}",
    instagram: "{title}\n\n{summary}\n\n#발행 #{tags}",
    threads: "{title}\n\n{content}\n\n{hashtags}",
    youtube: "{title}\n\n{description}\n\n{hashtags}",
    twitter: "{title}\n\n{summary}\n\n{hashtags}",
    github: "{title}\n\n{description}",
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

    containerEl.createEl("h3", { text: "AI 모델 설정" });

    new Setting(containerEl)
      .setName("LLM 모델")
      .setDesc("사용할 AI 모델을 선택합니다.")
      .addDropdown((dropdown) => {
        AVAILABLE_MODELS.forEach((model) => {
          dropdown.addOption(model.id, model.name);
        });
        dropdown
          .setValue(this.plugin.settings.selectedModel)
          .onChange(async (value) => {
            this.plugin.settings.selectedModel = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide custom model field
          });
      });

    if (this.plugin.settings.selectedModel === "custom") {
      new Setting(containerEl)
        .setName("상세 모델명")
        .setDesc("사용할 상세 모델명을 직접 입력합니다. (예: anthropic/claude-sonnet-4-6)")
        .addText((text) =>
          text
            .setPlaceholder("anthropic/claude-sonnet-4-6")
            .setValue(this.plugin.settings.customModel)
            .onChange(async (value) => {
              this.plugin.settings.customModel = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("연결 테스트")
      .setDesc("API 서버 연결 상태를 테스트합니다.")
      .addButton((button) => {
        button
          .setButtonText("테스트")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("테스트 중...");

            try {
              const baseUrl = this.plugin.settings.apiUrl.replace(/\/$/, "");
              const response = await fetch(`${baseUrl}/health`, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (response.ok) {
                const data = await response.json();
                button.setButtonText("연결 성공 ✓");
                button.removeCta();
                setTimeout(() => {
                  button.setButtonText("테스트");
                  button.setCta();
                  button.setDisabled(false);
                }, 3000);
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error) {
              button.setButtonText("연결 실패 ✗");
              button.removeCta();
              setTimeout(() => {
                button.setButtonText("테스트");
                button.setCta();
                button.setDisabled(false);
              }, 3000);
            }
          });
      });

    containerEl.createEl("h3", { text: "게시 플랫폼" });

    this.addPlatformToggle("threads", "Threads");
    this.addPlatformToggle("instagram", "Instagram");
    this.addPlatformToggle("youtube", "YouTube");
    this.addPlatformToggle("twitter", "Twitter/X");
    this.addPlatformToggle("github", "GitHub");

    containerEl.createEl("h3", { text: "플랫폼 연결 테스트" });

    this.addConnectionTest("threads", "Threads");
    this.addConnectionTest("instagram", "Instagram");
    this.addConnectionTest("youtube", "YouTube");
    this.addConnectionTest("twitter", "Twitter/X");
    this.addConnectionTest("github", "GitHub");

    containerEl.createEl("h3", { text: "게시 템플릿" });

    this.addTemplateEditor("instagram", "Instagram");
    this.addTemplateEditor("threads", "Threads");
    this.addTemplateEditor("youtube", "YouTube");
    this.addTemplateEditor("twitter", "Twitter/X");
    this.addTemplateEditor("github", "GitHub");

    this.addTemplateHelp();
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

  private addConnectionTest(platform: keyof PlatformSettings, label: string): void {
    new Setting(this.containerEl)
      .setName(`${label} 연결 테스트`)
      .setDesc(`${label} API 연결 상태를 테스트합니다.`)
      .addButton((button) => {
        button
          .setButtonText("테스트")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("테스트 중...");

            try {
              const baseUrl = this.plugin.settings.apiUrl.replace(/\/$/, "");
              const response = await fetch(
                `${baseUrl}/api/test/${platform}`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              if (response.ok) {
                const data = await response.json();
                button.setButtonText("연결 성공 ✓");
                button.removeCta();
                setTimeout(() => {
                  button.setButtonText("테스트");
                  button.setCta();
                  button.setDisabled(false);
                }, 3000);
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error) {
              button.setButtonText("연결 실패 ✗");
              button.removeCta();
              setTimeout(() => {
                button.setButtonText("테스트");
                button.setCta();
                button.setDisabled(false);
              }, 3000);
            }
          });
      });
  }

  private addTemplateEditor(platform: keyof PlatformSettings, label: string): void {
    const templateKey = platform as keyof typeof DEFAULT_SETTINGS.templates;

    new Setting(this.containerEl)
      .setName(`${label} 템플릿`)
      .setDesc(`${label} 게시물 템플릿입니다. {title}, {summary}, {content}, {description}, {hashtags}, {tags} 변수를 사용할 수 있습니다.`)
      .addTextArea((text) => {
        text
          .setPlaceholder(`{title}\n\n{summary}\n\n{hashtags}`)
          .setValue(this.plugin.settings.templates[templateKey] || "")
          .onChange(async (value) => {
            this.plugin.settings.templates[templateKey] = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
      });
  }

  private addTemplateHelp(): void {
    const helpDiv = this.containerEl.createEl("div", {
      cls: "template-help",
    });

    helpDiv.innerHTML = `
      <h4>📝 템플릿 변수</h4>
      <ul>
        <li><code>{title}</code> - 콘텐츠 제목</li>
        <li><code>{summary}</code> - 요약 텍스트</li>
        <li><code>{content}</code> - 전체 콘텐츠</li>
        <li><code>{description}</code> - 설명 텍스트</li>
        <li><code>{hashtags}</code> - 해시태그 목록 (예: #AI #옵시디언)</li>
        <li><code>{tags}</code> - 태그 목록 (쉼표로 구분)</li>
      </ul>
      <p><small>💡 각 플랫폼에 맞게 템플릿을 커스터마이즈할 수 있습니다.</small></p>
    `;

    // Add CSS styling for the help section
    const style = document.createElement("style");
    style.textContent = `
      .template-help {
        background: var(--background-secondary);
        padding: 16px;
        border-radius: 8px;
        margin: 12px 0;
      }
      .template-help h4 {
        margin: 0 0 8px 0;
        color: var(--text-accent);
      }
      .template-help ul {
        margin: 8px 0;
        padding-left: 20px;
      }
      .template-help li {
        margin: 4px 0;
      }
      .template-help code {
        background: var(--background-primary);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      }
    `;
    this.containerEl.appendChild(style);
  }
}
