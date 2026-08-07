# 🧠 Obsidian + Graphify Memory Folder Prompt & Guide

This `.memory/` folder is maintained as an **Obsidian Vault** with **Graphify Knowledge Graph** semantics for `kirayu-tracker`.

---

## 📋 System Instructions for AI Agents

Whenever making significant architecture, domain, feature, or tech stack updates to this project:

1. **Read `000_INDEX.md`**: Locate the Map of Content (MOC).
2. **Update/Add Notes**: Create markdown files using YAML frontmatter with explicit graph relationships (`depends_on`, `implements`, `calls`, `relates_to`).
3. **Use WikiLinks**: Interlink memory nodes using Obsidian `[[Note-Name]]` syntax.
4. **Link Source Code**: Reference exact files via GitHub markdown file links `[file.tsx](file:///src/file.tsx)`.
5. **Update Matrix**: Keep `.memory/graph/relationship-matrix.md` updated with new nodes and mermaid graph edges.
