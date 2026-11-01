const assert = require('assert');
const { createFileMatcher } = require('../src/fileMatcher');
const { fakeCore, fakeGlob } = require('./fakes');

const WORKSPACE = '/home/runner/work/my-repo/my-repo';

function matcher({ files, workspace = WORKSPACE }) {
    const core = fakeCore();
    const glob = fakeGlob({ '**/*.feature': files });
    return { core, glob, resolvePath: createFileMatcher({ core, glob, workspace }) };
}

describe('fileMatcher', () => {
    // resolves a file of the report among feature files given relative to the workspace
    async function resolve(featureFiles, file) {
        const { resolvePath } = matcher({ files: featureFiles.map(featureFile => `${WORKSPACE}/${featureFile}`) });
        return resolvePath(file);
    }

    it('should find the file in a sub directory', async () => {
        assert.strictEqual(await resolve(['other/b.feature', 'src/features/a.feature'], 'features/a.feature'), 'src/features/a.feature');
    });

    it('should find a file at the root of the workspace', async () => {
        assert.strictEqual(await resolve(['a.feature'], 'a.feature'), 'a.feature');
    });

    it('should only match whole path segments', async () => {
        assert.strictEqual(await resolve(['features/ba.feature', 'other/a.feature'], 'a.feature'), 'other/a.feature');
    });

    it('should remove the classpath prefix', async () => {
        assert.strictEqual(await resolve(['src/test/resources/features/a.feature'], 'classpath:features/a.feature'), 'src/test/resources/features/a.feature');
    });

    it('should return undefined when no file matches', async () => {
        assert.strictEqual(await resolve(['features/b.feature'], 'features/a.feature'), undefined);
    });

    it('should warn once when no file is found', async () => {
        const { resolvePath, core } = matcher({ files: [] });
        assert.strictEqual(await resolvePath('features/a.feature'), undefined);
        await resolvePath('features/a.feature');
        assert.deepStrictEqual(core.warnings, ['No file matching "features/a.feature" was found in the project.']);
    });

    it('should search the workspace only once for all the files', async () => {
        const { resolvePath, glob } = matcher({ files: [`${WORKSPACE}/features/a.feature`, `${WORKSPACE}/features/b.feature`] });
        await Promise.all([resolvePath('features/a.feature'), resolvePath('features/b.feature')]);
        assert.deepStrictEqual(glob.patterns, ['**/*.feature']);
    });

    it('should support a workspace that is not <repo>/<repo>', async () => {
        const { resolvePath } = matcher({
            workspace: '/builds/my-repo',
            files: ['/builds/my-repo/features/a.feature']
        });
        assert.strictEqual(await resolvePath('features/a.feature'), 'features/a.feature');
    });

    it('should support a repository name found earlier in the path', async () => {
        const { resolvePath } = matcher({
            workspace: '/home/app/work/app/app',
            files: ['/home/app/work/app/app/features/a.feature']
        });
        assert.strictEqual(await resolvePath('features/a.feature'), 'features/a.feature');
    });

    it('should ignore the feature files of node_modules', async () => {
        assert.strictEqual(await resolve(['node_modules/a-lib/features/a.feature', 'features/a.feature'], 'features/a.feature'), 'features/a.feature');
    });
});
