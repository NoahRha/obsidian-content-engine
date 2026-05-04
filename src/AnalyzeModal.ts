import { App, MarkdownRenderer, Modal, Notice, TFile } from "obsidian";
import type ContentEnginePlugin from "./main";
import { PublishResult, PublishResultModal } from "./PublishResultModal";

interface AnalyzeResponse {
  insights: string[];
  summary: string;
}

interface BlogContent {
  title: string;
  content: string;
  tags: string[];
}

interface VideoContent {
  title: string;
  script: string;
  description: string;
  tags: string[];
}

interface SocialContent {
  caption: string;
  hashtags: string[];
}

type TabId = "blog" | "video" | "threads" | "instagram" | "twitter" | "github";
type PublishStatus = "pending" | "publishing" | "published" | "error";

const TAB_LABELS: Record<TabId, string> = {
  blog: "Blog",
  video: "YouTube",
  threads: "Threads",
  instagram: "Instagram",
  twitter: "Twitter/X",
  github: "GitHub",
};

export class AnalyzeModal extends Modal {
  private plugin: ContentEnginePlugin;
  private files: TFile[] = [];
  private selectedPaths = new Set<string>();
  private analyzeResult: AnalyzeResponse | null = null;
  private blog: BlogContent | null = null;
  private video: VideoContent | null = null;
  private socials: Partial<Record<"threads" | "instagram" | "twitter" | "github", SocialContent>> = {};
  private statuses: Record<TabId, PublishStatus> = {
    blog: "pending",
    video: "pending",
    threads: "pending",
    instagram: "pending",
    twitter: "pending",
    github: "pending",
  };
  private activeTab: TabId = "blog";

  constructor(app: App, plugin: ContentEnginePlugin, initialFile?: TFile | null) {
    super(app);
    this.plugin = plugin;
    if (initialFile) {
      this.selectedPaths.add(initialFile.path);
    }
  }

  onOpen(): void {
    this.files = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
    this.contentEl.addClass("content-engine-modal");
    this.renderFilePicker();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderFilePicker(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Content Engine" });
    contentEl.createEl("p", { text: "분석할 노트를 선택하세요. 여러 개를 함께 보낼 수 있습니다." });

    const toolbar = contentEl.createEl("div", { cls: "content-engine-toolbar" });
    toolbar.createEl("button", { text: "전체 선택" }).addEventListener("click", () => {
      this.files.forEach((file) => this.selectedPaths.add(file.path));
      this.renderFilePicker();
    });
    toolbar.createEl("button", { text: "선택 해제" }).addEventListener("click", () => {
      this.selectedPaths.clear();
      this.renderFilePicker();
    });

    const fileList = contentEl.createEl("div", { cls: "content-engine-file-list" });
    if (this.files.length === 0) {
      fileList.createEl("p", { text: "Vault에서 Markdown 파일을 찾지 못했습니다." });
    }

    for (const file of this.files) {
      const row = fileList.createEl("label", { cls: "content-engine-file-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selectedPaths.has(file.path);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedPaths.add(file.path);
        } else {
          this.selectedPaths.delete(file.path);
        }
      });
      row.createSpan({ text: file.path });
    }

    const analyzeButton = contentEl.createEl("button", { text: "Analyze", cls: "mod-cta content-engine-primary" });
    analyzeButton.disabled = this.files.length === 0;
    analyzeButton.addEventListener("click", () => void this.analyzeSelectedNotes());
  }

  private async analyzeSelectedNotes(): Promise<void> {
    const selectedFiles = this.files.filter((file) => this.selectedPaths.has(file.path));
    if (selectedFiles.length === 0) {
      new Notice("분석할 노트를 하나 이상 선택하세요.");
      return;
    }

    this.renderLoading("노트를 분석하는 중...");

    try {
      const notes = await Promise.all(
        selectedFiles.map(async (file) => ({
          filename: file.path,
          content: await this.app.vault.read(file),
        }))
      );

      const model = this.getModel();
      this.analyzeResult = await this.request<AnalyzeResponse>("/api/analyze", { notes, model });
      await this.generateAll();
      this.renderResults();
    } catch (error) {
      this.showError(error, "분석 중 오류가 발생했습니다.");
      this.renderFilePicker();
    }
  }

  private getModel(): string {
    const { selectedModel, customModel } = this.plugin.settings;
    return selectedModel === "custom" ? customModel : selectedModel;
  }

