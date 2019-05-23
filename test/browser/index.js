/* global weknowhow, unexpectedSnapshot */

const expect = weknowhow.expect.clone().use(unexpectedSnapshot);
describe('unexpected-snapshot', function() {
  describe('to equal snapshot', function() {
    it('should succeed', function() {
      expect('abc', 'to equal snapshot', 'abc');
    });

    it('should fail with a diff', function() {
      expect(
        () => expect('abc', 'to equal snapshot', 'def'),
        'to throw',
        "expected 'abc' to equal snapshot 'def'\n" + '\n' + '-abc\n' + '+def'
      );
    });
  });

  describe('to inspect as snapshot', function() {
    function Person(name) {
      this.name = name;
    }

    it('should succeed', function() {
      expect(
        new Person('Eigil'),
        'to inspect as snapshot',
        "Person({ name: 'Eigil' })"
      );
    });

    it('should fail with a diff', function() {
      expect(
        () =>
          expect(
            new Person('Eigil'),
            'to equal snapshot',
            "Person({ name: 'Preben' })"
          ),
        'to throw',
        "expected Person({ name: 'Eigil' }) to equal snapshot 'Person({ name: \\'Preben\\' })'"
      );
    });
  });
});