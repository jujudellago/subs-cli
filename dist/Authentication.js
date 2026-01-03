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
exports.default = authenticate;
const keytar = require("keytar");
const chalk = require("chalk");
const inquirer_1 = require("inquirer");
const Util_1 = require("./Util");
const OpenSubtitles = require("opensubtitles.com");
const ora = require("ora");
const Preferences_1 = require("./Preferences");
const os_1 = require("os");
function authenticate() {
    return __awaiter(this, void 0, void 0, function* () {
        let accounts = yield keytar.findCredentials("opensubtitles.com");
        return getCredentialsRec(accounts);
    });
}
function getCredentialsRec(accounts_1) {
    return __awaiter(this, arguments, void 0, function* (accounts, triedAccounts = [], firstPass = true) {
        let credentials = null;
        const validAccounts = accounts.filter(acc => triedAccounts.indexOf(acc.account) < 0);
        if (validAccounts.length > 0) {
            if (firstPass && accounts.findIndex(acc => acc.account === Preferences_1.default.account) > -1) {
                credentials = accounts.find(acc => acc.account === Preferences_1.default.account);
            }
            else {
                credentials = yield inquireAccount(validAccounts);
            }
            if (credentials !== null) {
                triedAccounts.push(credentials.account);
            }
        }
        if (credentials === null) {
            if (firstPass) {
                console.log(chalk.yellowBright("No account found for opensubtitles.com"));
                console.log(chalk.yellowBright("You will be prompted to add your credentials for opensubtitles.com. This information is stored securely by your OS"));
            }
            console.log();
            credentials = yield inquireCredentials();
        }
        // Try to recover API key if not in credentials but saved separately or known
        // For now, we store apikey appended to password or similar? Or just as a separate credential?
        // Keytar stores username and password. We can misuse password to store "password|apikey" or we need another way.
        // Let's assume we store it as "password|apikey" in keytar for simplicity in this transition,
        // or we prompt for it if missing.
        // Check if password contains pipe
        if (!credentials.apikey) {
            if (credentials.password.includes("|")) {
                const parts = credentials.password.split("|");
                credentials.password = parts[0];
                credentials.apikey = parts[1];
            }
            else {
                // Ask for API Key
                console.log(chalk.yellowBright("API Key is required for OpenSubtitles.com API."));
                const apiKeyAnswer = yield (0, inquirer_1.prompt)([{
                        type: "input",
                        name: "apikey",
                        message: "API Key:"
                    }]);
                credentials.apikey = apiKeyAnswer.apikey;
            }
        }
        let osub = yield tryCredentials(credentials);
        if (osub !== null) {
            yield keytar.setPassword("opensubtitles.com", credentials.account, `${credentials.password}|${credentials.apikey}`);
            Preferences_1.default.account = credentials.account;
            return osub;
        }
        else {
            return getCredentialsRec(accounts, triedAccounts, false);
        }
    });
}
function tryCredentials(credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = ora(chalk.yellow(`Logging in ${credentials.account}`)).start();
        try {
            const osub = new OpenSubtitles({
                apikey: credentials.apikey,
                useragent: "subs-cli v" + require("../package.json").version
            });
            yield osub.login({
                username: credentials.account,
                password: credentials.password
            });
            spinner.succeed(`Successfully logged in as ${chalk.blueBright(credentials.account)}`);
            return osub;
        }
        catch (e) {
            // console.error(e);
            spinner.fail(`Failed to log in as ${chalk.blueBright(credentials.account)}. Error: ${chalk.redBright(e.message)}`);
            return null;
        }
    });
}
function inquireAccount(accounts) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const accountName = yield (0, inquirer_1.prompt)([{
                type: "list",
                name: "account",
                choices: [...accounts.map(acc => acc.account), "Other"],
                message: "Which opensubtitles account do you wish to use?"
            }]);
        return (_a = accounts.find(acc => acc.account === accountName.account)) !== null && _a !== void 0 ? _a : null;
    });
}
function inquireCredentials() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const credentials = yield (0, inquirer_1.prompt)([
                { type: "input", name: "account", message: "Username:" },
                { type: "password", name: "password", message: "Password:" },
                { type: "input", name: "apikey", message: "API Key:" }
            ]);
            if ((0, Util_1.isString)(credentials.password, credentials.account, credentials.apikey)) {
                return credentials;
            }
            else {
                console.log(chalk.redBright(`${os_1.EOL}Username/Password/API Key cannot be empty!${os_1.EOL}`));
            }
        }
    });
}
//# sourceMappingURL=Authentication.js.map