  private async generateAll(): Promise<void> {
    if (!this.analyzeResult) return;
    this.renderLoading("콘텐츠를 생성하는 중...");

    const base = {
      insights: this.analyzeResult.insights,
      summary: this.analyzeResult.summary,
      model: this.getModel(),
    };

    const socialPlatforms: Array<"threads" | "instagram" | "twitter" | "github"> = [];
    if (this.plugin.settings.platforms.threads) socialPlatforms.push("threads");
    if (this.plugin.settings.platforms.instagram) socialPlatforms.push("instagram");
    if (this.plugin.settings.platforms.twitter) socialPlatforms.push("twitter");
    if (this.plugin.settings.platforms.github) socialPlatforms.push("github");

    try {
      const tasks: Promise<any>[] = [];
      
      if (this.blog === null) {
        tasks.push(
          this.request<BlogContent>("/api/generate/blog", {
            ...base,
            template: this.plugin.settings.templates.blog,
          }).then((result) => (this.blog = result))
        );
      }
      
      if (this.plugin.settings.platforms.youtube && this.video === null) {
        tasks.push(
          this.request<VideoContent>("/api/generate/video", {
            ...base,
            template: this.plugin.settings.templates.youtube,
          }).then((result) => (this.video = result))
        );
      }

      for (const platform of socialPlatforms) {
        if (this.socials[platform] === undefined) {
          tasks.push(
            this.request<SocialContent>("/api/generate/social", {
              ...base,
              platform,
              template: this.plugin.settings.templates[platform],
            }).then((content) => {
              this.socials[platform] = content;
            })
          );
        }
      }

      await Promise.all(tasks);
    } catch (error) {
      this.showError(error, "콘텐츠 생성 중 오류가 발생했습니다.");
      throw error;
    }
  }

