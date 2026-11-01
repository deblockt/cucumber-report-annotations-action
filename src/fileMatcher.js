const path = require('path');

function memoize(fn) {
    const cache = {};

    return (...args) => {
        let argsString = JSON.stringify(args);
        return argsString in cache
          ? cache[argsString]
          : (cache[argsString] = fn(...args));
    }
}

// annotation paths are relative to the repository root and use / as separator
function toRelativePath(featureFile, workspace) {
    return path.relative(workspace, featureFile).split(path.sep).join('/');
}

function isInNodeModules(relativePath) {
    return relativePath.split('/').includes('node_modules');
}

// returns a memoized function resolving a feature file of a report to its path in the repository
function createFileMatcher({ core, glob, workspace }) {
    async function findBestFileMatch(file) {
        let searchFile = file;
        if (searchFile.startsWith('classpath:')) {
            searchFile = searchFile.substring(10);
        }
        const globber = await glob.create('**/' + searchFile, {
            followSymbolicLinks: false,
        });
        const files = (await globber.glob())
            .map(featureFile => toRelativePath(featureFile, workspace))
            .filter(relativePath => !isInNodeModules(relativePath));
        if (files.length > 0) {
            core.debug(`Best path found for ${file} is ${files[0]}.`);
            return files[0];
        }

        core.warning(`No file matching "${file}" was found in the project.`);

        return undefined;
    }

    return memoize(findBestFileMatch);
}

module.exports = { createFileMatcher };
