const EMPTY_GLOBAL_INFO = {
    scenarioNumber: 0,
    failedScenarioNumber: 0,
    pendingScenarioNumber: 0,
    undefinedScenarioNumber: 0,
    stepsNumber: 0,
    succeedScenarioNumber: 0,
    failedStepsNumber: 0,
    skippedStepsNumber: 0,
    undefinedStepsNumber: 0,
    succeedStepsNumber: 0,
    pendingStepNumber: 0
}

module.exports.reader = (reportString) => {
    const report = JSON.parse(reportString)
    return {
        get listAllScenarioByFile() {
            return report
                .map(fileReport => fileAllScenario(fileReport))
        },
        get globalInformation() {
            return report
                .map(fileReport => globalFileInformation(fileReport))
                .reduce((a, b) => sum(a, b), EMPTY_GLOBAL_INFO);
        },
        get failedSteps() {
            return report
                .map(fileReport => fileFailureStepData(fileReport))
                .reduce((a, b) => a.concat(b), []);
        },
        get undefinedSteps() {
            return report
                .map(fileReport => fileUndefinedStepsData(fileReport))
                .reduce((a, b) => a.concat(b), []);
        },
        get pendingSteps() {
            return report
                .map(fileReport => filePendingStepsData(fileReport))
                .reduce((a, b) => a.concat(b), []);
        }
    }
}

function fileFailureStepData(fileReport) {
    return fileReport.elements
        .filter(scenario => hasFailed(scenario))
        .map(failedScenario => buildFailData(fileReport, failedScenario));
}

function fileUndefinedStepsData(fileReport) {
    return fileReport.elements
        .filter(scenario => hasUndefined(scenario))
        .map(undefinedScenario => buildUndefinedData(fileReport, undefinedScenario));
}

function filePendingStepsData(fileReport) {
    return fileReport.elements
        .filter(scenario => hasPending(scenario))
        .map(pendingScenario => buildPendingData(fileReport, pendingScenario));
}

function fileAllScenario(fileReport) {
    return {
        file: fileReport.uri,
        name: fileReport.name,
        scenarios: fileReport.elements
            .map(scenario => ({
                name: scenario.name,
                status: getScenarioStatus(scenario)
            }))
    }
}

function sum(info1, info2) {
    return {
        scenarioNumber: info1.scenarioNumber + info2.scenarioNumber,
        failedScenarioNumber: info1.failedScenarioNumber + info2.failedScenarioNumber,
        pendingScenarioNumber: info1.pendingScenarioNumber + info2.pendingScenarioNumber,
        undefinedScenarioNumber: info1.undefinedScenarioNumber + info2.undefinedScenarioNumber,
        stepsNumber: info1.stepsNumber + info2.stepsNumber,
        succeedScenarioNumber: info1.succeedScenarioNumber + info2.succeedScenarioNumber,
        failedStepsNumber: info1.failedStepsNumber + info2.failedStepsNumber,
        skippedStepsNumber: info1.skippedStepsNumber + info2.skippedStepsNumber,
        undefinedStepsNumber: info1.undefinedStepsNumber + info2.undefinedStepsNumber,
        succeedStepsNumber: info1.succeedStepsNumber + info2.succeedStepsNumber,
        pendingStepNumber: info1.pendingStepNumber + info2.pendingStepNumber
    }
}

