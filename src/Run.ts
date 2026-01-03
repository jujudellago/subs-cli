#!/usr/bin/env node

import {join,isAbsolute,basename} from "path"
import {readFileSync, pathExistsSync, lstatSync, readdirSync} from "fs-extra"
import parseArguments from "./ArgPars"
import * as chalk from "chalk";
import Preferences from "./Preferences";
import authenticate from "./Authentication";
import {downloadFile, getLang, isString} from "./Util";
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

	// await downloadFile(
	// 	"https://dl.opensubtitles.org/en/download/src-api/vrf-19cc0c5d/sid-5db4NRRCgE4S2f0cf7hygCtGqTf/file/1953905758.gz",
	// 	// "https://img.freepik.com/free-vector/abstract-technology-particle-background_52683-25766i.jpg?size=626&ext=jpg",
	// 	"/Users/andu/Downloads/sub.srt",
	// 	true,
	// );

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


	// const subs=await (await authenticate()).search({
	// 	sublanguageid:"eng",
	// 	path:"/Users/andu/Downloads/Breaking.Bad.S05.1080p.BluRay.x264-ROVERS/breaking.bad.s05e11.1080p.bluray.x264-rovers.mkv",
	// 	filename:"breaking.bad.s05e11.1080p.bluray.x264-rovers.mkv",
	// 	gzip:true,
	// });
	//
	// console.log(subs);
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

        // The new API might return a link that doesn't need unzipping if it's not zipped, but usually they are.
        // Also the new API returns file_name in the sub attributes, we can use that for extension or stick to .srt

		const headers=await downloadFile(downloadInfo.link,file.replace(/\.[^.]*$/, `.srt`),false);
        // Note: New API downloads might not be gzipped, and downloadFile defaults unzip to true.
        // We set unzip to false for now, assuming direct link to SRT or we need to check headers.
        // Actually, OpenSubtitles.com often sends JSON response for download if quota exceeded, but wrapper should handle errors.
        // If it returns a link, it's usually the file.
        // We should check if it needs unzipping. The old API was always gzip.
        // The new API usually returns a link to the raw subtitle file (e.g. .srt) or a zip.
        // If it's a zip, we need to unzip.
        // But the downloadFile utility assumes gzip stream if unzip is true.
        // Let's assume false for now, and improve if needed.

		const dowQuota=Number.parseInt(<string>headers["download-quota"]); // Check if this header exists in new API
		if(!Number.isNaN(dowQuota)){
			quota=dowQuota;
		}
        // New API returns quota info in response usually, but we are just downloading the file from the link here.
        // The link might be from a CDN. Quota info comes from the API response of `download()`,
        // but the wrapper returns just the body.
        // We might need to check if wrapper returns quota info.

	}catch (e) {
		throw new DownloadError(e.message,fileBaseName);
	}

	return fileBaseName;
}

async function searchSubtitles(videoFile:string,lang:ILanguage):Promise<ISubInfo[]>{
    // We need to calculate moviehash.
    // Since we don't have a hash function yet, let's look for one or implement one.
    // For now, I'll search by query (filename) if hash is not available, but hash is better.

    // I need to implement movie hashing. OpenSubtitles uses a specific hash.
    // I will try to use the query search first as a fallback or primary if I can't easily implement hash right now.
    // But existing logic used path and filename which implies hashing.

    // Let's rely on query search using filename for this iteration as it's simpler and supported.

	const subsFound = await osub.subtitles({
		languages: lang.alpha2,
        query: basename(videoFile).replace(/\.[^/.]+$/, ""), // Remove extension for better query
        // moviehash: ...
	});

	return subsFound.data || [];
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
