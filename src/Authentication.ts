import * as keytar from "keytar"
import * as chalk from "chalk"
import {prompt} from "inquirer"
import {isString} from "./Util";
import * as OpenSubtitles from "opensubtitles.com"
import * as ora from "ora"
import Preferences from "./Preferences";
import {IOpenSubtitles} from "./Types";
import {EOL} from "os"

interface Credentials {
    account: string;
    password: string;
    apikey?: string;
}

export default async function authenticate(): Promise<IOpenSubtitles> {
    let accounts: Credentials[] = await keytar.findCredentials("opensubtitles.com");

    return getCredentialsRec(accounts);
}

async function getCredentialsRec(accounts: Credentials[], triedAccounts: string[] = [], firstPass: boolean = true): Promise<IOpenSubtitles> {
    let credentials: Credentials = null;

    const validAccounts = accounts.filter(acc => triedAccounts.indexOf(acc.account) < 0);


    if (validAccounts.length > 0) {
        if (firstPass && accounts.findIndex(acc => acc.account === Preferences.account) > -1) {
            credentials = accounts.find(acc => acc.account === Preferences.account);
        } else {
            credentials = await inquireAccount(validAccounts);
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
        credentials = await inquireCredentials();
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
        } else {
            // Ask for API Key
            console.log(chalk.yellowBright("API Key is required for OpenSubtitles.com API."));
            const apiKeyAnswer = await prompt([{
                type: "input",
                name: "apikey",
                message: "API Key:"
            }]);
            credentials.apikey = apiKeyAnswer.apikey;
        }
    }

    let osub = await tryCredentials(credentials);
    if (osub !== null) {
        await keytar.setPassword("opensubtitles.com", credentials.account, `${credentials.password}|${credentials.apikey}`);
        Preferences.account = credentials.account;
        return osub;
    } else {
        return getCredentialsRec(accounts, triedAccounts, false);
    }
}

async function tryCredentials(credentials: Credentials): Promise<any> {
    const spinner = ora(chalk.yellow(`Logging in ${credentials.account}`)).start();
    try {
        const osub = new OpenSubtitles({
            apikey: credentials.apikey,
            useragent: "subs-cli v" + require("../package.json").version
        });
        await osub.login({
            username: credentials.account,
            password: credentials.password
        });
        spinner.succeed(`Successfully logged in as ${chalk.blueBright(credentials.account)}`);
        return osub;
    } catch (e) {
        // console.error(e);
        spinner.fail(`Failed to log in as ${chalk.blueBright(credentials.account)}. Error: ${chalk.redBright(e.message)}`);
        return null;
    }
}

async function inquireAccount(accounts: Credentials[]): Promise<Credentials> {
    const accountName = await prompt([{
        type: "list",
        name: "account",
        choices: [...accounts.map(acc => acc.account), "Other"],
        message: "Which opensubtitles account do you wish to use?"
    }]);

    return accounts.find(acc => acc.account === accountName.account) ?? null;
}

async function inquireCredentials(): Promise<Credentials> {
    while (true) {
        const credentials: Credentials = await prompt([
            { type: "input", name: "account", message: "Username:" },
            { type: "password", name: "password", message: "Password:" },
            { type: "input", name: "apikey", message: "API Key:" }
        ]);

        if (isString(credentials.password, credentials.account, credentials.apikey)) {
            return credentials;
        } else {
            console.log(chalk.redBright(`${EOL}Username/Password/API Key cannot be empty!${EOL}`))
        }
    }
}
