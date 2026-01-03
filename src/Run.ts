#!/usr/bin/env node

import {join,isAbsolute,basename} from "path"
import {readFileSync, pathExistsSync, lstatSync, readdirSync} from "fs-extra"
import parseArguments from "./ArgPars"
import * as chalk from "chalk";
import Preferences from "./Preferences";
import authenticate from "./Authentication";
import {downloadFile, getLang, isString, computeHash} from "./Util";
import DownloadEventHandler, {DownloadError, DownloadResult} from "./DownloadEventHandler";
import {ILanguage, IOpenSubtitles, ISubInfo} from "./Types";
import {EOL} from "os"
import {execSync} from "child_process";

const args=parseArguments();

let osub:IOpenSubtitles;

let quota:number=-Infinity;

async function start(){
	const targetPath=getPath();

	const files=getFiles(targetPath);

	if(files.length<1){
		console.log(chalk.yellowBright(`${EOL}No files found${EOL}`));
		return;
	}

	await Preferences.loadPreferences();

	const lang=getLanguage();

	osub=await authenticate();

	const downloadWatcher=new DownloadEventHandler(files.length);

	for(let file of files){
		downloadSubtitle(file,lang)
			.then(downloadWatcher.successHandler)
			.catch(downloadWatcher.errorHandler)
	}

	const result=await downloadWatcher.finishAll();

	printResult(result);

	if(quota>-1){
		console.log(chalk.yellowBright(`${EOL}OpenSubtitle.org download quota: ${chalk.bold(quota)}`));
	}
}

function printResult(result:DownloadResult){
	if(args.notificationOutput){
		execSync(`osascript -e 'display notification "Downloaded ${result.success.length}" with title "Subtitle Download"'`);
		return;
	}

	if(result.success.length>0){
		console.log();

		console.log(chalk.bold.green("  SUCCESS:"));
		for(let fileName of result.success){
			console.log(chalk.green("✔ ")+chalk.greenBright(`${fileName}`))
		}
	}

	if(result.err.length>0){
		console.log();

		console.log(chalk.bold.red("  ERRORS:"));
		for(let error of result.err){
			console.log(chalk.red("✖ ")+chalk.redBright(`${error.fileName} ${chalk.red(error.message)}`))
		}
	}
}

async function downloadSubtitle(file:string,lang:ILanguage):Promise<string>{
	const fileBaseName=basename(file);

	const subs=await searchSubtitles(file,lang);

	if(subs.length<1){
		throw new DownloadError("No subtitles found",fileBaseName);
	}

    // Get the first subtitle
    const sub = subs[0];

	try{
        // New API flow: request download link using file_id
        const downloadInfo = await osub.download({
            file_id: sub.attributes.files[0].file_id
        });

        // The updated downloadFile now handles zip extraction automatically
        // We pass the path to the expected .srt file, downloadFile will handle saving it.
        const targetFile = file.replace(/\.[^.]*$/, `.srt`);
		const headers=await downloadFile(downloadInfo.link, targetFile);

		const dowQuota=Number.parseInt(<string>headers["download-quota"]);
		if(!Number.isNaN(dowQuota)){
			quota=dowQuota;
		}

	}catch (e) {
		throw new DownloadError(e.message,fileBaseName);
	}

	return fileBaseName;
}

async function searchSubtitles(videoFile:string,lang:ILanguage):Promise<ISubInfo[]>{
    // Calculate hash
    const hash = await computeHash(videoFile);

    // Search using hash and query (fallback or combined?)
    // API docs say we can use moviehash.

	const subsFound = await osub.subtitles({
		languages: lang.alpha2,
        moviehash: hash
	});

    // Fallback to filename search if no hash results?
    // The original tool might have done this or just hash.
    // If we want robustness, we can try filename if hash yields 0 results.

    if(subsFound.data && subsFound.data.length > 0) {
        return subsFound.data;
    }

    // Fallback query search
    const subsFoundByQuery = await osub.subtitles({
		languages: lang.alpha2,
        query: basename(videoFile).replace(/\.[^/.]+$/, "")
	});

	return subsFoundByQuery.data || [];
}
function getLanguage():ILanguage{
	const lang=getLang(args.lang ?? Preferences.lang ?? "eng");
	if(lang!==null){
		const isDefault=(lang.alpha3!==Preferences.lang && !args.saveLang);
		console.log(
			chalk.greenBright(
				`Language set to ${chalk.yellow(lang.name)}` +
				(isDefault ? `. To save as default add ${chalk.blueBright("-s")} option` : " as default") +
				EOL
			)
		);

		if(args.saveLang===true){
			Preferences.lang=lang.alpha3;
		}
		return lang;
	}else{
		console.error(chalk.redBright(`No language found for code ${chalk.red(args.lang)}`));
		process.exit(0);
	}
}

function getPath():string{

	let targetPath:string;

	if(!isString(args.path)){
		console.error(chalk.redBright.bold(`No path specified!${EOL}`));
		console.log(args.parser.helpInformation());
		process.exit(0);
	}

	if(isAbsolute(args.path)){
		targetPath=args.path;
	}else{
		targetPath=join(process.cwd(),args.path);
	}

	if(!pathExistsSync(targetPath)){
		console.error(chalk.redBright(`Path '${chalk.bold.red(targetPath)}' doesn't exist`));
		process.exit(0);
	}

	return targetPath;
}

function getFiles(targetPath:string):string[]{
	let files:string[]=null;

	const lstatRes=lstatSync(targetPath);
	if(lstatRes.isFile() && isVideoFile(targetPath)){
		files=[targetPath];
	}else if(lstatRes.isDirectory()){
		files=readdirSync(targetPath)
			.filter(isVideoFile)
			.map(fn=>join(targetPath,fn));
		if(args.overwrite===false){
			files=files.filter(path=>
				!pathExistsSync(path.replace(/\.[^.]*$/, ".srt"))
			)
		}
	}

	return files;
}

function isVideoFile(path:string){
	const ext=path.split(".").pop() ?? null;

	return extensions.indexOf(ext)>-1;
}

const extensions:string[]=JSON.parse(
	readFileSync(
		join(__dirname,"../extensions.json"),{encoding:"utf8"}
	)
);

start().catch(e=>console.error(e));
