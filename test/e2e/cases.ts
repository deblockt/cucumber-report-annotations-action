import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

type Conclusion = 'success' | 'neutral' | 'failure';
type Outcome = 'success' | 'failure';
type Scalar = string | number | boolean;

interface ReportDefinition {
    file: string;
    summary: string[];
}

interface CaseDefinition {
    name: string;
    report?: string;
    path?: string;
    extensions?: string[];
    inputs?: Record<string, Scalar>;
    expect?: {
        outcome?: Outcome;
        conclusion?: Conclusion;
        outputs?: Record<string, Scalar>;
    };
}

interface CasesFile {
    extensions: string[];
    reports: Record<string, ReportDefinition>;
    cases: CaseDefinition[];
    additionalChecks?: { name: string; report: string; conclusion: Conclusion }[];
}

interface ActionFile {
    inputs: Record<string, { default?: Scalar }>;
}

interface WorkflowFile {
    jobs: Record<string, { steps: { uses?: string; with?: Record<string, string> }[] }>;
}

/** a run of the action, used as an item of the `action-test` job matrix */
export interface E2eCase {
    checkName: string;
    inputs: Record<string, string>;
    expect: {
        outcome: Outcome;
        outputs: Record<string, string>;
    };
}

/** a check run expected on the tested commit, `conclusion: null` meaning that no check run should exist */
export interface ExpectedCheck {
    name: string;
    conclusion: Conclusion | null;
    summary: string[];
}

export interface LoadedCases {
    cases: E2eCase[];
    checks: ExpectedCheck[];
}

const ROOT = path.resolve(__dirname, '../..');
const ACCESS_TOKEN_INPUT = 'access-token';
const TEST_JOB = 'action-test';

function readYaml<T>(file: string): T {
    return yaml.load(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;
}

function stringify(values: Record<string, Scalar> = {}): Record<string, string> {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
}

function checkWorkflowInputs(actionInputs: string[], workflow: WorkflowFile): void {
    const step = workflow.jobs[TEST_JOB]?.steps.find(s => s.uses === './');
    if (!step?.with) {
        throw new Error(`no "uses: ./" step with inputs found in the ${TEST_JOB} job`);
    }
    const workflowInputs = Object.keys(step.with);
    const missing = actionInputs.filter(input => !workflowInputs.includes(input));
    const unknown = workflowInputs.filter(input => !actionInputs.includes(input));
    if (missing.length || unknown.length) {
        throw new Error(`the ${TEST_JOB} job inputs do not match action.yml: missing [${missing}], unknown [${unknown}]`);
    }
    for (const input of actionInputs.filter(input => input !== ACCESS_TOKEN_INPUT)) {
        const expected = `\${{ matrix.case.inputs['${input}'] }}`;
        if (step.with[input] !== expected) {
            throw new Error(`the ${TEST_JOB} job input "${input}" should be "${expected}", got "${step.with[input]}"`);
        }
    }
}

function getReport(file: CasesFile, key: string, caseName: string): ReportDefinition {
    const report = file.reports[key];
    if (!report) {
        throw new Error(`case "${caseName}": unknown report "${key}"`);
    }
    return report;
}

export function loadCases(): LoadedCases {
    const file = readYaml<CasesFile>('test/e2e/cases.yml');
    const action = readYaml<ActionFile>('action.yml');
    const actionInputs = Object.keys(action.inputs);
    checkWorkflowInputs(actionInputs, readYaml<WorkflowFile>('.github/workflows/test.yml'));

    const defaults = Object.fromEntries(actionInputs
        .filter(input => input !== ACCESS_TOKEN_INPUT)
        .map(input => [input, String(action.inputs[input].default ?? '')]));

    const cases: E2eCase[] = [];
    const checks: ExpectedCheck[] = [];
    for (const definition of file.cases) {
        if (!definition.report === !definition.path) {
            throw new Error(`case "${definition.name}": exactly one of report or path must be set`);
        }
        const report = definition.report ? getReport(file, definition.report, definition.name) : undefined;
        if (definition.expect?.conclusion && !report) {
            throw new Error(`case "${definition.name}": a report is required to check the conclusion`);
        }
        const unknownInputs = Object.keys(definition.inputs ?? {}).filter(input => !(input in defaults) || input === 'name' || input === 'path');
        if (unknownInputs.length) {
            throw new Error(`case "${definition.name}": unsupported inputs [${unknownInputs}]`);
        }

        for (const extension of definition.extensions ?? file.extensions) {
            const checkName = `${extension}: ${definition.name}`;
            cases.push({
                checkName,
                inputs: {
                    ...defaults,
                    ...stringify(definition.inputs),
                    name: checkName,
                    path: definition.path ?? `**/${report!.file}.${extension}`
                },
                expect: {
                    outcome: definition.expect?.outcome ?? 'success',
                    outputs: stringify(definition.expect?.outputs)
                }
            });
            checks.push({
                name: checkName,
                conclusion: definition.expect?.conclusion ?? null,
                summary: report?.summary ?? []
            });
        }
    }
    for (const additionalCheck of file.additionalChecks ?? []) {
        checks.push({
            name: additionalCheck.name,
            conclusion: additionalCheck.conclusion,
            summary: getReport(file, additionalCheck.report, additionalCheck.name).summary
        });
    }
    return { cases, checks };
}
