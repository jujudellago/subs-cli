# Testing Guide

This guide explains how to test the `opensub-cli` package locally.

## Prerequisites

*   Node.js installed
*   TypeScript installed (via `npm install`)
*   An account on [OpenSubtitles.com](https://www.opensubtitles.com/)
*   An API Key from [OpenSubtitles.com Consumer](https://www.opensubtitles.com/en/consumers)

## Installation

1.  Clone the repository and checkout the `opensubtitles.com` branch.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```

## Running the Tool

You can run the tool directly using `npm start` followed by arguments.

### Examples

**Search and download subtitles for a video file:**

```bash
npm start -- "path/to/movie.mp4"
```

**Specify language (default is English):**

```bash
npm start -- "path/to/movie.mp4" -l fre
```

**Save language as default:**

```bash
npm start -- "path/to/movie.mp4" -l spa -s
```

## First Run Configuration

On the first run, you will be prompted for:
1.  **Username**: Your OpenSubtitles.com username.
2.  **Password**: Your OpenSubtitles.com password.
3.  **API Key**: Your OpenSubtitles.com API Key.

These credentials will be stored securely using your system's keychain (via `keytar`).

## Troubleshooting

*   **Login Failed**: Ensure your API Key is correct and active.
*   **No Subtitles Found**: Try a different video file. The tool attempts to calculate a hash first, then falls back to filename search.
*   **Build Errors**: Run `npm install` again to ensure all types are installed.

## Development

*   Source files are in `src/`.
*   After editing, run `npm run build` to update the `dist/` folder.
