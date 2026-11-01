import { EMPTY_GLOBAL_INFO } from './types';
import type { FileReport, GlobalInformation, ReportResult, ScenarioStatus, StepData } from './types';

// subset of the cucumber messages read by the action
interface Location {
    line: number;
    column?: number;
}

interface GherkinStep {
    id: string;
    location: Location;
}

interface FeatureChild {
    rule?: { children: FeatureChild[] };
    background?: { steps: GherkinStep[] };
    scenario?: {
        id: string;
        name: string;
        location: Location;
        steps: GherkinStep[];
    };
}

interface Hook {
    id: string;
    name?: string;
    type?: string;
}

interface TestStepResult {
    status: string;
    message?: string;
}

interface Envelope {
    gherkinDocument?: {
        uri: string;
        feature: {
            name: string;
            location: Location;
            children: FeatureChild[];
        };
    };
    pickle?: {
        id: string;
        name: string;
        astNodeIds: string[];
        steps: { id: string; text: string; astNodeIds: string[] }[];
    };
    hook?: Hook;
    testCase?: {
        id: string;
        pickleId: string;
        testSteps: { id: string; pickleStepId?: string; hookId?: string }[];
    };
    testCaseStarted?: {
        id: string;
        testCaseId: string;
    };
    testStepFinished?: {
        testCaseStartedId: string;
        testStepId: string;
        testStepResult: TestStepResult;
    };
    testCaseFinished?: {
        testCaseStartedId: string;
        willBeRetried: boolean;
    };
}

// model built from the messages
interface Feature {
    name: string;
    location: Location;
    uri: string;
    scenarios: Scenario[];
}

interface Scenario {
    name: string;
    id: string;
    location: Location;
    uri: string;
    pickles: Record<string, Pickle>;
}

interface Pickle {
    name: string;
    scenario: Scenario;
    steps: PickleStep[];
    // only set for the pickles that were run
    testCase?: FinishedTestCase;
}

interface PickleStep {
    id: string;
    name: string;
    location: Location;
}

interface TestStep {
    id: string;
    // undefined for hook steps
    pickleStep?: PickleStep;
    hook?: Hook;
}

interface TestCase {
    id: string;
    pickle: Pickle;
    steps: TestStep[];
}

interface FinishedTestStep extends TestStep {
    result: TestStepResult;
}

interface FinishedTestCase extends TestCase {
    steps: FinishedTestStep[];
}

interface TestCaseStarted {
    testCase: TestCase;
    results: Record<string, TestStepResult>;
}

export function reader(reportString: string | Buffer): ReportResult {
    const features: Feature[] = []
    const scenario: Record<string, Scenario> = {}
    const steps: Record<string, { location: Location }> = {}
    const pickles: Record<string, Pickle> = {}
    const picklesSteps: Record<string, PickleStep> = {}
    const hooks: Record<string, Hook> = {}
    const testCases: Record<string, TestCase> = {}
    const testCasesStarted: Record<string, TestCaseStarted> = {}
    const finishedTestCases: FinishedTestCase[] = []
    reportString
        .toString().split('\n')
        .filter(it => it !== '')
        .forEach(line => {
            const element: Envelope = JSON.parse(line)
            if (element.gherkinDocument) {
                const gherkinDocument = element.gherkinDocument
                const feature = gherkinDocument.feature
                // scenarios and backgrounds can be nested in rules
                const children = feature.children
                        .flatMap(it => it.rule ? it.rule.children : [it])
                const scenarios: Scenario[] = []
                children.forEach(it => {
                    if (it.scenario) {
                        const sc: Scenario = {
                            name: it.scenario.name,
                            id: it.scenario.id,
                            location: it.scenario.location,
                            uri: gherkinDocument.uri,
                            pickles: {}
                        }
                        scenario[sc.id] = sc
                        scenarios.push(sc)
                    }
                })
                children.forEach(it => {
                    const scenarioSteps = it.background?.steps ?? it.scenario?.steps ?? []
                    scenarioSteps.forEach(step => {
                        steps[step.id] = {
                            location: step.location
                        }
                    })
                })

                features.push({
                    name: feature.name,
                    location: feature.location,
                    uri: gherkinDocument.uri,
                    scenarios: scenarios
                })
            } else if (element.pickle) {
                const pk: Pickle = {
                    name: element.pickle.name,
                    scenario: scenario[element.pickle.astNodeIds[0]],
                    steps: element.pickle.steps.map(it => {
                        return ({
                            id: it.id,
                            name: it.text,
                            location: steps[it.astNodeIds[0]].location
                        })
                    })
                }
                pk.steps.forEach(it => picklesSteps[it.id] = it)
                scenario[element.pickle.astNodeIds[0]].pickles[element.pickle.id] = pk
                pickles[element.pickle.id] = pk
            } else if (element.hook) {
                hooks[element.hook.id] = element.hook
            } else if (element.testCase) {
                const testCase: TestCase = {
                    id: element.testCase.id,
                    pickle: pickles[element.testCase.pickleId],
                    // hook steps have a hookId instead of a pickleStepId
                    steps: element.testCase.testSteps.map(it => ({
                        id: it.id,
                        pickleStep: it.pickleStepId === undefined ? undefined : picklesSteps[it.pickleStepId],
                        hook: it.hookId === undefined ? undefined : hooks[it.hookId]
                    }))
                }
                testCases[testCase.id] = testCase
            } else if (element.testCaseStarted) {
                testCasesStarted[element.testCaseStarted.id] = {
                    testCase: testCases[element.testCaseStarted.testCaseId],
                    results: {}
                }
            } else if (element.testStepFinished) {
                const testCaseStarted = testCasesStarted[element.testStepFinished.testCaseStartedId]
                testCaseStarted.results[element.testStepFinished.testStepId] = element.testStepFinished.testStepResult
            } else if (element.testCaseFinished) {
                const testCaseStartedId = element.testCaseFinished.testCaseStartedId
                // only the last attempt of a retried test case is kept
                if (!element.testCaseFinished.willBeRetried) {
                    const testCaseStarted = testCasesStarted[testCaseStartedId]
                    const testCase = testCaseStarted.testCase
                    const finishedTestCase: FinishedTestCase = {
                        ...testCase,
                        steps: testCase.steps.map(step => ({ ...step, result: testCaseStarted.results[step.id] }))
                    }
                    testCase.pickle.testCase = finishedTestCase
                    finishedTestCases.push(finishedTestCase)
                }
                delete testCasesStarted[testCaseStartedId]
            }
        });

    const globalInfo = globalInformation(finishedTestCases)

    return {
        get listAllScenarioByFile(): FileReport[] {
            return features
                .map(feature => ({
                    file: feature.uri,
                    name: feature.name,
                    scenarios: feature.scenarios
                        .flatMap(scenario =>
                            Object.values(scenario.pickles)
                                // pickles excluded by a tag filter have no test case
                                .flatMap(pickle => pickle.testCase ? [{
                                    name: scenario.name,
                                    status: getTestCaseStatus(pickle.testCase)
                                }] : [])
                        )
                }))
                .filter(feature => feature.scenarios.length > 0)
        },
        get globalInformation() {
            return globalInfo
        },
        get failedSteps() {
            return getStepsByStatus(finishedTestCases, 'FAILED')
        },
        get undefinedSteps() {
            return getStepsByStatus(finishedTestCases, 'UNDEFINED')
        },
        get pendingSteps() {
            return getStepsByStatus(finishedTestCases, 'PENDING')
        }
    }
}

