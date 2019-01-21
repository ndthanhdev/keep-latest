import {
    promises as fsPromises,
    Stats,
} from "fs";
import {
    join
} from "path";
import {
    ncp
} from "ncp";
import {
    promisify
} from "util";
import rimraf from "rimraf";
import debug from "debug";
import {
    async
} from "rxjs/internal/scheduler/async";

const utilLog = debug('util')

const {
    readdir,
    stat,
    mkdir
} = fsPromises;

const ncpAsync = promisify(ncp);
const rimrafAsync = promisify(rimraf);

export interface PathStats {
    stats: Stats,
    path: string,
    name: string
}

export async function getFolderPathStats(path: string) {
    const names = await readdir(path);
    const pss: PathStats[] = await Promise.all(names.map(async name => {
        const fullPath = join(path, name);
        return await stat(fullPath).then(s => Object.create({
            stats: s,
            path: fullPath,
            name
        }))
    }));
    const folders = pss.filter(p => p.stats.isDirectory());
    return folders;
}

export async function getPathStatsIn(path: string, pattern: RegExp) {
    const folders = await getFolderPathStats(path);
    let result = folders.filter(f => pattern.test(f.name));
    return result;
}

export function getLatest(pss: PathStats[]) {
    return pss.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)[0];
}

export function getOldest(pss: PathStats[]) {
    return pss.sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs)[0];
}

export function verifyEnv() {
    const REQUIRED: string[] = []
    for (const env of REQUIRED) {
        if (process.env[env] == null) {
            return false;
        }
    }

    return true;
}

export async function isExist(path: string) {
    try {
        await stat(path);
        return true;
    } catch (error) {
        // not exist
        if (error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

export async function copyToTarget(source: string, target: string) {
    utilLog('Creating target');
    await mkdir(target);
    const temp = join(target, 'temp');
    utilLog('creating temp');
    await mkdir(temp);
    utilLog('copying to temp');
    await ncpAsync(source, temp);
    utilLog('moving from temp');
    await ncpAsync(temp, target);
    utilLog('removing temp');
    await rimrafAsync(temp)
}

export async function pruneDir(path: string) {
    await rimrafAsync(path)
}

export function makeRevisionTargetPath(target: string, name: string) {
    return join(target, name);
}

export function makeModifyTimeTargetPath(target: string, time: number) {
    return join(target, time.toString());
}

export async function latestSourceExistedInTarget(source: string, target: string): Promise<Boolean> {
    const folders = await getFolderPathStats(target);

    const sourceStat = await stat(source);
    const sourceModifiedTime = sourceStat.mtimeMs.toString();

    const matchedDir = folders.filter(f => f.name === sourceModifiedTime)
    return matchedDir.length > 0;
}