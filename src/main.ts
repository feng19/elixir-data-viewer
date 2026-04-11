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
      "data-toolbar-search": "search",
    };

    for (const [attr, key] of Object.entries(attrMap)) {
      const val = el.getAttribute(attr);
      if (val !== null) {
        toolbarOpts[key] = val !== "false";
      }
    }

    // Read data-fold-level attribute
    const foldLevelAttr = el.getAttribute("data-fold-level");
    const defaultFoldLevel = foldLevelAttr ? parseInt(foldLevelAttr, 10) : undefined;

    const options: ElixirDataViewerOptions = {
      toolbar: toolbarOpts,
      defaultFoldLevel: defaultFoldLevel && !isNaN(defaultFoldLevel) ? defaultFoldLevel : undefined,
    };

    const viewer = new ElixirDataViewer(el, options);
    viewer.setContent(data);
    viewers.push(viewer);
  });

  return viewers;
}

// Initialize all viewers on page load
const viewers = initViewers();

if (viewers.length > 0) { viewers[0].toggleWordWrap(); }

// Demo: onInspect callback on the first viewer
if (viewers.length > 0) {

  viewers[0].onInspect((event) => {
    console.log(`[onInspect] type=${event.type}, copyText=${event.copyText}`);

    // Demo: for String clicks, suppress copy and show an alert instead
    if (event.type === "String") {
      event.preventDefault();
      const content = event.copyText.slice(1, -1); // strip surrounding quotes
      console.log(`[onInspect] String content (copy suppressed): ${content}`);
    }
  });
}

// Expose for debugging
(window as any).__viewers = viewers;
