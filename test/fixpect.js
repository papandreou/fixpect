const expect = require('unexpected');
const pathModule = require('path');
const fs = expect.promise.promisifyAll(require('fs'));
const _ = require('lodash');
const childProcess = require('child_process');
const preamble = `var expect = require('unexpected').clone().use(require('${pathModule.resolve(
  __dirname,
  '..',
  'lib',
  'fixpect.js'
)}'));\n`;

const tmpDir = pathModule.resolve(__dirname, 'tmp');

before(async () => {
  try {
    await fs.mkdirAsync(tmpDir);
  } catch (err) {}
});
after(async () => {
  try {
    await fs.rmdirAsync(tmpDir);
  } catch (err) {}
});

expect.addAssertion(
  '<string> to come out as <string>',
  async (expect, subject, value) => {
    const tmpFileName = pathModule.resolve(
      tmpDir,
      `fixpect${Math.round(10000000 * Math.random())}.js`
    );
    const testCommand = `${process.argv[0]} ${pathModule.resolve(
      __dirname,
      '..',
      'node_modules',
      '.bin',
      'mocha'
    )} ${tmpFileName}`;

    await fs.writeFileAsync(tmpFileName, preamble + subject, 'utf-8');
    try {
      const [err, stdout] = await expect.promise.fromNode(cb =>
        childProcess.exec(
          testCommand,
          { env: _.defaults({ FIXPECT: 'yes' }, process.env) },
          cb.bind(null, null)
        )
      );

      if (err && err.code === 165) {
        throw new Error(`fixpect failed with: ${stdout}`);
      }

      const contents = await fs.readFileAsync(tmpFileName, 'utf-8');

      expect(contents.substr(preamble.length), 'to equal', value);
    } finally {
      await fs.unlinkAsync(tmpFileName);
    }
  }
);

