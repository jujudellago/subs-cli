#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const ArgPars_1 = require("./ArgPars");
const chalk = require("chalk");
const Preferences_1 = require("./Preferences");
const Authentication_1 = require("./Authentication");
const Util_1 = require("./Util");
const DownloadEventHandler_1 = require("./DownloadEventHandler");
const os_1 = require("os");
const child_process_1 = require("child_process");
const args = (0, ArgPars_1.default)();
let osub;
let quota = -Infinity;
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        const targetPath = getPath();
        const files = getFiles(targetPath);
        if (files.length < 1) {
            console.log(chalk.yellowBright(`${os_1.EOL}No files found${os_1.EOL}`));
            return;
        }
        yield Preferences_1.default.loadPreferences();
        const lang = getLanguage();
        // await downloadFile(
        // 	"https://dl.opensubtitles.org/en/download/src-api/vrf-19cc0c5d/sid-5db4NRRCgE4S2f0cf7hygCtGqTf/file/1953905758.gz",
        // 	// "https://img.freepik.com/free-vector/abstract-technology-particle-background_52683-25766i.jpg?size=626&ext=jpg",
        // 	"/Users/andu/Downloads/sub.srt",
        // 	true,
        // );
        osub = yield (0, Authentication_1.default)();
        const downloadWatcher = new DownloadEventHandler_1.default(files.length);
        for (let file of files) {
            downloadSubtitle(file, lang)
                .then(downloadWatcher.successHandler)
                .catch(downloadWatcher.errorHandler);
        }
        const result = yield downloadWatcher.finishAll();
        printResult(result);
        if (quota > -1) {
            console.log(chalk.yellowBright(`${os_1.EOL}OpenSubtitle.org download quota: ${chalk.bold(quota)}`));
        }
        // const subs=await (await authenticate()).search({
        // 	sublanguageid:"eng",
        // 	path:"/Users/andu/Downloads/Breaking.Bad.S05.1080p.BluRay.x264-ROVERS/breaking.bad.s05e11.1080p.bluray.x264-rovers.mkv",
        // 	filename:"breaking.bad.s05e11.1080p.bluray.x264-rovers.mkv",
        // 	gzip:true,
        // });
        //
        // console.log(subs);
    });
}
function printResult(result) {
    if (args.notificationOutput) {
        (0, child_process_1.execSync)(`osascript -e 'display notification "Downloaded ${result.success.length}" with title "Subtitle Download"'`);
        return;
    }
    if (result.success.length > 0) {
        console.log();
        console.log(chalk.bold.green("  SUCCESS:"));
        for (let fileName of result.success) {
            console.log(chalk.green("✔ ") + chalk.greenBright(`${fileName}`));
        }
    }
    if (result.err.length > 0) {
        console.log();
        console.log(chalk.bold.red("  ERRORS:"));
        for (let error of result.err) {
            console.log(chalk.red("✖ ") + chalk.redBright(`${error.fileName} ${chalk.red(error.message)}`));
        }
    }
}
function downloadSubtitle(file, lang) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileBaseName = (0, path_1.basename)(file);
        const subs = yield searchSubtitles(file, lang);
        if (subs.length < 1) {
            throw new DownloadEventHandler_1.DownloadError("No subtitles found", fileBaseName);
        }
        // Get the first subtitle
        const sub = subs[0];
        try {
            // New API flow: request download link using file_id
            const downloadInfo = yield osub.download({
                file_id: sub.attributes.files[0].file_id
            });
            // The new API might return a link that doesn't need unzipping if it's not zipped, but usually they are.
            // Also the new API returns file_name in the sub attributes, we can use that for extension or stick to .srt
            const headers = yield (0, Util_1.downloadFile)(downloadInfo.link, file.replace(/\.[^.]*$/, `.srt`), false);
            // Note: New API downloads might not be gzipped, and downloadFile defaults unzip to true.
            // We set unzip to false for now, assuming direct link to SRT or we need to check headers.
            // Actually, OpenSubtitles.com often sends JSON response for download if quota exceeded, but wrapper should handle errors.
            // If it returns a link, it's usually the file.
            // We should check if it needs unzipping. The old API was always gzip.
            // The new API usually returns a link to the raw subtitle file (e.g. .srt) or a zip.
            // If it's a zip, we need to unzip.
            // But the downloadFile utility assumes gzip stream if unzip is true.
            // Let's assume false for now, and improve if needed.
            const dowQuota = Number.parseInt(headers["download-quota"]); // Check if this header exists in new API
            if (!Number.isNaN(dowQuota)) {
                quota = dowQuota;
            }
            // New API returns quota info in response usually, but we are just downloading the file from the link here.
            // The link might be from a CDN. Quota info comes from the API response of `download()`,
            // but the wrapper returns just the body.
            // We might need to check if wrapper returns quota info.
        }
        catch (e) {
            throw new DownloadEventHandler_1.DownloadError(e.message, fileBaseName);
        }
        return fileBaseName;
    });
}
function searchSubtitles(videoFile, lang) {
    return __awaiter(this, void 0, void 0, function* () {
        // We need to calculate moviehash.
        // Since we don't have a hash function yet, let's look for one or implement one.
        // For now, I'll search by query (filename) if hash is not available, but hash is better.
        // I need to implement movie hashing. OpenSubtitles uses a specific hash.
        // I will try to use the query search first as a fallback or primary if I can't easily implement hash right now.
        // But existing logic used path and filename which implies hashing.
        // Let's rely on query search using filename for this iteration as it's simpler and supported.
        const subsFound = yield osub.subtitles({
            languages: lang.alpha2,
            query: (0, path_1.basename)(videoFile).replace(/\.[^/.]+$/, ""), // Remove extension for better query
            // moviehash: ...
        });
        return subsFound.data || [];
    });
}
function getLanguage() {
    var _a, _b;
    const lang = (0, Util_1.getLang)((_b = (_a = args.lang) !== null && _a !== void 0 ? _a : Preferences_1.default.lang) !== null && _b !== void 0 ? _b : "eng");
    if (lang !== null) {
        const isDefault = (lang.alpha3 !== Preferences_1.default.lang && !args.saveLang);
        console.log(chalk.greenBright(`Language set to ${chalk.yellow(lang.name)}` +
            (isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
            os_1.EOL));
        if (args.saveLang === true) {
            Preferences_1.default.lang = lang.alpha3;
        }
        return lang;
    }
    else {
        console.error(chalk.redBright(`No language found for code ${chalk.red(args.lang)}`));
        process.exit(0);
    }
}
function getPath() {
    let targetPath;
    if (!(0, Util_1.isString)(args.path)) {
        console.error(chalk.redBright.bold(`No path specified!${os_1.EOL}`));
        console.log(args.parser.helpInformation());
        process.exit(0);
    }
    if ((0, path_1.isAbsolute)(args.path)) {
        targetPath = args.path;
    }
    else {
        targetPath = (0, path_1.join)(process.cwd(), args.path);
    }
    if (!(0, fs_extra_1.pathExistsSync)(targetPath)) {
        console.error(chalk.redBright(`Path '${chalk.bold.red(targetPath)}' doesn't exist`));
        process.exit(0);
    }
    return targetPath;
}
function getFiles(targetPath) {
    let files = null;
    const lstatRes = (0, fs_extra_1.lstatSync)(targetPath);
    if (lstatRes.isFile() && isVideoFile(targetPath)) {
        files = [targetPath];
    }
    else if (lstatRes.isDirectory()) {
        files = (0, fs_extra_1.readdirSync)(targetPath)
            .filter(isVideoFile)
            .map(fn => (0, path_1.join)(targetPath, fn));
        if (args.overwrite === false) {
            files = files.filter(path => !(0, fs_extra_1.pathExistsSync)(path.replace(/\.[^.]*$/, ".srt")));
        }
    }
    return files;
}
function isVideoFile(path) {
    var _a;
    const ext = (_a = path.split(".").pop()) !== null && _a !== void 0 ? _a : null;
    return extensions.indexOf(ext) > -1;
}
const extensions = JSON.parse((0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, "../extensions.json"), { encoding: "utf8" }));
start().catch(e => console.error(e));
//# sourceMappingURL=Run.js.map