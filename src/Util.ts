import {readJsonSync, open, read, stat} from "fs-extra";
import {join, basename} from "path"
import * as https from "https"
import * as AdmZip from "adm-zip"
import {createWriteStream} from "fs";
import {ILanguage} from "./Types";
import {IncomingHttpHeaders} from "http";

export function isString(...str:string[]):boolean{
	for(let s of str){
		if(typeof s !== "string" || s.length<1){
			return false;
		}
	}
	return true;
}

export function getLang(lang:string):ILanguage{
	const languages:ILanguage[]=readJsonSync(join(__dirname,"../langs.json"));

	let code=null;
	if(lang.length===2){
		code=languages.find(l=>l.alpha2===lang);
	}else if(lang.length===3){
		code=languages.find(l=>l.alpha3===lang);
	}

	return code;
}

export async function downloadFile(url:string,path:string):Promise<IncomingHttpHeaders>{
    // Path here assumes .srt but we might get a zip.
    // We'll download to a temp file then handle it.
    const tempPath = path + ".tmp";

	return new Promise<IncomingHttpHeaders>((resolve,reject)=>{
		https.get(url,{
			headers:{
				"User-Agent":"subs-cli v" + require("../package.json").version
			}
		},res=>{
			if(res.statusCode===200){
				const fileStream = createWriteStream(tempPath);

                res.pipe(fileStream);

                fileStream.on("finish", () => {
                    fileStream.close();

                    // Check if file is zip by signature or extension?
                    // We can just try to open it as zip.
                    // Or we check Content-Type header?
                    const isZip = (res.headers["content-type"] === "application/zip") ||
                                  (res.headers["content-type"] === "application/x-zip-compressed") ||
                                  url.endsWith(".zip");

                    if(isZip) {
                         try {
                            const zip = new AdmZip(tempPath);
                            const zipEntries = zip.getEntries();

                            // Find the first .srt file
                            const srtEntry = zipEntries.find(entry => entry.entryName.endsWith(".srt"));

                            if (srtEntry) {
                                zip.extractEntryTo(srtEntry.entryName, join(path, ".."), false, true);
                                // AdmZip extractEntryTo: entry, targetPath, maintainEntryPath, overwrite
                                // But targetPath is directory. And we want to rename it to `basename(path)`.
                                // AdmZip doesn't support renaming on extract easily.
                                // We extract to a temp folder or extract then rename.

                                zip.extractEntryTo(srtEntry, join(path, ".."), false, true);
                                // The file is now at join(path, "..", srtEntry.name)
                                const extractedPath = join(path, "..", srtEntry.name);
                                if (extractedPath !== path) {
                                    require("fs").renameSync(extractedPath, path);
                                }
                            } else {
                                // Fallback
                                if(zipEntries.length > 0) {
                                     const entry = zipEntries[0];
                                     zip.extractEntryTo(entry, join(path, ".."), false, true);
                                     const extractedPath = join(path, "..", entry.name);
                                     if (extractedPath !== path) {
                                         require("fs").renameSync(extractedPath, path);
                                     }
                                }
                            }

                            // Cleanup temp
                            require("fs").unlinkSync(tempPath);
                            resolve(res.headers);

                         } catch(e) {
                             reject(new Error("Failed to unzip: " + e.message));
                         }
                    } else {
                        // Not a zip, rename temp to target
                        require("fs").renameSync(tempPath, path);
                        resolve(res.headers);
                    }
                });

                fileStream.on("error", (err) => {
                     require("fs").unlink(tempPath, () => {});
                     reject(err);
                });

			}else{
				reject(new Error(`${res.statusCode} ${res.statusMessage}`));
			}
		});
	});
}

/**
 * Calculates OpenSubtitles movie hash
 */
export async function computeHash(filePath: string): Promise<string> {
    const HASH_CHUNK_SIZE = 65536; // 64 * 1024
    const longs = new Float64Array(8);

    const stats = await stat(filePath);
    const fileSize = stats.size;

    // longs array initialized with file size
    let temp = fileSize;
    for (let i = 0; i < 8; i++) {
        longs[i] = temp & 255;
        temp = temp >> 8;
    }

    async function readChunk(start: number, end: number): Promise<Buffer> {
        const length = end - start;
        const buffer = Buffer.alloc(length);
        const fd = await open(filePath, 'r');
        await read(fd, buffer, 0, length, start);
        return buffer;
    }

    function processChunk(chunk: Buffer) {
        for (let i = 0; i < chunk.length; i++) {
            longs[i % 8] += chunk[i];
        }
    }

    function binl2hex(a: Float64Array) {
        let b = 255;
        let d = '0123456789abcdef';
        let e = '';
        let c = 7;

        a[1] += Math.floor(a[0] / 256);
        a[0] = a[0] & b;
        a[2] += Math.floor(a[1] / 256);
        a[1] = a[1] & b;
        a[3] += Math.floor(a[2] / 256);
        a[2] = a[2] & b;
        a[4] += Math.floor(a[3] / 256);
        a[3] = a[3] & b;
        a[5] += Math.floor(a[4] / 256);
        a[4] = a[4] & b;
        a[6] += Math.floor(a[5] / 256);
        a[5] = a[5] & b;
        a[7] += Math.floor(a[6] / 256);
        a[6] = a[6] & b;
        a[7] = a[7] & b;

        for (c = 7; c > -1; c--) {
            e += d.charAt((a[c] >> 4) & 15) + d.charAt(a[c] & 15);
        }
        return e;
    }

    const chunk1 = await readChunk(0, Math.min(HASH_CHUNK_SIZE, fileSize));
    processChunk(chunk1);

    const chunk2 = await readChunk(Math.max(0, fileSize - HASH_CHUNK_SIZE), fileSize);
    processChunk(chunk2);

    return binl2hex(longs);
}
