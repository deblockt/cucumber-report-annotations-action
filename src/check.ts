import type { Annotation, CheckRequests, CheckUpdateRequest, GitHubContext, GlobalInformation, Inputs } from './types';

// the checks API accepts at most 50 annotations per request
const MAX_ANNOTATIONS_PER_REQUEST = 50;

export type CheckStatusInformation = Pick<GlobalInformation, 'failedScenarioNumber' | 'undefinedStepsNumber' | 'pendingStepNumber'>;
type CheckTitleInputs = Pick<Inputs, 'checkName' | 'showNumberOfErrorOnCheckTitle'>;
type CheckStatusInputs = Pick<Inputs, 'checkStatusOnError' | 'checkStatusOnUndefined' | 'checkStatusOnPending'>;

export function buildCheckTitle(globalInformation: Pick<GlobalInformation, 'failedScenarioNumber'>, { checkName, showNumberOfErrorOnCheckTitle }: CheckTitleInputs): string {
    const failed = globalInformation.failedScenarioNumber;
    return showNumberOfErrorOnCheckTitle && failed > 0
        ? `${checkName} (${failed} error${failed > 1 ? 's' : ''})`
        : checkName;
}

export function computeCheckStatus(globalInformation: CheckStatusInformation, { checkStatusOnError, checkStatusOnUndefined, checkStatusOnPending }: CheckStatusInputs): string {
    if (globalInformation.failedScenarioNumber > 0 && checkStatusOnError !== 'success') {
        return checkStatusOnError;
    }
    if (globalInformation.undefinedStepsNumber > 0 && checkStatusOnUndefined !== 'success') {
        return checkStatusOnUndefined;
    }
    if (globalInformation.pendingStepNumber > 0) {
        return checkStatusOnPending;
    }
    return 'success';
}

export interface CheckRequestsParameters {
    context: GitHubContext;
    inputs: CheckTitleInputs & CheckStatusInputs;
    globalInformation: CheckStatusInformation;
    summary: string;
    annotations: Annotation[];
}

export function buildCheckRequests({ context, inputs, globalInformation, summary, annotations }: CheckRequestsParameters): CheckRequests {
    const pullRequest = context.payload.pull_request;
    const output = {
        title: buildCheckTitle(globalInformation, inputs),
        summary
    };
    const updates: CheckUpdateRequest[] = [];
    for (let index = MAX_ANNOTATIONS_PER_REQUEST; index < annotations.length; index += MAX_ANNOTATIONS_PER_REQUEST) {
        updates.push({
            ...context.repo,
            output: { ...output, annotations: annotations.slice(index, index + MAX_ANNOTATIONS_PER_REQUEST) }
        });
    }
    return {
        create: {
            ...context.repo,
            name: inputs.checkName,
            head_sha: pullRequest?.head?.sha || context.sha,
            status: 'completed',
            conclusion: computeCheckStatus(globalInformation, inputs),
            output: { ...output, annotations: annotations.slice(0, MAX_ANNOTATIONS_PER_REQUEST) }
        },
        updates
    };
}

export function shouldFailJob(errorCount: number, { numberOfTestErrorToFailJob }: Pick<Inputs, 'numberOfTestErrorToFailJob'>): boolean {
    return numberOfTestErrorToFailJob !== -1 && errorCount >= numberOfTestErrorToFailJob;
}
