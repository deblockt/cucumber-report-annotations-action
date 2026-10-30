// Regenerate the cucumber reports used by the reader tests: node test/fixtures/generate.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const fixturesDir = __dirname;
const reportsDir = path.join(fixturesDir, 'reports');
const extraArgs = {
    'retry': ['--retry', '1']
};

function run(name, features, requireGlob, args = []) {
    spawnSync('npx', [
        'cucumber-js', ...features,
        '--require', requireGlob,
        '--format', `json:${path.join(reportsDir, name + '.json')}`,
        '--format', `message:${path.join(reportsDir, name + '.ndjson')}`,
        ...args
    ], { stdio: 'inherit' });
    // remove local absolute paths (stack traces) from the generated reports
    for (const extension of ['.json', '.ndjson']) {
        const reportFile = path.join(reportsDir, name + extension);
        const content = fs.readFileSync(reportFile, 'utf8');
        fs.writeFileSync(reportFile, content.split(process.cwd() + path.sep).join(''));
    }
}

// nominal report built from the features used by the action workflow tests
run('nominal', ['cucumber/js/features'], 'cucumber/js/step-definitions/**/*.js');

for (const feature of fs.readdirSync(path.join(fixturesDir, 'features'))) {
    const name = path.basename(feature, '.feature');
    run(name, [path.relative('.', path.join(fixturesDir, 'features', feature))], 'test/fixtures/support/**/*.js', extraArgs[name]);
}
