import {
    getPathStatsIn,
    verifyEnv,
    getLatest,
    copyToTarget,
    isExist,
    makeRevisionTargetPath,
    getOldest,
    pruneDir,
    latestSourceExistedInTarget,
    makeModifyTimeTargetPath,
    getFolderPathStats
} from "./utils";
import {
    timer
} from "rxjs";
import {
    throttle,
    map
} from "rxjs/operators";
import debug from "debug";
import {
    promises as fsPromises
} from "fs";
const {
    stat
} = fsPromises;

const mainLog = debug('main')
const copyLog = debug('main:copy')
const pruneLog = debug('main:prune')


if (!verifyEnv()) {
    throw Error('params are not full filled');
}

const SOURCE = process.env.SOURCE || '/usr/source';
const TARGET = process.env.TARGET || '/usr/target';
const INTERVAL = parseInt(process.env.INTERVAL || '5000');
const PATTERN = process.env.PATTERN ? new RegExp(process.env.PATTERN) : undefined;
const LIMIT = parseInt(process.env.LIMIT || '3');

async function copy(source: string, target: string, pattern?: RegExp) {
    copyLog('start copy')

    if (pattern) {
        await copyFromRevisionRepository(source, target, pattern);
    } else {
        await copyFromLatestSource(source, target);
    }

}

async function copyFromLatestSource(source: string, target: string) {
    const sourceStat = await stat(source);
    copyLog(`source modified at ${sourceStat.mtimeMs}`)
    const isExisted = await latestSourceExistedInTarget(source, target);
    if (isExisted) {
        copyLog('modification time existed')
        copyLog('do nothing')
    } else {
        copyLog('modification time is not existed')
        const targetPath = makeModifyTimeTargetPath(target, sourceStat.mtimeMs);
        copyLog(`copying ${sourceStat.mtimeMs}`);
        await copyToTarget(source, targetPath);
        copyLog(`copy done`);
    }

}

async function copyFromRevisionRepository(source: string, target: string, pattern: RegExp) {
    const pss = await getPathStatsIn(source, pattern);
    if (pss.length === 0) {
        copyLog('repository empty or filtered out')
        copyLog('do nothing')
        return
    }
    const latest = getLatest(pss);
    copyLog(`latest is: ${latest.path}`);
    const targetPath = makeRevisionTargetPath(target, latest.name)
    if (await isExist(targetPath)) {
        copyLog(`latest is existed in: ${targetPath}`);
        copyLog('do nothing')
    } else {
        copyLog(`latest is not existed in: ${targetPath}`);
        copyLog(`copying ${latest.name}`);
        await copyToTarget(latest.path, targetPath);
        copyLog(`copy done`);
    }
}

async function prune(target: string, limit: number) {
    pruneLog('start prune')
    const pss = await getFolderPathStats(target);
    pruneLog(`amount of target is ${pss.length}/${limit}`)
    if (pss.length > LIMIT) {
        const oldest = getOldest(pss);
        pruneLog(`pruning ${oldest.path}`)
        await pruneDir(oldest.path);
        pruneLog(`pruned ${oldest.path}`)
    } else {
        pruneLog('dont need to prune')
    }
}

async function doEverything() {
    await copy(SOURCE, TARGET, PATTERN);
    await prune(TARGET, LIMIT);
}

timer(0, INTERVAL)
    .pipe(map(i => {
        mainLog(`tick: ${i}`);
        return i;
    }))
    .pipe(throttle(doEverything))
    .subscribe(() => {

    });