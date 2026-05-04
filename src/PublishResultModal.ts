import { App, Modal } from "obsidian";

export interface PublishResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export class PublishResultModal extends Modal {
  private results: PublishResult[];

  constructor(app: App, results: PublishResult[]) {
    super(app);
    this.results = results;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("content-engine-result-modal");

    contentEl.createEl("h2", { text: "게시 결과" });

    const list = contentEl.createEl("div", { cls: "content-engine-result-list" });
    for (const result of this.results) {
      const row = list.createEl("div", { cls: "content-engine-result-row" });
      row.createEl("strong", { text: result.platform });

      if (result.success) {
        row.createSpan({ cls: "content-engine-badge content-engine-badge-published", text: "published" });
        if (result.url) {
          row.createEl("a", {
            text: "게시물 열기",
            href: result.url,
          });
        }
      } else {
        row.createSpan({ cls: "content-engine-badge content-engine-badge-error", text: "error" });
        row.createEl("p", { text: result.error || "알 수 없는 오류가 발생했습니다." });
      }
    }

    contentEl.createEl("button", { text: "닫기", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
