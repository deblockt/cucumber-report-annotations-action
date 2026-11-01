function memoize(fn) {
    const cache = {};

    return (...args) => {
        let argsString = JSON.stringify(args);
        return argsString in cache
          ? cache[argsString]
          : (cache[argsString] = fn(...args));
    }
}

function toRelativePath(featureFile, repoName) {
    const indexOfRepoName = featureFile.indexOf(repoName);
    return featureFile.substring(indexOfRepoName + repoName.length * 2 + 2);
}

// returns a memoized function resolving a feature file of a report to its path in the repository
function createFileMatcher({ core, glob, repoName }) {
    async function findBestFileMatch(file) {
        let searchFile = file;
        if (searchFile.startsWith('classpath:')) {
            searchFile = searchFile.substring(10);
        }
        const globber = await glob.create('**/' + searchFile, {
            followSymbolicLinks: false,
        });
        const files = await globber.glob()
        if (files.length > 0) {
            const filePathWithoutWorkspace = toRelativePath(files[0], repoName);

            core.debug(`Best path found for ${file} is ${filePathWithoutWorkspace}.`);
            return filePathWithoutWorkspace;
        }

        core.warning(`No file matching "${file}" was found in the project.`);

        return undefined;
    }

    return memoize(findBestFileMatch);
}

module.exports = { createFileMatcher };
