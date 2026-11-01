function buildCheckTitle(globalInformation, { checkName, showNumberOfErrorOnCheckTitle }) {
    const failed = globalInformation.failedScenarioNumber;
    return showNumberOfErrorOnCheckTitle == 'true' && failed > 0
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

function buildCheckRequest({ context, inputs, globalInformation, summary, annotations }) {
    const pullRequest = context.payload.pull_request;
    return {
        ...context.repo,
        name: inputs.checkName,
        head_sha: (pullRequest && pullRequest.head.sha) || context.sha,
        status: 'completed',
        conclusion: computeCheckStatus(globalInformation, inputs),
        output: {
            title: buildCheckTitle(globalInformation, inputs),
            summary,
            annotations
        }
    };
}

function shouldFailJob(errorCount, { numberOfTestErrorToFailJob }) {
    return numberOfTestErrorToFailJob != -1 && errorCount >= numberOfTestErrorToFailJob;
}

module.exports = {
    buildCheckTitle,
    computeCheckStatus,
    buildCheckRequest,
    shouldFailJob
};
