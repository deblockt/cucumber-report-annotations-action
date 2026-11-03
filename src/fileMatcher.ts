import * as path from 'path';
import type { Core, Glob, PathResolver } from './types';

// annotation paths are relative to the repository root and use / as separator
function toRelativePath(featureFile: string, workspace: string): string {
    return path.relative(workspace, featureFile).split(path.sep).join('/');
}

function isInNodeModules(relativePath: string): boolean {
    return relativePath.split('/').includes('node_modules');
}

function findBestMatch(featureFiles: string[], file: string): string | undefined {
    const searchFile = file.startsWith('classpath:') ? file.substring(10) : file;
    return featureFiles.find(featureFile => featureFile === searchFile || featureFile.endsWith('/' + searchFile));
}

export function createFileMatcher({ core, glob, workspace }: { core: Core, glob: Glob, workspace: string }): PathResolver {
    let featureFiles: Promise<string[]> | undefined;
    // the same file is resolved for each of its steps, by the annotations and by the job summary
    const resolvedFiles = new Map<string, Promise<string | undefined>>();

    async function listFeatureFiles(): Promise<string[]> {
        const globber = await glob.create('**/*.feature', {
            followSymbolicLinks: false,
        });
        return (await globber.glob())
            .map(featureFile => toRelativePath(featureFile, workspace))
            .filter(relativePath => !isInNodeModules(relativePath));
    }

    async function resolve(file: string): Promise<string | undefined> {
        featureFiles ??= listFeatureFiles();
        const bestMatch = findBestMatch(await featureFiles, file);
        if (bestMatch) {
            core.debug(`Best path found for ${file} is ${bestMatch}.`);
        } else {
            core.warning(`No file matching "${file}" was found in the project.`);
        }
        return bestMatch;
    }

    return file => {
        let resolvedFile = resolvedFiles.get(file);
        if (!resolvedFile) {
            resolvedFile = resolve(file);
            resolvedFiles.set(file, resolvedFile);
        }
        return resolvedFile;
    };
}
