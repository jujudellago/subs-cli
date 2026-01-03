import { ILanguage } from "./Types";
import { IncomingHttpHeaders } from "http";
export declare function isString(...str: string[]): boolean;
export declare function getLang(lang: string): ILanguage;
export declare function downloadFile(url: string, path: string): Promise<IncomingHttpHeaders>;
/**
 * Calculates OpenSubtitles movie hash
 */
export declare function computeHash(filePath: string): Promise<string>;
