const fs = require('fs');

// fake of @actions/core recording the calls made by the action
function fakeCore(inputs = {}) {
    const core = {
        outputs: {},
        failures: [],
        warnings: [],
        summaryHeadings: [],
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
        warning: message => core.warnings.push(message),
        setFailed: message => core.failures.push(message),
        setOutput: (name, value) => { core.outputs[name] = value; },
        summary: {
            addHeading(text, level) {
                core.summaryHeadings.push({ text, level });
                return this;
            },
            addRaw() {
                return this;
            },
            write: async () => {}
        }
    };
    return core;
}

// fake of @actions/github recording the check requests
function fakeGithub({ payload = {} } = {}) {
    const github = {
        tokens: [],
        createRequests: [],
        updateRequests: [],
        context: {
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

// fake of @actions/glob returning the files configured for each pattern
function fakeGlob(filesByPattern = {}) {
    const glob = {
        patterns: [],
        create: async pattern => {
            glob.patterns.push(pattern);
            return { glob: async () => filesByPattern[pattern] || [] };
        }
    };
    return glob;
}

// fake of fs serving the given contents, and the real files otherwise
function fakeFs(contentByFile = {}) {
    return {
        promises: {
            readFile: async file => file in contentByFile ? contentByFile[file] : fs.promises.readFile(file)
        }
    };
}

// builds a cucumber json report with one failing scenario per entry
function jsonReport(features) {
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

module.exports = {
    fakeCore,
    fakeGithub,
    fakeGlob,
    fakeFs,
    jsonReport
};
