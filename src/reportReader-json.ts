import { EMPTY_GLOBAL_INFO } from './types';
import type { FileReport, GlobalInformation, ReportResult, ScenarioStatus, StepData } from './types';

// subset of the cucumber json report format read by the action
interface JsonStep {
    name?: string;
    line?: number;
    keyword?: string;
    hidden?: boolean;
    result: {
        status: string;
        error_message?: string;
    };
}

interface JsonElement {
    name: string;
    line: number;
    type: string;
    before?: JsonStep[];
    after?: JsonStep[];
    steps?: JsonStep[];
}

interface JsonFeature {
    uri: string;
    name: string;
    elements: JsonElement[];
}

export function reader(reportString: string | Buffer): ReportResult {
    const report: JsonFeature[] = JSON.parse(reportString.toString())
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
            return report.flatMap(fileFailureStepData);
        },
        get undefinedSteps() {
            return report.flatMap(fileUndefinedStepsData);
        },
        get pendingSteps() {
            return report.flatMap(filePendingStepsData);
        }
    }
}

function fileFailureStepData(fileReport: JsonFeature): StepData[] {
    return fileReport.elements
        .filter(scenario => hasFailed(scenario))
        .map(failedScenario => buildFailData(fileReport, failedScenario));
}

function fileUndefinedStepsData(fileReport: JsonFeature): StepData[] {
    return fileReport.elements
        .filter(scenario => hasUndefined(scenario))
        .map(undefinedScenario => buildUndefinedData(fileReport, undefinedScenario));
}

function filePendingStepsData(fileReport: JsonFeature): StepData[] {
    return fileReport.elements
        .filter(scenario => hasPending(scenario))
        .map(pendingScenario => buildPendingData(fileReport, pendingScenario));
}

function fileAllScenario(fileReport: JsonFeature): FileReport {
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

function sum(info1: GlobalInformation, info2: GlobalInformation): GlobalInformation {
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

function globalFileInformation(reportFile: JsonFeature): GlobalInformation {
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

    const result: GlobalInformation = {
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
function isHook(scenario: JsonElement, step: JsonStep): boolean {
    return !!step.hidden
        || (scenario.before || []).includes(step)
        || (scenario.after || []).includes(step);
}

function countStepsWithoutHooks(reportFile: JsonFeature, predicate: (step: JsonStep) => boolean): number {
    return reportFile.elements
        .map(scenario => (scenario.steps || [])
            .filter(step => !isHook(scenario, step) && predicate(step))
            .length)
        .reduce((a, b) => a + b, 0);
}

function getFailedSteps(scenario: JsonElement): JsonStep[] {
    return getStepByStatus(scenario, 'failed');
}
function getUndefinedSteps(scenario: JsonElement): JsonStep[] {
    return getStepByStatus(scenario, 'undefined');
}
function getPendingSteps(scenario: JsonElement): JsonStep[] {
    return getStepByStatus(scenario, 'pending');
}
function getScenarioStatus(scenario: JsonElement): ScenarioStatus {
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

function getStepByStatus(scenario: JsonElement, status: string): JsonStep[] {
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === status);
}

function hasFailed(scenario: JsonElement): boolean {
    return getFailedSteps(scenario).length > 0;
}

function hasUndefined(scenario: JsonElement): boolean {
    return getUndefinedSteps(scenario).length > 0;
}

function hasPending(scenario: JsonElement): boolean {
    return getPendingSteps(scenario).length > 0;
}

function buildFailData(fileReport: JsonFeature, scenario: JsonElement): StepData {
    return buildStepData(fileReport, scenario, getFailedSteps);
}

function buildUndefinedData(fileReport: JsonFeature, scenario: JsonElement): StepData {
    return buildStepData(fileReport, scenario, getUndefinedSteps);
}

function buildPendingData(fileReport: JsonFeature, scenario: JsonElement): StepData {
    return buildStepData(fileReport, scenario, getPendingSteps);
}

function getHookName(scenario: JsonElement, hook: JsonStep): string {
    if (hook.keyword) {
        return `${hook.keyword.trim()} hook`;
    } else if ((scenario.before || []).includes(hook)) {
        return 'Before hook';
    } else if ((scenario.after || []).includes(hook)) {
        return 'After hook';
    }
    return 'Hook';
}

function buildStepData(fileReport: JsonFeature, scenario: JsonElement, getStepsFunction: (scenario: JsonElement) => JsonStep[]): StepData {
    const step = getStepsFunction(scenario)[0];
    const stepIsHook = isHook(scenario, step);
    return {
        file: fileReport.uri,
        line: stepIsHook ? scenario.line : step.line,
        title: scenario.name,
        step: stepIsHook ? getHookName(scenario, step) : step.name ?? '',
        error: step.result.error_message
    }
}
