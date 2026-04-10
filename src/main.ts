import "./styles/theme.css";
import { ElixirDataViewer } from "./renderer";
import type { ElixirDataViewerOptions } from "./renderer";

/**
 * Auto-discover all `.edv-viewer` elements on the page,
 * read their inline `<script type="text/elixir-data">` content,
 * and initialize an ElixirDataViewer for each.
 */
function initViewers(): ElixirDataViewer[] {
  const viewers: ElixirDataViewer[] = [];
  const elements = document.querySelectorAll<HTMLElement>(".edv-viewer");

  elements.forEach((el) => {
    const script = el.querySelector('script[type="text/elixir-data"]');
    if (!script) return;

    const data = script.textContent?.trim() ?? "";
    script.remove(); // clean up the script tag from DOM

    // Read data-toolbar-* attributes for toolbar config
    const toolbarOpts: ElixirDataViewerOptions["toolbar"] = {};
    const attrMap: Record<string, keyof NonNullable<ElixirDataViewerOptions["toolbar"]>> = {
      "data-toolbar-fold-all": "foldAll",
      "data-toolbar-unfold-all": "unfoldAll",
      "data-toolbar-word-wrap": "wordWrap",
      "data-toolbar-copy": "copy",
    };

    for (const [attr, key] of Object.entries(attrMap)) {
      const val = el.getAttribute(attr);
      if (val !== null) {
        toolbarOpts[key] = val !== "false";
      }
    }

    const options: ElixirDataViewerOptions = {
      toolbar: toolbarOpts,
    };

    const viewer = new ElixirDataViewer(el, options);
    viewer.setContent(data);
    viewers.push(viewer);
  });

  return viewers;
}

// Initialize all viewers on page load
const viewers = initViewers();

// Expose for debugging
(window as any).__viewers = viewers;
