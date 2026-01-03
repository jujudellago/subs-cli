# Roadmap to npm publication as `opensub-cli`

This document outlines the steps required to finalize the migration to the new OpenSubtitles.com API and publish the package to npm under the new name `opensub-cli`.

## Phase 1: Feature Parity & Stability (Current Branch: `opensubtitles.com`)

1.  **Movie Hash Implementation**:
    *   The original version used file hashing to find exact subtitle matches. The current implementation relies on filename search.
    *   *Action*: Implement the OpenSubtitles hashing algorithm (or use a library like `opensubtitles-hash`) and pass `moviehash` to the `subtitles` API endpoint.

2.  **Download Handling**:
    *   Verify the format of the downloaded file from the new API. It currently assumes a direct download link.
    *   *Action*: Handle cases where the download link returns a ZIP file or other formats. Ensure `download-quota` headers are correctly parsed if available, or fetch quota info from the user profile endpoint.

3.  **API Key Management**:
    *   The new API requires an API Key.
    *   *Action*: Refine the storage of the API Key. Currently, it's appended to the password in `keytar`. Consider a more robust storage solution or a separate configuration entry if possible.

4.  **Testing**:
    *   Thoroughly test with various video files and languages.
    *   Handle API errors (e.g., 401 Unauthorized, 429 Too Many Requests) gracefully.

## Phase 2: Branding & Configuration (New Branch/Repo)

1.  **Rename Package**:
    *   Update `package.json` name to `opensub-cli`.
    *   Update `bin` entry if the command name changes (e.g., `opensub` instead of `subs`).

2.  **Clean Slate**:
    *   Create a fresh `master` or `main` branch.
    *   Reset version to `0.0.1` or `1.0.0`.

3.  **Documentation**:
    *   Update `README.md` to reflect the new API usage (API Key requirement).
    *   Add installation instructions for the new package name.

## Phase 3: Publication

1.  **Publish to npm**:
    *   Run `npm login`.
    *   Run `npm publish`.

2.  **Maintenance**:
    *   Monitor issues and API changes.
