import * as fs from 'fs';
import type {
    Annotation,
    CheckCreateRequest,
    CheckRunUpdateRequest,
    Core,
    FileSystem,
    GitHub,
    GitHubContext,
    Glob,
    JobSummary
} from '../src/types';

export interface FakeCore extends Core {
    outputs: Record<string, number>;
    failures: string[];
    warnings: string[];
    summaryHeadings: { text: string, level?: number | string }[];
    summaryRaws: string[];
}

// fake of @actions/core recording the calls made by the action
export function fakeCore(inputs: Record<string, string> = {}): FakeCore {
    const summary: JobSummary = {
        addHeading(text, level) {
            core.summaryHeadings.push({ text, level });
            return summary;
        },
        addRaw(text) {
            core.summaryRaws.push(text);
            return summary;
        },
        write: async () => summary
    };
    const core: FakeCore = {
        outputs: {},
        failures: [],
        warnings: [],
        summaryHeadings: [],
        summaryRaws: [],
        getInput: name => inputs[name] || '',
        // same rules as @actions/core
        getBooleanInput(name) {
            const value = core.getInput(name);
            if (['true', 'True', 'TRUE'].includes(value)) return true;
            if (['false', 'False', 'FALSE'].includes(value)) return false;
            throw new TypeError(`Input does not meet YAML 1.2 "Core Schema" specification: ${name}`);
        },
        info() {},
        debug() {},
        warning: message => { core.warnings.push(message); },
        setFailed: message => { core.failures.push(message); },
        setOutput: (name, value) => { core.outputs[name] = value; },
        summary
    };
    return core;
}

export interface FakeGitHub extends GitHub {
    tokens: string[];
    createRequests: CheckCreateRequest[];
    updateRequests: CheckRunUpdateRequest[];
}

// fake of @actions/github recording the check requests
export function fakeGithub({ payload = {} }: { payload?: GitHubContext['payload'] } = {}): FakeGitHub {
    const github: FakeGitHub = {
        tokens: [],
        createRequests: [],
        updateRequests: [],
        context: {
            serverUrl: 'https://github.com',
            repo: { owner: 'owner', repo: 'my-repo' },
            sha: 'commit-sha',
            payload
        },
        getOctokit(token) {
            github.tokens.push(token);
            return {
                rest: {
                    checks: {
                        create: async request => {
                            github.createRequests.push(request);
                            return { data: { id: 42 } };
                        },
                        update: async request => {
                            github.updateRequests.push(request);
                            return { data: { id: request.check_run_id } };
                        }
                    }
                }
            };
        }
    };
    return github;
}

export interface FakeGlob extends Glob {
    patterns: string[];
}

// fake of @actions/glob returning the files configured for each pattern
export function fakeGlob(filesByPattern: Record<string, string[]> = {}): FakeGlob {
    const glob: FakeGlob = {
        patterns: [],
        create: async pattern => {
            glob.patterns.push(pattern);
            return { glob: async () => filesByPattern[pattern] || [] };
        }
    };
    return glob;
}

// fake of fs serving the given contents, and the real files otherwise
export function fakeFs(contentByFile: Record<string, string> = {}): FileSystem {
    return {
        promises: {
            readFile: async file => file in contentByFile ? contentByFile[file] : fs.promises.readFile(file)
        }
    };
}

// builds a cucumber json report with one failing scenario per entry
export function jsonReport(features: { uri: string, scenarios: string[] }[]): string {
    return JSON.stringify(features.map(({ uri, scenarios }) => ({
        uri,
        name: uri,
        elements: scenarios.map((name, index) => ({
            name,
            line: index + 1,
            type: 'scenario',
            steps: [{ name: 'a failing step', line: index + 2, result: { status: 'failed', error_message: 'boom' } }]
        }))
    })));
}

// builds an annotation with the given title
export function annotation(title: string): Annotation {
    return {
        path: 'a.feature',
        start_line: 0,
        end_line: 0,
        start_column: 0,
        end_column: 0,
        annotation_level: 'failure',
        title,
        message: ''
    };
}
