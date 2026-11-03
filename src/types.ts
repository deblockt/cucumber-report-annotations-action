// Types shared by the modules of the action
import type { JobSummarySection } from './jobSummary';

export type ScenarioStatus = 'success' | 'failed' | 'skipped' | 'undefined' | 'pending';

// a failed, undefined or pending step of a scenario, as read from a report
export interface StepData {
    file: string;
    line?: number;
    title: string;
    step: string;
    error?: string;
}

export interface ScenarioReport {
    name: string;
    status: ScenarioStatus;
}

export interface FileReport {
    file: string;
    name: string;
    scenarios: ScenarioReport[];
}

export interface GlobalInformation {
    scenarioNumber: number;
    failedScenarioNumber: number;
    pendingScenarioNumber: number;
    undefinedScenarioNumber: number;
    stepsNumber: number;
    succeedScenarioNumber: number;
    failedStepsNumber: number;
    skippedStepsNumber: number;
    undefinedStepsNumber: number;
    succeedStepsNumber: number;
    pendingStepNumber: number;
}

export const EMPTY_GLOBAL_INFO: Readonly<GlobalInformation> = {
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
};

// common interface of the json and ndjson report readers
export interface ReportResult {
    readonly listAllScenarioByFile: FileReport[];
    readonly globalInformation: GlobalInformation;
    readonly failedSteps: StepData[];
    readonly undefinedSteps: StepData[];
    readonly pendingSteps: StepData[];
}

export interface ReportReader {
    reader(report: string | Buffer): ReportResult;
}

// values accepted by the GitHub checks API, documented in action.yml
export type CheckConclusion = 'success' | 'neutral' | 'failure';
export type AnnotationLevel = 'notice' | 'warning' | 'failure';

export interface Inputs {
    inputPath: string;
    checkName: string;
    accessToken: string;
    checkStatusOnError: CheckConclusion;
    checkStatusOnUndefined: CheckConclusion;
    checkStatusOnPending: CheckConclusion;
    annotationStatusOnError: AnnotationLevel;
    // an empty value means that the steps are not annotated
    annotationStatusOnUndefined: AnnotationLevel | '';
    annotationStatusOnPending: AnnotationLevel | '';
    showNumberOfErrorOnCheckTitle: boolean;
    numberOfTestErrorToFailJob: number;
    showGlobalSummaryReport: boolean;
    ignoreNoReportFound: boolean;
    maxNumberOfAnnotations: number;
    jobSummaryContent: JobSummarySection[];
}

export interface SummaryCounts {
    scenarios: Record<string, number>;
    steps: Record<string, number>;
}

export type Annotation = {
    path: string;
    start_line: number;
    end_line: number;
    start_column: number;
    end_column: number;
    annotation_level: AnnotationLevel;
    title: string;
    message: string;
};

export type CheckOutput = {
    title: string;
    summary: string;
    annotations: Annotation[];
};

export type Repo = {
    owner: string;
    repo: string;
};

export type CheckCreateRequest = Repo & {
    name: string;
    head_sha: string;
    status: 'completed';
    conclusion: CheckConclusion;
    output: CheckOutput;
};

export type CheckUpdateRequest = Repo & {
    output: CheckOutput;
};

export type CheckRunUpdateRequest = CheckUpdateRequest & {
    check_run_id: number;
};

export type CheckRequests = {
    create: CheckCreateRequest;
    // updates sending the annotations that do not fit in the create request
    updates: CheckUpdateRequest[];
};

// returns the path of a feature file relative to the repository, or undefined when it is not found
export type PathResolver = (file: string) => Promise<string | undefined>;

// subset of @actions/core used by the action
export interface Core {
    getInput(name: string): string;
    getBooleanInput(name: string): boolean;
    info(message: string): void;
    debug(message: string): void;
    warning(message: string): void;
    setFailed(message: string): void;
    setOutput(name: string, value: number): void;
    summary: JobSummary;
}

export interface JobSummary {
    addHeading(text: string, level?: number | string): JobSummary;
    addRaw(text: string, addEOL?: boolean): JobSummary;
    write(): Promise<unknown>;
}

// subset of @actions/github used by the action
export interface GitHubContext {
    serverUrl: string;
    repo: Repo;
    sha: string;
    payload: {
        pull_request?: {
            [key: string]: unknown;
            head?: { sha?: string };
        };
    };
}

export interface CheckRunResponse {
    data: { id: number };
}

export interface Octokit {
    rest: {
        checks: {
            create(request: CheckCreateRequest): Promise<CheckRunResponse>;
            update(request: CheckRunUpdateRequest): Promise<unknown>;
        };
    };
}

export interface GitHub {
    context: GitHubContext;
    getOctokit(token: string): Octokit;
}

// subset of @actions/glob used by the action
export interface Glob {
    create(pattern: string, options?: { followSymbolicLinks?: boolean }): Promise<Globber>;
}

export interface Globber {
    glob(): Promise<string[]>;
}

// subset of fs used by the action
export interface FileSystem {
    promises: {
        readFile(path: string): Promise<string | Buffer>;
    };
}

export interface Dependencies {
    core: Core;
    github: GitHub;
    glob: Glob;
    fs: FileSystem;
    workspace?: string;
}
