// the checks API accepts at most 50 annotations per request
const MAX_ANNOTATIONS_PER_REQUEST = 50;

function buildCheckTitle(globalInformation, { checkName, showNumberOfErrorOnCheckTitle }) {
    const failed = globalInformation.failedScenarioNumber;
    return showNumberOfErrorOnCheckTitle && failed > 0
        ? `${checkName} (${failed} error${failed > 1 ? 's' : ''})`
        : checkName;
}

function computeCheckStatus(globalInformation, { checkStatusOnError, checkStatusOnUndefined, checkStatusOnPending }) {
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

function buildCheckRequests({ context, inputs, globalInformation, summary, annotations }) {
    const pullRequest = context.payload.pull_request;
    const output = {
        title: buildCheckTitle(globalInformation, inputs),
        summary
    };
    const updates = [];
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
            head_sha: (pullRequest && pullRequest.head.sha) || context.sha,
            status: 'completed',
            conclusion: computeCheckStatus(globalInformation, inputs),
            output: { ...output, annotations: annotations.slice(0, MAX_ANNOTATIONS_PER_REQUEST) }
        },
        updates
    };
}

function shouldFailJob(errorCount, { numberOfTestErrorToFailJob }) {
    return numberOfTestErrorToFailJob !== -1 && errorCount >= numberOfTestErrorToFailJob;
}

module.exports = {
    buildCheckTitle,
    computeCheckStatus,
    buildCheckRequests,
    shouldFailJob
};
