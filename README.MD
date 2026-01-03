# OpenSub CLI

A full featured, easy to use, CLI app to download subtitles from **OpenSubtitles.com**.

> **Note:** This version uses the new OpenSubtitles.com REST API and requires an API Key.

![](subs-terminal.gif)

## Features

-  🎞 Download subtitles for a movie file or an entire folder of video files
-  ⌨️ Login with your OpenSubtitles.com account (Username, Password, and API Key)
-  #️⃣ Search using file hash (OpenSubtitles Hash) or filename
-  🏝 Stores preferences for language and account
-  ⚔️ Secure! Your account credentials are stored encrypted by your operating system using Keychain/Credential Vault/Secret Service API
-  ⌛️ Shows download quota

## Install

```shell script
npm install -g opensub-cli
```

**Note:** This package is currently in beta/test phase.

## Usage

##### Download subtitles for all the video files in a directory
```
opensub /path/to/dir
```

##### Download subtitles for a single video file
```
opensub /path/to/file.mkv
```

##### Help
```
opensub -h

Usage: opensub <path> [options]

Options:
  -V, --version       output the version number
  -l, --lang <value>  the language of the subtitles (eng/en, fr/fre, ro/rum,
                      ...) (default: eng)
  -o, --overwrite     overwrite existing subtitles (default: false)
  -p, --path          path of file or dir of files to download subtitles for
  -s, --save-lang     save the current language as default
  -h, --help          display help for command
```

## Setup

On the first run, you will be asked to provide your OpenSubtitles.com credentials:
1.  **Username**
2.  **Password**
3.  **API Key** (Get one from [OpenSubtitles Consumer Panel](https://www.opensubtitles.com/en/consumers))

## Installation problems

### Linux

You may need to install `libsecret` development headers for the secure storage module (`keytar`) to build:
```bash
sudo apt-get install libsecret-1-dev
```

### Mac OS

If you encounter permission errors, try running with `--unsafe-perm` or fixing npm permissions.

## License

The code in this project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
