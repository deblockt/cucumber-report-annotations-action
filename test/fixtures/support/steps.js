const assert = require('assert');
const { Before, After, When } = require('@cucumber/cucumber');

When('this step will success', function () {
});

When('this step will fail', function () {
    assert.fail('this step allways fail');
});

Before({ tags: '@passing-hooks' }, function () {
});

After({ tags: '@passing-hooks' }, function () {
});

Before({ tags: '@failing-before-hook' }, function () {
    assert.fail('this before hook allways fail');
});

After({ tags: '@failing-after-hook' }, function () {
    assert.fail('this after hook allways fail');
});
