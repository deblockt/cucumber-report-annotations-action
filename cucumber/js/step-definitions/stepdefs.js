const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');

When('this step will fail', function () {
    assert.fail('this step allways fail')
});

When('this step will success', function () {
});

When('this step is pending', function() {
    return 'pending';
})

When('this step will success using example {string}', function() {
})