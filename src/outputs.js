const path = require('path');

function reportOutputName(reportFile) {
    return path.basename(reportFile, path.extname(reportFile)).replaceAll(' ', '_');
}

function setOutputs(core, reportFile, counts) {
    const outputName = reportOutputName(reportFile);
    for (const type in counts.scenarios) {
        core.debug(`publish output ${outputName}_${type}_scenarios=${counts.scenarios[type]}`);
        core.setOutput(`${outputName}_${type}_scenarios`, counts.scenarios[type]);
    }
    for (const type in counts.steps) {
        core.debug(`publish output ${outputName}_${type}_steps=${counts.steps[type]}`);
        core.setOutput(`${outputName}_${type}_steps`, counts.steps[type]);
    }
}

module.exports = { setOutputs };
