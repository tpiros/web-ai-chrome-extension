# Tab Tidy

A Chrome extension that uses built-in AI APIs to automatically classify and organize your browser tabs into meaningful groups.

## The Problem

Modern web browsing often leads to tab overload - dozens or even hundreds of tabs open simultaneously, making it difficult to find what you need and stay organized. Manually organizing tabs into groups is time-consuming and tedious. Tab Tidy solves this by leveraging Chrome's experimental AI capabilities to automatically classify and group your tabs based on their title and URL.

## Features

### Core Functionality

- **Automatic Tab Classification**: Analyzes tab titles and URLs to classify tabs into predefined categories (News, Sports, Shopping, Travel, Learning, Work, Development, Social, Finance, Entertainment, Gaming, Music, Videos, Articles, Research, Tools, Documentation, Other)
- **Direct Category Grouping**: Groups tabs by their classification label for fast, predictable organization
- **Chrome Tab Groups Integration**: Creates native Chrome tab groups with color-coding and labels
- **Duplicate Detection**: Automatically identifies and removes duplicate tabs before organizing
- **Fast Processing**: Optimized for speed - classifies and groups 20+ tabs in under 2 minutes

### Advanced Features

- **AI-Generated Summaries**: For groups with 5+ tabs, automatically generates summaries of the group's content using the Summarizer API
- **Content Overviews**: Creates detailed overviews for larger tab groups using the Writer API to help you understand what's in each group
- **Real-time Progress Tracking**: Visual progress indicators and detailed activity logs show exactly what the AI is doing
- **Model Download Management**: Handles AI model downloads with progress tracking when models are first needed
- **Group Management**: Easily ungroup all tabs or specific categories with one click
- **Persistent Groups**: View and manage existing tab groups on startup

### User Experience

- **Side Panel Interface**: Clean, non-intrusive interface accessible from Chrome's side panel
- **Batch Processing**: Processes tabs in batches of 5 for optimal performance
- **Fast Operation**: Typical processing time of 1-2 minutes for 20+ tabs
- **Tab Limit Protection**: Automatically limits processing to 100 tabs to prevent performance issues
- **Activity Logging**: Detailed logs show every step of the organization process

## Chrome AI APIs Used

This extension showcases Chrome's experimental built-in AI capabilities through three distinct APIs:

### 1. **LanguageModel API**
- **Purpose**: Tab classification
- **Usage**:
  - Classifies individual tabs into predefined categories based on title and URL
  - Generates topic summaries for each tab
- **Why**: Provides the core intelligence for understanding what each tab is about without needing to read page content

### 2. **Writer API**
- **Purpose**: Content generation
- **Usage**: Generates detailed overviews for tab groups with 5 or more tabs
- **Why**: Creates human-readable descriptions that help users understand the common themes in their tab groups

### 3. **Summarizer API**
- **Purpose**: Content summarization
- **Usage**: Creates concise summaries of tab group content
- **Why**: Provides quick insights into what each group contains without needing to read through all tabs

## Requirements

- **Chrome Version**: Chrome 138 or later (Chrome Canary recommended)
- **Experimental Features**: Chrome's experimental AI features must be enabled
- **AI Models**: The extension will automatically download required AI models on first use (Language Model, Writer, and Summarizer)

### Enabling Chrome AI Features

1. Open Chrome Canary
2. Navigate to `chrome://flags`
3. Search for and enable the following flags:
   - `#optimization-guide-on-device-model`
   - `#prompt-api-for-gemini-nano`
   - `#summarization-api-for-gemini-nano`
   - `#writer-api-for-gemini-nano`
4. Restart Chrome

## Installation

### For Development

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome Canary
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the project directory

## Usage

1. **Open the Side Panel**: Click the Tab Tidy extension icon in your Chrome toolbar to open the side panel

2. **Check API Status**: The extension will display the availability status of all three AI APIs (LanguageModel, Writer, Summarizer)

3. **Organize Tabs**: Click the "Organize Tabs" button to start the automatic classification and grouping process

