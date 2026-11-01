const path = require('path');

// annotation paths are relative to the repository root and use / as separator
function toRelativePath(featureFile, workspace) {
    return path.relative(workspace, featureFile).split(path.sep).join('/');
}

function isInNodeModules(relativePath) {
    return relativePath.split('/').includes('node_modules');
}

function findBestMatch(featureFiles, file) {
    const searchFile = file.startsWith('classpath:') ? file.substring(10) : file;
    return featureFiles.find(featureFile => featureFile === searchFile || featureFile.endsWith('/' + searchFile));
}

function createFileMatcher({ core, glob, workspace }) {
    let featureFiles;
    const warnedFiles = new Set();

    async function listFeatureFiles() {
        const globber = await glob.create('**/*.feature', {
            followSymbolicLinks: false,
        });
        return (await globber.glob())
            .map(featureFile => toRelativePath(featureFile, workspace))
            .filter(relativePath => !isInNodeModules(relativePath));
    }

    return async file => {
        featureFiles ??= listFeatureFiles();
        const bestMatch = findBestMatch(await featureFiles, file);
        if (bestMatch) {
            core.debug(`Best path found for ${file} is ${bestMatch}.`);
        } else if (!warnedFiles.has(file)) {
            warnedFiles.add(file);
            core.warning(`No file matching "${file}" was found in the project.`);
        }
        return bestMatch;
    };
}

module.exports = { createFileMatcher };
