const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('action.yml', () => {
    const action = fs.readFileSync(path.join(__dirname, '..', 'action.yml'), 'utf8');

    it('[bug 9] should use the required key for the inputs', () => {
        const invalidLines = action.split('\n').filter(line => /^\s+require:/.test(line));
        assert.deepStrictEqual(invalidLines, []);
    });
});
