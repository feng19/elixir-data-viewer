import "./styles/theme.css";
import { ElixirDataViewer } from "./renderer";

// Sample Elixir data for demonstration
const sampleData = `%{
  users: [
    %{
      name: "Alice",
      age: 30,
      email: "alice@example.com",
      roles: [:admin, :user],
      metadata: %{
        login_count: 42,
        last_login: ~N[2024-01-15 10:30:00],
        preferences: %{
          theme: "dark",
          language: "en"
        }
      }
    },
    %{
      name: "Bob",
      age: 25,
      email: "bob@example.com",
      roles: [:user],
      metadata: %{
        login_count: 7,
        last_login: ~N[2024-01-14 08:15:00],
        preferences: %{
          theme: "light",
          language: "ja"
        }
      }
    }
  ],
  total: 2,
  page: 1,
  active: true,
  tags: {"elixir", "data", "viewer"},
  config: [
    timeout: 5000,
    retries: 3,
    base_url: "https://api.example.com"
  ],
  status: :ok,
  ratio: 3.14,
  char_code: ?A,
  nil_value: nil,
  binary: <<104, 101, 108, 108, 111>>,
  big_binary: <<104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 32, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111, 104, 101, 108, 108, 111>>,
  string_with_escapes: "Line1\\nLine2\\tTabbed\\\"Quote\\\"",
  string_with_heredoc: """This is a heredoc string
  that spans multiple lines
  and preserves formatting.
  """,
  big_string: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  keywords: [
    foo: "bar", 
    baz: 123
  ],
  nested_list: [
    [1, 2, 3],
    [4, 5, 6],
    [
      [7, 8],
      [9, 10]
    ]
  ]
}`;

// Initialize the viewer
const container = document.getElementById("viewer-container");
if (container) {
  const viewer = new ElixirDataViewer(container);
  viewer.setContent(sampleData);

  // Word wrap toggle button
  const wrapBtn = document.getElementById("btn-word-wrap");
  if (wrapBtn) {
    wrapBtn.addEventListener("click", () => {
      viewer.toggleWordWrap();
      wrapBtn.classList.toggle("active", viewer.isWordWrap());
    });

    // Alt+Z / Option+Z keyboard shortcut (like VS Code, works on macOS too)
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.code === "KeyZ") {
        e.preventDefault();
        viewer.toggleWordWrap();
        wrapBtn.classList.toggle("active", viewer.isWordWrap());
      }
    });
  }

  // Expose for debugging
  (window as any).__viewer = viewer;
}
