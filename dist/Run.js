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
            // The updated downloadFile now handles zip extraction automatically
            // We pass the path to the expected .srt file, downloadFile will handle saving it.
            const targetFile = file.replace(/\.[^.]*$/, `.srt`);
            const headers = yield (0, Util_1.downloadFile)(downloadInfo.link, targetFile);
            const dowQuota = Number.parseInt(headers["download-quota"]);
            if (!Number.isNaN(dowQuota)) {
                quota = dowQuota;
            }
        }
        catch (e) {
            throw new DownloadEventHandler_1.DownloadError(e.message, fileBaseName);
        }
        return fileBaseName;
    });
}
function searchSubtitles(videoFile, lang) {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate hash
        const hash = yield (0, Util_1.computeHash)(videoFile);
        // Search using hash and query (fallback or combined?)
        // API docs say we can use moviehash.
        const subsFound = yield osub.subtitles({
            languages: lang.alpha2,
            moviehash: hash
        });
        // Fallback to filename search if no hash results?
        // The original tool might have done this or just hash.
        // If we want robustness, we can try filename if hash yields 0 results.
        if (subsFound.data && subsFound.data.length > 0) {
            return subsFound.data;
        }
        // Fallback query search
        const subsFoundByQuery = yield osub.subtitles({
            languages: lang.alpha2,
            query: (0, path_1.basename)(videoFile).replace(/\.[^/.]+$/, "")
        });
        return subsFoundByQuery.data || [];
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