function globalInformation(testCases: FinishedTestCase[]): GlobalInformation {
    const globalInfo = { ...EMPTY_GLOBAL_INFO }
    testCases.forEach(testCase => {
        // hooks are used for the scenario status but are not counted as steps
        const allStatuses = testCase.steps.map(step => step.result.status)
        const stepStatuses = testCase.steps
            .filter(step => step.pickleStep)
            .map(step => step.result.status)
        const countSteps = (status: string) => stepStatuses.filter(it => it === status).length

        globalInfo.scenarioNumber++
        if (allStatuses.includes('FAILED')) {
            globalInfo.failedScenarioNumber++
        }
        if (allStatuses.includes('PENDING')) {
            globalInfo.pendingScenarioNumber++
        }
        if (allStatuses.includes('UNDEFINED')) {
            globalInfo.undefinedScenarioNumber++
        }

        globalInfo.stepsNumber += stepStatuses.length
        globalInfo.failedStepsNumber += countSteps('FAILED')
        globalInfo.pendingStepNumber += countSteps('PENDING')
        globalInfo.undefinedStepsNumber += countSteps('UNDEFINED')
        globalInfo.skippedStepsNumber += countSteps('SKIPPED')
        globalInfo.succeedStepsNumber += countSteps('PASSED')
    })

    globalInfo.succeedScenarioNumber = globalInfo.scenarioNumber
        - globalInfo.failedScenarioNumber - globalInfo.pendingScenarioNumber - globalInfo.undefinedScenarioNumber;

    return globalInfo
}

function getStepsByStatus(testCases: FinishedTestCase[], status: string): StepData[] {
    return testCases
                .flatMap(testCase => testCase.steps
                    .filter(it => it.result.status === status)
                    .map(it => {
                        const scenario = testCase.pickle.scenario
                        return ({
                            file: scenario.uri,
                            line: it.pickleStep ? it.pickleStep.location.line : scenario.location.line,
                            title: testCase.pickle.name,
                            step: it.pickleStep ? it.pickleStep.name : getHookName(it.hook),
                            error: it.result.message
                        })
                    })
                )
}

function getHookName(hook: Hook | undefined): string {
    if (hook?.name) {
        return hook.name
    }
    switch (hook?.type) {
        case 'BEFORE_TEST_CASE':
            return 'Before hook'
        case 'AFTER_TEST_CASE':
            return 'After hook'
        default:
            return 'Hook'
    }
}

function getTestCaseStatus(testCase: FinishedTestCase): ScenarioStatus {
    const steps = testCase.steps;
    for (const step of steps) {
        if (step.result.status === 'FAILED') {
            return 'failed';
        } else if (step.result.status === 'SKIPPED') {
            return 'skipped';
        } else if (step.result.status === 'UNDEFINED') {
            return 'undefined';
        } else if (step.result.status === 'PENDING') {
            return 'pending';
        }
    }
    return 'success';
}
