const assert = require('assert');
const { createFileMatcher } = require('../src/fileMatcher');
const { fakeCore, fakeGlob } = require('./fakes');

function matcher({ files, workspace = '/home/runner/work/my-repo/my-repo', pattern = '**/features/a.feature' }) {
    const core = fakeCore();
    const glob = fakeGlob({ [pattern]: files });
    return { core, glob, resolvePath: createFileMatcher({ core, glob, workspace }) };
}

describe('fileMatcher', () => {
    it('should return the path relative to the workspace', async () => {
        const { resolvePath } = matcher({ files: ['/home/runner/work/my-repo/my-repo/features/a.feature'] });
        assert.strictEqual(await resolvePath('features/a.feature'), 'features/a.feature');
    });

    it('should remove the classpath prefix', async () => {
        const { resolvePath, glob } = matcher({ files: ['/home/runner/work/my-repo/my-repo/src/test/resources/features/a.feature'] });
        assert.strictEqual(await resolvePath('classpath:features/a.feature'), 'src/test/resources/features/a.feature');
        assert.deepStrictEqual(glob.patterns, ['**/features/a.feature']);
    });

    it('should return undefined with a warning when no file is found', async () => {
        const { resolvePath, core } = matcher({ files: [] });
        assert.strictEqual(await resolvePath('features/a.feature'), undefined);
        assert.deepStrictEqual(core.warnings, ['No file matching "features/a.feature" was found in the project.']);
    });

    it('should search each file only once', async () => {
        const { resolvePath, glob } = matcher({ files: ['/home/runner/work/my-repo/my-repo/features/a.feature'] });
        await resolvePath('features/a.feature');
        await resolvePath('features/a.feature');
        assert.strictEqual(glob.patterns.length, 1);
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
        const { resolvePath } = matcher({
            files: [
                '/home/runner/work/my-repo/my-repo/node_modules/a-lib/features/a.feature',
                '/home/runner/work/my-repo/my-repo/features/a.feature'
            ]
        });
        assert.strictEqual(await resolvePath('features/a.feature'), 'features/a.feature');
    });
});