function globalFileInformation(reportFile) {
    const scenario = reportFile.elements
        .filter(element => element.type === 'scenario');

    const failedScenarioNumber = scenario
        .filter(scenario => hasFailed(scenario))
        .length;
    const undefinedScenarioNumber = scenario
        .filter(scenario => hasUndefined(scenario))
        .length;
    const pendingScenarioNumber = scenario
        .filter(scenario => hasPending(scenario))
        .length;
    // hooks are used for the scenario status but are not counted as steps
    const stepsNumber = countStepsWithoutHooks(reportFile, () => true);
    const failedStepsNumber = countStepsWithoutHooks(reportFile, step => step.result.status === 'failed');
    const skippedStepsNumber = countStepsWithoutHooks(reportFile, step => step.result.status === 'skipped');
    const undefinedStepsNumber = countStepsWithoutHooks(reportFile, step => step.result.status === 'undefined');
    const pendingStepNumber = countStepsWithoutHooks(reportFile, step => step.result.status === 'pending');

    const result =  {
        scenarioNumber: scenario.length,
        failedScenarioNumber: failedScenarioNumber,
        undefinedScenarioNumber: undefinedScenarioNumber,
        pendingScenarioNumber: pendingScenarioNumber,
        succeedScenarioNumber: scenario.length - failedScenarioNumber - undefinedScenarioNumber - pendingScenarioNumber,
        stepsNumber: stepsNumber,
        failedStepsNumber: failedStepsNumber,
        skippedStepsNumber: skippedStepsNumber,
        undefinedStepsNumber: undefinedStepsNumber,
        pendingStepNumber: pendingStepNumber,
        succeedStepsNumber: stepsNumber - failedStepsNumber - skippedStepsNumber - undefinedStepsNumber - pendingStepNumber
    };

    return result;
}

// depending on the cucumber version, hooks are in before/after or in steps with the hidden flag
function isHook(scenario, step) {
    return step.hidden
        || (scenario.before || []).includes(step)
        || (scenario.after || []).includes(step);
}

function countStepsWithoutHooks(reportFile, predicate) {
    return reportFile.elements
        .map(scenario => (scenario.steps || [])
            .filter(step => !isHook(scenario, step) && predicate(step))
            .length)
        .reduce((a, b) => a + b, 0);
}

function getFailedSteps(scenario) {
    return getStepByStatus(scenario, 'failed');
}
function getUndefinedSteps(scenario) {
    return getStepByStatus(scenario, 'undefined');
}
function getPendingSteps(scenario) {
    return getStepByStatus(scenario, 'pending');
}
function getScenarioStatus(scenario) {
    const steps = [...scenario.before || [], ...scenario.after || [], ...scenario.steps || []];
    for (const step of steps) {
        if (step.result.status === 'failed') {
            return 'failed';
        } else if (step.result.status === 'skipped') {
            return 'skipped';
        } else if (step.result.status === 'undefined') {
            return 'undefined';
        } else if (step.result.status === 'pending') {
            return 'pending';
        }
    }
    return 'success';
}

function getStepByStatus(scenario, status) {
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === status);
}

function hasFailed(scenario) {
    return getFailedSteps(scenario).length > 0;
}

function hasUndefined(scenario) {
    return getUndefinedSteps(scenario).length > 0;
}

function hasPending(scenario) {
    return getPendingSteps(scenario).length > 0;
}

function buildFailData(fileReport, scenario) {
    return buildStepData(fileReport, scenario, getFailedSteps);
}

function buildUndefinedData(fileReport, scenario) {
    return buildStepData(fileReport, scenario, getUndefinedSteps);
}

function buildPendingData(fileReport, scenario) {
    return buildStepData(fileReport, scenario, getPendingSteps);
}

function getHookName(scenario, hook) {
    if (hook.keyword) {
        return `${hook.keyword.trim()} hook`;
    } else if ((scenario.before || []).includes(hook)) {
        return 'Before hook';
    } else if ((scenario.after || []).includes(hook)) {
        return 'After hook';
    }
    return 'Hook';
}

function buildStepData(fileReport, scenario, getStepsFunction) {
    const step = getStepsFunction(scenario)[0];
    const stepIsHook = isHook(scenario, step);
    return {
        file: fileReport.uri,
        line: stepIsHook ? scenario.line : step.line,
        title: scenario.name,
        step: stepIsHook ? getHookName(scenario, step) : step.name,
        error: step.result.error_message
    }
}