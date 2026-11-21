import * as assert from 'assert';
import {
    MAX_COMMENT_LENGTH,
    buildPullRequestComment,
    commentMarker,
    parsePullRequestNumber,
    publishPullRequestComment
} from '../src/pullRequestComment';
import { fakeCore, fakeGithub } from './fakes';
import type { FakeGitHubOptions } from './fakes';

const RUN_URL = 'https://github.com/owner/my-repo/actions/runs/1234';
const MARKER = '<!-- cucumber-report-annotations-action: Cucumber report -->';

describe('pullRequestComment', () => {
    describe('parsePullRequestNumber', () => {
        it('should not comment without value', () => {
            assert.strictEqual(parsePullRequestNumber(''), undefined);
            assert.strictEqual(parsePullRequestNumber('  '), undefined);
        });

        it('should read the pull request number', () => {
            assert.strictEqual(parsePullRequestNumber(' 89 '), 89);
        });

        for (const value of ['abc', '0', '-1', '1.5', '#89']) {
            it(`should reject "${value}"`, () => {
                assert.throws(() => parsePullRequestNumber(value), new Error(`Invalid pull-request-number "${value}": a positive integer is expected.`));
            });
        }
    });

    describe('commentMarker', () => {
        it('should identify the comment by the check name', () => {
            assert.strictEqual(commentMarker('Cucumber report'), MARKER);
        });

        it('should not let the check name close the html comment', () => {
            assert.strictEqual(commentMarker('a --> b'), '<!-- cucumber-report-annotations-action: a  b -->');
        });
    });

    describe('buildPullRequestComment', () => {
        it('should write the content of each report', () => {
            const comment = buildPullRequestComment({
                checkName: 'Cucumber report',
                reports: [
                    { title: 'Cucumber report (1 error)', content: 'content 1', counts: 'counts 1' },
                    { title: 'Cucumber report', content: 'content 2', counts: 'counts 2' }
                ],
                runUrl: RUN_URL
            });
            assert.strictEqual(comment, `${MARKER}\n`
                + '### Cucumber report (1 error)\n\ncontent 1\n\n'
                + '### Cucumber report\n\ncontent 2\n\n'
                + `<sub>Published by the [workflow run](${RUN_URL}).</sub>`);
        });

        it('should only write the counts when the content is too long', () => {
            const comment = buildPullRequestComment({
                checkName: 'Cucumber report',
                reports: [{ title: 'Cucumber report', content: 'x'.repeat(MAX_COMMENT_LENGTH), counts: 'the counts' }],
                runUrl: RUN_URL
            });
            assert.strictEqual(comment, `${MARKER}\n### Cucumber report\n\nthe counts\n\n`
                + `<sub>The details are too long for a comment, they are in the job summary of the [workflow run](${RUN_URL}).</sub>`);
        });

        it('should link the workflow run when even the counts are too long', () => {
            const comment = buildPullRequestComment({
                checkName: 'Cucumber report',
                reports: [{ title: 'Cucumber report', content: 'x'.repeat(MAX_COMMENT_LENGTH), counts: 'x'.repeat(MAX_COMMENT_LENGTH) }],
                runUrl: RUN_URL
            });
            assert.strictEqual(comment, `${MARKER}\nThe report is too long for a comment, it is in the job summary of the [workflow run](${RUN_URL}).`);
        });
    });

    describe('publishPullRequestComment', () => {
        const repo = { owner: 'owner', repo: 'my-repo' };

        async function publish(options: FakeGitHubOptions = {}) {
            const github = fakeGithub(options);
            await publishPullRequestComment(fakeCore(), github.getOctokit('token'), repo, 89, 'Cucumber report', `${MARKER}\nnew body`);
            return github;
        }

        it('should create the comment on the pull request', async () => {
            const github = await publish({ comments: { 89: [{ id: 1, body: 'another comment' }] } });
            assert.deepStrictEqual(github.createCommentRequests, [{ ...repo, issue_number: 89, body: `${MARKER}\nnew body` }]);
            assert.deepStrictEqual(github.updateCommentRequests, []);
        });

        it('should update the comment of a previous run', async () => {
            const github = await publish({ comments: { 89: [{ id: 1, body: null }, { id: 2, body: `${MARKER}\nold body` }] } });
            assert.deepStrictEqual(github.updateCommentRequests, [{ ...repo, comment_id: 2, body: `${MARKER}\nnew body` }]);
            assert.deepStrictEqual(github.createCommentRequests, []);
        });

        it('should not update the comment of another check', async () => {
            const github = await publish({ comments: { 89: [{ id: 1, body: `${commentMarker('Other check')}\nold body` }] } });
            assert.strictEqual(github.createCommentRequests.length, 1);
            assert.deepStrictEqual(github.updateCommentRequests, []);
        });

        it('should find the comment after the first page', async () => {
            const comments = Array.from({ length: 150 }, (_, index) => ({ id: index, body: `comment ${index}` }));
            comments.push({ id: 150, body: `${MARKER}\nold body` });
            const github = await publish({ comments: { 89: comments } });
            assert.deepStrictEqual(github.updateCommentRequests.map(request => request.comment_id), [150]);
        });
    });
});
