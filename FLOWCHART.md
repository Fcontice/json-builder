# Project Flowchart: JSON Restructuring Tool

## Overview
A web-based JSON transformation tool that flattens nested JSON and allows visual schema building via drag-and-drop to restructure data.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JSON RESTRUCTURING TOOL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐       │
│   │   INPUT PANEL    │   │  CANVAS PANEL    │   │  OUTPUT PANEL    │       │
│   │                  │   │                  │   │                  │       │
│   │  - JSON Textarea │   │  - Token Tree    │   │  - JSON Preview  │       │
│   │  - Parse Button  │   │  - Drag/Drop     │   │  - Download Btn  │       │
│   │  - Preview       │   │  - Trash Zone    │   │                  │       │
│   └──────────────────┘   └──────────────────┘   └──────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
Zander_JSON/
└── json-builder/
    ├── index.html      (Entry point - HTML structure)
    ├── app.js          (Core logic - 501 lines)
    ├── styles.css      (Styling - 466 lines)
    └── test-large.json (Sample data)
```

---

## Main Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                        (Paste JSON in textarea)                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: PARSING                                     │
│                                                                             │
│   ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐   │
│   │ JSON.parse()   │───▶│ flattenJSON()  │───▶│ flatRecordsCache       │   │
│   │ Validate input │    │ Recursive DFS  │    │ [{path: value, ...}]   │   │
│   └────────────────┘    └────────────────┘    └────────────────────────┘   │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: CANVAS POPULATION                                │
│                                                                             │
│   ┌────────────────────┐    ┌─────────────────────┐                        │
│   │ autoPopulateCanvas │───▶│ createTokenElement  │                        │
│   │ (recursive walk)   │    │ (DOM token builder) │                        │
│   └────────────────────┘    └─────────────────────┘                        │
│                                      │                                      │
│                                      ▼                                      │
│                          ┌─────────────────────┐                           │
│                          │initializeSortableTree│                          │
│                          │ (Enable drag-drop)  │                           │
│                          └─────────────────────┘                           │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  PHASE 3: VISUAL SCHEMA BUILDING                             │
│                         (User Interaction)                                   │
│                                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                   │
│   │  Drag Token  │   │  Edit Label  │   │  Cycle Mode  │                   │
│   │  (reorder)   │   │  (rename)    │   │  (F/G/O)     │                   │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                   │
│          │                  │                  │                            │
│          └──────────────────┼──────────────────┘                            │
│                             │                                               │
│                             ▼                                               │
│               ┌─────────────────────────┐                                   │
│               │  triggerSchemaUpdate()  │                                   │
│               │          │              │                                   │
│               │          ▼              │                                   │
│               │   parseDomSchema()      │                                   │
│               │          │              │                                   │
│               │          ▼              │                                   │
│               │   canvasSchemaCache     │                                   │
│               └─────────────────────────┘                                   │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: TRANSFORMATION                                   │
│                     (User clicks Convert)                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │                 restructureRecords()                     │              │
│   │                                                          │              │
│   │   ┌─────────────────────────────────────────────────┐   │              │
│   │   │ 1. Find first "group" node                      │   │              │
│   │   │                                                  │   │              │
│   │   │ 2. If group found:                              │   │              │
│   │   │    - Partition records by group path            │   │              │
│   │   │    - Create nested object                       │   │              │
│   │   │    - Recurse with children schema               │   │              │
│   │   │                                                  │   │              │
│   │   │ 3. If no group (leaf level):                    │   │              │
│   │   │    - Call buildLeafObject() per record          │   │              │
│   │   │    - Return array of objects                    │   │              │
│   │   └─────────────────────────────────────────────────┘   │              │
│   │                                                          │              │
│   └─────────────────────────────────────────────────────────┘              │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 5: OUTPUT                                        │
│                                                                             │
│   ┌────────────────────┐    ┌────────────────────┐                         │
│   │  JSON.stringify()  │───▶│  renderOutputText  │                         │
│   │  (format output)   │    │  (syntax highlight)│                         │
│   └────────────────────┘    └────────────────────┘                         │
│                                      │                                      │
│           ┌──────────────────────────┼──────────────────────────┐          │
│           │                          │                          │          │
│           ▼                          ▼                          ▼          │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│   │ View Preview │         │  Edit Output │         │   Download   │       │
│   │              │         │              │         │   .json      │       │
│   └──────────────┘         └──────────────┘         └──────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Token Mode Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TOKEN MODES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐                                                          │
│   │   FIELD     │  → Extracts a single value from each record              │
│   │   (Red)     │     Output: record[path]                                 │
│   └──────┬──────┘                                                          │
│          │ Click mode button                                               │
│          ▼                                                                 │
│   ┌─────────────┐                                                          │
│   │   GROUP     │  → Partitions records by this field's value             │
│   │   (Blue)    │     Output: {value1: [...], value2: [...]}              │
│   └──────┬──────┘                                                          │
│          │ Click mode button                                               │
│          ▼                                                                 │
│   ┌─────────────┐                                                          │
│   │   OBJECT    │  → Nests children as object properties                  │
│   │   (Gray)    │     Output: {child1: val1, child2: val2}                │
│   └──────┬──────┘                                                          │
│          │ Click mode button                                               │
│          └─────────────▶ (back to FIELD)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Functions Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FUNCTION RELATIONSHIPS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DOMContentLoaded                                                          │
│         │                                                                   │
│         ├──▶ Parse Button Click                                            │
│         │         │                                                         │
│         │         ├──▶ flattenJSON() ──────────▶ flatRecordsCache          │
│         │         │                                                         │
│         │         ├──▶ autoPopulateCanvas()                                │
│         │         │         │                                               │
│         │         │         └──▶ createTokenElement() (recursive)          │
│         │         │                                                         │
│         │         └──▶ initializeSortableTree()                            │
│         │                   │                                               │
│         │                   └──▶ Sortable.create() (recursive)             │
│         │                                                                   │
│         ├──▶ Drag/Drop Events                                              │
│         │         │                                                         │
│         │         └──▶ handleSortableAdd()                                 │
│         │                   │                                               │
│         │                   └──▶ triggerSchemaUpdate()                     │
│         │                             │                                     │
│         │                             └──▶ parseDomSchema() ──▶ canvasCache│
│         │                                                                   │
│         ├──▶ Convert Button Click                                          │
│         │         │                                                         │
│         │         └──▶ updatePreview()                                     │
│         │                   │                                               │
│         │                   └──▶ restructureRecords()                      │
│         │                             │                                     │
│         │                             └──▶ buildLeafObject() (recursive)   │
│         │                                                                   │
│         └──▶ Download Button Click                                         │
│                   │                                                         │
│                   └──▶ Blob + Download                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## State Variables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL STATE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   rawJsonInput          │  Original parsed JSON object                     │
│   ──────────────────────┼───────────────────────────────────────────────── │
│   flatRecordsCache      │  Array of flattened records                      │
│                         │  [{path1: val1, path2: val2, ...}, ...]          │
│   ──────────────────────┼───────────────────────────────────────────────── │
│   canvasSchemaCache     │  Schema tree from visual canvas                  │
│                         │  [{key, path, mode, children: [...]}]            │
│   ──────────────────────┼───────────────────────────────────────────────── │
│   activeOutputJsonStr   │  Final JSON output string                        │
│   ──────────────────────┼───────────────────────────────────────────────── │
│   previewTimer          │  Debounce timer for preview updates              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## External Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL LIBRARIES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐                                                      │
│   │   SortableJS     │  Drag-and-drop functionality                        │
│   │   (CDN)          │  Used for token reordering & nesting                │
│   └──────────────────┘                                                      │
│                                                                             │
│   ┌──────────────────┐                                                      │
│   │  Highlight.js    │  JSON syntax highlighting                           │
│   │   (CDN)          │  Used for input/output code display                 │
│   └──────────────────┘                                                      │
│                                                                             │
│   ┌──────────────────┐                                                      │
│   │  Google Fonts    │  Typography (Inter, Fira Code)                      │
│   │   (CDN)          │                                                      │
│   └──────────────────┘                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

This is a single-page application with:
- **No backend** - pure client-side JavaScript
- **Three-panel UI** - Input → Canvas → Output
- **Two core algorithms**:
  1. `flattenJSON()` - Converts nested JSON to flat records
  2. `restructureRecords()` - Transforms flat records per visual schema
- **Visual schema building** via drag-and-drop with SortableJS