  private renderResults(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "분석 결과" });

    if (!this.analyzeResult) return;

    const summary = contentEl.createEl("div", { cls: "content-engine-summary" });
    summary.createEl("h3", { text: "요약" });
    summary.createEl("p", { text: this.analyzeResult.summary });

    const details = contentEl.createEl("details", { cls: "content-engine-insights" });
    details.createEl("summary", { text: `인사이트 ${this.analyzeResult.insights.length}개` });
    const list = details.createEl("ol");
    for (const insight of this.analyzeResult.insights) {
      list.createEl("li", { text: insight });
    }

    const tabs = contentEl.createEl("div", { cls: "content-engine-tabs" });
    (Object.keys(TAB_LABELS) as TabId[]).forEach((tab) => {
      const button = tabs.createEl("button", {
        text: TAB_LABELS[tab],
        cls: tab === this.activeTab ? "is-active" : "",
      });
      button.addEventListener("click", () => {
        this.activeTab = tab;
        this.renderResults();
      });
    });

    const tabContainer = contentEl.createEl("div", { cls: "content-engine-tab-panel" });
    void this.renderTab(tabContainer, this.activeTab);

    const bottom = contentEl.createEl("div", { cls: "content-engine-bottom-bar" });
    bottom.createEl("button", { text: "Publish All", cls: "mod-cta" }).addEventListener("click", () => void this.publishAll());
  }

  private async renderTab(container: HTMLElement, tab: TabId): Promise<void> {
    container.empty();
    const header = container.createEl("div", { cls: "content-engine-tab-header" });
    header.createEl("h3", { text: TAB_LABELS[tab] });
    header.createSpan({ cls: `content-engine-badge content-engine-badge-${this.statuses[tab]}`, text: this.statuses[tab] });

    const preview = container.createEl("div", { cls: "content-engine-preview" });
    if (tab === "blog") {
      await this.renderBlog(preview);
    } else if (tab === "video") {
      this.renderVideo(preview);
    } else {
      this.renderSocial(preview, tab as "threads" | "instagram" | "twitter" | "github");
    }

    const actions = container.createEl("div", { cls: "content-engine-actions" });
    actions.createEl("button", { text: "Regenerate" }).addEventListener("click", () => void this.regenerate(tab));
    actions.createEl("button", { text: "Publish", cls: "mod-cta" }).addEventListener("click", () => void this.publish(tab));
  }

  private async renderBlog(container: HTMLElement): Promise<void> {
    if (!this.blog) {
      container.createEl("p", { text: "블로그 콘텐츠가 아직 생성되지 않았습니다." });
      return;
    }
    container.createEl("h2", { text: this.blog.title });
    const tags = container.createEl("p", { cls: "content-engine-tags" });
    tags.setText(this.blog.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" "));
    const rendered = container.createEl("div", { cls: "content-engine-markdown" });
    await MarkdownRenderer.render(this.app, this.blog.content, rendered, "content-engine-blog.md", this.plugin);
  }

  private renderVideo(container: HTMLElement): void {
    if (!this.video) {
      container.createEl("p", { text: "유튜브 스크립트가 아직 생성되지 않았습니다." });
      return;
    }
    container.createEl("h2", { text: this.video.title });
    container.createEl("h4", { text: "Description" });
    container.createEl("p", { text: this.video.description });
    container.createEl("h4", { text: "Script" });
    container.createEl("pre", { text: this.video.script });
    container.createEl("p", { cls: "content-engine-tags", text: this.video.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ") });
  }

  private renderSocial(container: HTMLElement, platform: "threads" | "instagram" | "twitter" | "github"): void {
    const content = this.socials[platform];
    if (!content) {
      container.createEl("p", { text: `${TAB_LABELS[platform]} 콘텐츠가 아직 생성되지 않았습니다.` });
      return;
    }
    container.createEl("pre", { text: content.caption });
    container.createEl("p", { cls: "content-engine-tags", text: content.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ") });
  }

  private async regenerate(tab: TabId): Promise<void> {
    if (!this.analyzeResult) return;
    const base = {
      insights: this.analyzeResult.insights,
      summary: this.analyzeResult.summary,
      model: this.getModel(),
    };

    this.renderLoading(`${TAB_LABELS[tab]} 콘텐츠를 다시 생성하는 중...`);
    try {
      if (tab === "blog") {
        this.blog = await this.request<BlogContent>("/api/generate/blog", {
          ...base,
          template: this.plugin.settings.templates.blog,
        });
      } else if (tab === "video") {
        this.video = await this.request<VideoContent>("/api/generate/video", {
          ...base,
          template: this.plugin.settings.templates.youtube,
        });
      } else {
        this.socials[tab] = await this.request<SocialContent>("/api/generate/social", {
          ...base,
          platform: tab,
          template: this.plugin.settings.templates[tab],
        });
      }
      this.statuses[tab] = "pending";
      this.renderResults();
    } catch (error) {
      this.showError(error, "다시 생성 중 오류가 발생했습니다.");
      this.renderResults();
    }
  }

  private async publish(tab: TabId): Promise<PublishResult> {
    // 플랫폼 활성 여부 체크
    if (tab !== "blog" && tab !== "video") {
      const platformKey = tab as keyof typeof this.plugin.settings.platforms;
      if (!this.plugin.settings.platforms[platformKey]) {
        const result = { platform: tab, success: false, error: `${TAB_LABELS[tab]}는 비활성화된 플랫폼입니다.` };
        new Notice(result.error);
        return result;
      }
    }

    if (tab === "video" && !this.plugin.settings.platforms.youtube) {
      const result = { platform: tab, success: false, error: "YouTube는 비활성화된 플랫폼입니다." };
      new Notice(result.error);
      return result;
    }

    const content = this.getPublishContent(tab);
    if (!content) {
      const result = { platform: tab, success: false, error: "게시할 콘텐츠가 없습니다." };
      new Notice(result.error);
      return result;
    }

    this.statuses[tab] = "publishing";
    this.renderResults();

    try {
      const templateKey = tab === "video" ? "youtube" : tab;
      const result = await this.request<PublishResult>("/api/publish", {
        platform: tab,
        content,
        template: this.plugin.settings.templates[templateKey as keyof typeof this.plugin.settings.templates],
        model: this.getModel(),
      });
      this.statuses[tab] = result.success ? "published" : "error";
      this.renderResults();
      if (result.success) {
        new Notice(`${TAB_LABELS[tab]} 게시 완료`);
      } else {
        new Notice(result.error || `${TAB_LABELS[tab]} 게시 실패`);
      }
      return { ...result, platform: tab };
    } catch (error) {
      this.statuses[tab] = "error";
      this.renderResults();
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${TAB_LABELS[tab]} 게시 실패: ${message}`);
      return { platform: tab, success: false, error: message };
    }
  }

  private async publishAll(): Promise<void> {
    const tabs: TabId[] = [];
    
    if (this.blog) tabs.push("blog");
    if (this.video && this.plugin.settings.platforms.youtube) tabs.push("video");
    if (this.socials.threads && this.plugin.settings.platforms.threads) tabs.push("threads");
    if (this.socials.instagram && this.plugin.settings.platforms.instagram) tabs.push("instagram");
    if (this.socials.twitter && this.plugin.settings.platforms.twitter) tabs.push("twitter");
    if (this.socials.github && this.plugin.settings.platforms.github) tabs.push("github");

    if (tabs.length === 0) {
      new Notice("게시할 콘텐츠가 없습니다.");
      return;
    }

    const results: PublishResult[] = [];
    for (const tab of tabs) {
      results.push(await this.publish(tab));
    }
    new PublishResultModal(this.app, results).open();
  }

  private getPublishContent(tab: TabId): SocialContent | null {
    if (tab === "blog") {
      if (!this.blog) return null;
      return {
        caption: `# ${this.blog.title}\n\n${this.blog.content}`,
        hashtags: this.blog.tags,
      };
    }
    if (tab === "video") {
      if (!this.video) return null;
      return {
        caption: `${this.video.title}\n\n${this.video.description}\n\n${this.video.script}`,
        hashtags: this.video.tags,
      };
    }
    return this.socials[tab as "threads" | "instagram" | "twitter" | "github"] || null;
  }

  private renderLoading(message: string): void {
    this.contentEl.empty();
    const loading = this.contentEl.createEl("div", { cls: "content-engine-loading" });
    loading.createEl("h2", { text: message });
    loading.createEl("p", { text: "잠시만 기다려 주세요." });
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = this.plugin.settings.apiUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
    }

    return (await response.json()) as T;
  }

  private showError(error: unknown, fallback: string): void {
    const message = error instanceof Error ? error.message : String(error || fallback);
    new Notice(`${fallback}: ${message}`);
  }
}