describe('fixpect', function() {
  describe('to equal', function() {
    it('should fix a failing string comparison', function() {
      return expect(
        `
          it('should foo', function () {
            expect('foo', 'to equal', 'bar');
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect('foo', 'to equal', 'foo');
          });
        `
      );
    });

    it('should fix a failing multiline string comparison', function() {
      return expect(
        `
          it('should foo', function () {
            var str = '';
            for (var i = 0 ; i < 20 ; i += 1) {
              str += 'abcdefghijklmnopqrstuvwxyz1234567890\\n';
            }
            expect(
              str,
              'to equal',
              ''
            );
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            var str = '';
            for (var i = 0 ; i < 20 ; i += 1) {
              str += 'abcdefghijklmnopqrstuvwxyz1234567890\\n';
            }
            expect(
              str,
              'to equal',
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n' +
              'abcdefghijklmnopqrstuvwxyz1234567890\\n'
            );
          });
        `
      );
    });

    it('should fix a failing number comparison', function() {
      return expect(
        `
          it('should foo', function () {
            expect(123, 'to equal', 456);
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect(123, 'to equal', 123);
          });
        `
      );
    });

    it('should fix a failing object comparison', function() {
      return expect(
        `
          it('should foo', function () {
            expect({a: 456, b: {c: 789}}, 'to equal', 456);
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect({a: 456, b: {c: 789}}, 'to equal', { a: 456, b: { c: 789 } });
          });
        `
      );
    });

    it('should leave a failing "not to equal" alone', function() {
      return expect(
        `
          it('should foo', function () {
            expect('foo', 'not to equal', 'foo');
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect('foo', 'not to equal', 'foo');
          });
        `
      );
    });

    it('should fix a failing "to satisfy" comparison', function() {
      return expect(
        `
          it('should foo', function () {
            expect({ a: 456, b: { c: 789 } }, 'to satisfy', { b: 123 });
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect({ a: 456, b: { c: 789 } }, 'to satisfy', { b: { c: 789 } });
          });
        `
      );
    });

    it('should fix a failing "to exhaustively satisfy" comparison', function() {
      return expect(
        `
          it('should foo', function () {
            expect({
              foo: 'foo',
              bar: 'bar',
              quux: 'quux'
            }, 'to exhaustively satisfy', {
              foo: 'foo',
              bar: 'bar'
            });
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect({
              foo: 'foo',
              bar: 'bar',
              quux: 'quux'
            }, 'to exhaustively satisfy', { foo: 'foo', bar: 'bar', quux: 'quux' });
          });
        `
      );
    });

    it('should fix an "<array> to satisfy <object>" assertion', function() {
      return expect(
        `
          it('should foo', function () {
            expect([
              'foo',
              'bar',
              'quux'
            ], 'to satisfy', { 1: 'baz' });
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect([
              'foo',
              'bar',
              'quux'
            ], 'to satisfy', { 1: 'bar' });
          });
        `
      );
    });

    it('should fix an "<array> to satisfy <array>" assertion', function() {
      return expect(
        `
          it('should foo', function () {
            expect([
              'foo',
              'bar',
              'quux'
            ], 'to satisfy', [ 'foo', 'bar' ]);
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect([
              'foo',
              'bar',
              'quux'
            ], 'to satisfy', [ 'foo', 'bar', 'quux' ]);
          });
        `
      );
    });

    it('should fix up an assertion with a "middle of the rocket" assertion', function() {
      return expect(
        `
          expect.addAssertion('<any> when delayed a little bit <assertion>', function (expect, subject) {
            return expect.promise(function (run) {
              setTimeout(run(function () {
                return expect.shift();
              }), 1);
            });
          });
          it('should foo', function () {
            return expect(123, 'when delayed a little bit', 'to equal', 456);
          });
        `,
        'to come out as',
        `
          expect.addAssertion('<any> when delayed a little bit <assertion>', function (expect, subject) {
            return expect.promise(function (run) {
              setTimeout(run(function () {
                return expect.shift();
              }), 1);
            });
          });
          it('should foo', function () {
            return expect(123, 'when delayed a little bit', 'to equal', 123);
          });
        `
      );
    });

    it('should fix up a compound assertion', function() {
      return expect(
        `
          expect.addAssertion('<any> when delayed a little bit <assertion>', function (expect, subject) {
            return expect.promise(function (run) {
              setTimeout(run(function () {
                return expect.shift();
              }), 1);
            });
          });
          it('should foo', function () {
            return expect(123, 'when delayed a little bit to equal', 456);
          });
        `,
        'to come out as',
        `
          expect.addAssertion('<any> when delayed a little bit <assertion>', function (expect, subject) {
            return expect.promise(function (run) {
              setTimeout(run(function () {
                return expect.shift();
              }), 1);
            });
          });
          it('should foo', function () {
            return expect(123, 'when delayed a little bit to equal', 123);
          });
        `
      );
    });

    it('should fix a complex compound assertion', function() {
      return expect(
        `
          function delayedIncrement(num, cb) {
            setTimeout(function () {
              if (typeof num === 'number') {
                cb(null, num + 1);
              } else {
                cb(new Error('not a number'));
              }
            }, 1);
          }
          it('should foo', function () {
            return expect([123], 'when passed as parameters to async', delayedIncrement, 'to equal', 125);
          });
        `,
        'to come out as',
        `
          function delayedIncrement(num, cb) {
            setTimeout(function () {
              if (typeof num === 'number') {
                cb(null, num + 1);
              } else {
                cb(new Error('not a number'));
              }
            }, 1);
          }
          it('should foo', function () {
            return expect([123], 'when passed as parameters to async', delayedIncrement, 'to equal', 124);
          });
        `
      );
    });

    it('should not fix a failing expect inside another expect', function() {
      return expect(
        `
          it('should foo', function () {
            expect(function () {
              expect(123, 'to equal', 456);
            }, 'to throw', 'expected 123 to equal 456');
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            expect(function () {
              expect(123, 'to equal', 456);
            }, 'to throw', 'expected 123 to equal 456');
          });
        `
      );
    });

    it('should not fix a failing expect inside another async expect', function() {
      return expect(
        `
          it('should foo', function () {
            return expect(function () {
              return expect.promise(function (run) {
                setImmediate(run(function () {
                  expect(123, 'to equal', 456);
                }));
              });
            }, 'to error');
          });
        `,
        'to come out as',
        `
          it('should foo', function () {
            return expect(function () {
              return expect.promise(function (run) {
                setImmediate(run(function () {
                  expect(123, 'to equal', 456);
                }));
              });
            }, 'to error');
          });
        `
      );
    });
  });
});
