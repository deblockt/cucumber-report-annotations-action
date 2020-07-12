const assert = require('assert');
const { Given, When, Then } = require('cucumber');

When('this step will fail', function () {
    assert.fail('this step allways fail')
});

When('this step will success', function () {
});