4. **Monitor Progress**: Watch the activity log and progress indicators as the AI:
   - Removes duplicate tabs
   - Classifies tabs into categories based on title and URL
   - Groups tabs by category
   - Forms Chrome tab groups
   - Generates summaries and overviews (for larger groups)

5. **Manage Groups**:
   - Click on any tab in the results to switch to it
   - Use "Ungroup" buttons to remove specific category groups
   - Use "Ungroup All" to remove all tab groups at once

6. **View Results**: Expandable group cards show:
   - Group name and tab count
   - List of all tabs in the group
   - AI-generated summary (for groups with 5+ tabs)
   - AI-generated overview (for groups with 5+ tabs)

## How It Works

### Workflow

1. **Initialization**: Downloads and initializes AI models (if not already available)
2. **Deduplication**: Identifies and closes duplicate tabs
3. **Classification**: Uses LanguageModel API to classify each tab into a category based on title and URL
4. **Grouping**: Groups tabs by their classification label (all "News" tabs together, etc.)
5. **Group Creation**: Creates Chrome tab groups with appropriate names and colors
6. **Summary Generation**: Asynchronously generates summaries and overviews for larger groups

### Architecture

```
┌─────────────────┐
│   Side Panel    │ (User Interface)
│   sidepanel.js  │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────────┬──────────────┐
    │         │          │            │              │
    v         v          v            v              v
┌────────┐ ┌─────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐
│Session │ │Class│ │UI Render│ │Group Mgr │ │Background  │
│Manager │ │ifier│ │         │ │          │ │Script      │
└────────┘ └─────┘ └─────────┘ └──────────┘ └────────────┘
    │         │          │            │              │
    v         v          v            v              v
┌─────────────────────────────────────────────────────────┐
│              Chrome Built-in AI APIs                    │
│  LanguageModel API  │  Writer API  │  Summarizer API   │
└─────────────────────────────────────────────────────────┘
```

## Build System

The project uses Rollup for bundling:

- **Input**: `src/ui/sidepanel.js` (bundled as IIFE)
- **Output**: `dist/` directory with all extension files
- **Assets**: Automatically copies `manifest.json`, `background.js`, `sidepanel.html`, and `sidepanel.css` to `dist/`
- **Dependencies**:
  - DOMPurify (for safe HTML rendering)
  - Marked (for markdown rendering)

## Project Structure

```
/
├── src/
│   ├── bg/
│   │   └── background.js       # Service worker for Chrome API operations
│   └── ui/
│       ├── sidepanel.js        # Main orchestration and entry point
│       ├── aiSession.js        # AI session lifecycle management
│       ├── tabClassifier.js    # Tab classification and clustering logic
│       ├── uiRenderer.js       # UI rendering and display
│       └── groupManager.js     # Tab group management
├── dist/                       # Build output (generated)
├── manifest.json               # Extension manifest
├── sidepanel.html             # Side panel UI
├── sidepanel.css              # Side panel styles
├── rollup.config.mjs          # Build configuration
└── package.json               # Dependencies and scripts
```

## Technical Notes

- **Message Passing**: Uses Chrome's message passing API for communication between side panel and background script
- **Session Management**: Carefully manages AI session lifecycle to prevent memory leaks
- **Sequential Model Loading**: Loads AI models sequentially with delays to prevent download conflicts
- **Batch Processing**: Processes tabs in batches of 5 for optimal performance
- **Lightweight Classification**: Uses only tab title and URL for classification (no page content extraction)
- **Direct Grouping**: Groups tabs by classification label without additional AI clustering for speed
- **Async Summary Generation**: Summaries and overviews are generated asynchronously after main grouping completes

## Limitations

- Maximum 100 tabs processed per operation
- Requires active internet connection for initial AI model downloads
- Classification based on tab title and URL only (does not read page content)
- Requires Chrome Canary with experimental flags enabled
- AI model downloads can be large (varies by model)
- On-device AI models can be slow on first classification (improves with use)

## Future Possible Enhancements

- Custom category definitions
- Manual tab group editing
- Export/import group configurations
- Schedule automatic organization
- Integration with bookmarks
- Cross-device group synchronization

## License

MIT.
