const path = require('path');

function reportOutputName(reportFile) {
    return path.basename(reportFile).replace(' ', '_').replace('.json', '');
}

function setOutputs(core, reportFile, counts) {
    const outputName = reportOutputName(reportFile);
    for (const type in counts.scenarios) {
        core.debug(`publish output ${outputName}_${type}_scenarios=${counts.scenarios[type]}`);
        core.setOutput(`${outputName}_${type}_scenarios`, counts.scenarios[type]);
    }
    for (const type in counts.steps) {
        core.debug(`publish output ${outputName}_${type}_steps=${counts.scenarios[type]}`);
        core.setOutput(`${outputName}_${type}_steps`, counts.scenarios[type]);
    }
}

module.exports = { setOutputs };
