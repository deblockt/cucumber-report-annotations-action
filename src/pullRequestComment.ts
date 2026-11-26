import type { Core, IssueComment, Octokit, Repo } from './types';

// the body of an issue comment is limited to 65536 characters
export const MAX_COMMENT_LENGTH = 65536;

const COMMENTS_PER_PAGE = 100;

// the report of one cucumber file in the comment
export interface CommentReport {
    title: string;
    // the sections of job-summary-content, empty when the job summary is disabled
    jobSummary: string;
    // the number of scenarios and steps by status, written when there is no job summary or when it does not fit in the comment
    counts: string;
}

export interface PullRequestCommentParameters {
    marker: string;
    reports: CommentReport[];
    runUrl: string;
}

export interface PublishCommentParameters {
    core: Core;
    octokit: Octokit;
    repo: Repo;
    pullRequestNumber: number;
    marker: string;
    body: string;
}

// reads the pull-request-number input, undefined when no comment should be written
export function parsePullRequestNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed === '') {
        return undefined;
    }
    if (!/^[1-9]\d*$/.test(trimmed)) {
        throw new Error(`Invalid pull-request-number "${value}": a positive integer is expected.`);
    }
    return Number(trimmed);
}

// hidden marker identifying the comment of a check, to update it on the next runs
export function commentMarker(checkName: string): string {
    return `<!-- cucumber-report-annotations-action: ${checkName.replace(/-->/g, '')} -->`;
}

function renderComment(marker: string, reports: { title: string, content: string }[], footer: string): string {
    const body = reports.map(({ title, content }) => `### ${title}` + (content ? `\n\n${content}` : '')).join('\n\n');
    return `${marker}\n${body}\n\n${footer}`;
}

// the comment with the job summary content of each report, or only the counts when it is too long
export function buildPullRequestComment({ marker, reports, runUrl }: PullRequestCommentParameters): string {
    const runLink = `[workflow run](${runUrl})`;
    const comment = renderComment(marker, reports.map(({ title, jobSummary, counts }) => ({ title, content: jobSummary || counts })), `<sub>Published by the ${runLink}.</sub>`);
    if (comment.length <= MAX_COMMENT_LENGTH) {
        return comment;
    }
    const countsOnly = renderComment(
        marker,
        reports.map(({ title, counts }) => ({ title, content: counts })),
        `<sub>The details are too long for a comment, they are in the job summary of the ${runLink}.</sub>`
    );
    return countsOnly.length <= MAX_COMMENT_LENGTH
        ? countsOnly
        : `${marker}\nThe report is too long for a comment, it is in the job summary of the ${runLink}.`;
}

async function findComment(octokit: Octokit, repo: Repo, issueNumber: number, marker: string): Promise<IssueComment | undefined> {
    for (let page = 1; ; page++) {
        const { data } = await octokit.rest.issues.listComments({ ...repo, issue_number: issueNumber, per_page: COMMENTS_PER_PAGE, page });
        const comment = data.find(comment => comment.body?.startsWith(marker));
        if (comment || data.length < COMMENTS_PER_PAGE) {
            return comment;
        }
    }
}

// creates the comment on the pull request, or updates the one written by a previous run for the same check
export async function publishPullRequestComment({ core, octokit, repo, pullRequestNumber, marker, body }: PublishCommentParameters): Promise<void> {
    const existing = await findComment(octokit, repo, pullRequestNumber, marker);
    if (existing) {
        core.info(`Updating the comment ${existing.id} of the pull request #${pullRequestNumber}`);
        await octokit.rest.issues.updateComment({ ...repo, comment_id: existing.id, body });
    } else {
        core.info(`Commenting the pull request #${pullRequestNumber}`);
        await octokit.rest.issues.createComment({ ...repo, issue_number: pullRequestNumber, body });
    }
}
