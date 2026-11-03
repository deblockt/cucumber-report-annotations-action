import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadCases } from './cases.js';

// checks the conclusion and the summary of the check runs created by the end-to-end tests,
// then turns the expected failures into neutral check runs, so the CI ends green
async function verifyChecks(): Promise<void> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error('GITHUB_TOKEN is not set');
    }
    const octokit = github.getOctokit(token);
    const { context } = github;
    const ref = context.payload.pull_request?.head.sha ?? context.sha;

    const errors: string[] = [];
    const toNeutralize: number[] = [];
    for (const { name, conclusion, summary } of loadCases().checks) {
        const { data } = await octokit.rest.checks.listForRef({ ...context.repo, ref, check_name: name, filter: 'latest' });
        const run = data.check_runs[0];
        if (conclusion === null) {
            if (run) {
                errors.push(`${name}: no check run expected, got one with conclusion ${run.conclusion}`);
            }
            continue;
        }
        if (!run) {
            errors.push(`${name}: check run not found`);
            continue;
        }
        if (run.conclusion !== conclusion) {
            errors.push(`${name}: expected conclusion ${conclusion}, got ${run.conclusion}`);
        }
        const actualSummary: string = (run.output.summary ?? '').split('\n').map((line: string) => line.trim()).join('\n');
        if (actualSummary !== summary.join('\n')) {
            errors.push(`${name}: expected summary\n${summary.join('\n')}\ngot\n${actualSummary}`);
        }
        if (conclusion === 'failure' && run.conclusion === 'failure') {
            toNeutralize.push(run.id);
        }
    }
    if (errors.length) {
        throw new Error(errors.join('\n\n'));
    }
    for (const checkRunId of toNeutralize) {
        await octokit.rest.checks.update({ ...context.repo, check_run_id: checkRunId, conclusion: 'neutral' });
    }
    core.info(`all check runs are as expected, ${toNeutralize.length} expected failure(s) turned into neutral`);
}

verifyChecks().catch(error => core.setFailed(error instanceof Error ? error.message : String(error)));
