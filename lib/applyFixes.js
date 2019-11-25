const ruleFixer = require('eslint/lib/linter/rule-fixer');
const Traverser = require('eslint/lib/shared/traverser');
const isSimpleObjectTree = require('./isSimpleObjectTree');
const detectIndent = require('detect-indent');
const SourceCodeFixer = require('eslint/lib/linter/source-code-fixer');
const indentString = require('./indentString');
const maybeApplyPrettier = require('./maybeApplyPrettier');

function stringify(obj, indentationWidth, inspect) {
  if (obj.includes('\n')) {
    return `expect.unindent\`${indentString(
      obj.replace(/`/g, '\\`'),
      indentationWidth
    )}\``;
  } else {
    return inspect(obj, indentationWidth);
  }
}

// Only parse each file once, even though multiple fixes have to be applied:
const getSourceCodeMemoized = require('memoizesync')(
  require('./getSourceCode')
);

function getNodeIndent(node, sourceCode, byLastLine) {
  const token = byLastLine
    ? sourceCode.getLastToken(node)
    : sourceCode.getFirstToken(node);
  const srcCharsBeforeNode = sourceCode
    .getText(token, token.loc.start.column)
    .split('');
  const indentChars = srcCharsBeforeNode.slice(
    0,
    srcCharsBeforeNode.findIndex(char => char !== ' ' && char !== '\t')
  );
  const spaces = indentChars.filter(char => char === ' ').length;
  const tabs = indentChars.filter(char => char === '\t').length;

  if (spaces > 0) {
    return ' '.repeat(spaces);
  } else if (tabs > 0) {
    return '\t'.repeat(tabs);
  } else {
    return '';
  }
}

function applyFixes(fixes) {
  const fixesByFileName = {};
  let numFixedExpects = 0;
  for (const {
    fileName,
    lineNumber,
    columnNumber,
    status,
    subject,
    inspect,
    assertionName
  } of fixes) {
    const sourceCode = getSourceCodeMemoized(fileName);
    if (!sourceCode) {
      // Probably a parse error, give up.
      return;
    }
    let indentationWidth = 4;
    const detectedIndent = detectIndent(sourceCode.text);
    if (detectedIndent) {
      indentationWidth = detectedIndent.amount;
    }

    new Traverser().traverse(sourceCode.ast, {
      enter(node, parent) {
        if (
          node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'expect' &&
          node.loc.start.line === lineNumber &&
          node.loc.start.column + 1 === columnNumber &&
          node.arguments.length >= 2
        ) {
          numFixedExpects += 1;

          // Find the indentation of the literal being replaced,
          // falling back to that of 'to equal snapshot'
          let indent;
          if (node.arguments.length >= 3) {
            indent = getNodeIndent(node.arguments[2], sourceCode);
          } else {
            indent = getNodeIndent(node.arguments[1], sourceCode);
          }
          const fixes = [];
          let stringifiedSubject;
          let newAssertionName = assertionName;
          if (
            typeof subject === 'string' &&
            assertionName === 'to equal snapshot'
          ) {
            stringifiedSubject = stringify(
              subject,
              indentationWidth,
              inspect
            ).replace(/\n^(?=[^\n])/gm, `\n${indent}`);
          } else if (
            isSimpleObjectTree(subject) &&
            assertionName === 'to equal snapshot'
          ) {
            stringifiedSubject = inspect(subject, indentationWidth);
          } else {
            newAssertionName = 'to inspect as snapshot';
            stringifiedSubject = stringify(
              inspect(subject, indentationWidth),
              indentationWidth,
              inspect
            ).replace(/\n^(?=[^\n])/gm, `\n${indent}`);
          }
          // Take compound assertions into account:
          const assertionArgument =
            node.arguments[
              node.arguments.length - (status === 'missing' ? 1 : 2)
            ];
          const newAssertionNameWithPrefix = assertionArgument.value.replace(
            assertionName,
            newAssertionName
          );

          if (status === 'missing') {
            if (newAssertionName === assertionName) {
              fixes.unshift(
                ruleFixer.insertTextAfter(
                  assertionArgument,
                  `, ${stringifiedSubject}`
                )
              );
            } else {
              fixes.unshift(
                ruleFixer.replaceText(
                  assertionArgument,
                  `'${newAssertionNameWithPrefix}', ${stringifiedSubject}`
                )
              );
            }
          } else if (status === 'mismatch') {
            if (newAssertionName !== assertionName) {
              fixes.unshift(
                ruleFixer.replaceText(
                  assertionArgument,
                  `'${newAssertionNameWithPrefix}'`
                )
              );
            }
            fixes.unshift(
              ruleFixer.replaceText(
                node.arguments[node.arguments.length - 1],
                stringifiedSubject
              )
            );
          }
          if (fixes.length > 0) {
            (fixesByFileName[fileName] = fixesByFileName[fileName] || []).push(
              ...fixes
            );
          }
        }
      }
    });
  }

  const fixedSourceTextByFileName = {};
  for (const fileName of Object.keys(fixesByFileName)) {
    var fixResult = SourceCodeFixer.applyFixes(
      getSourceCodeMemoized(fileName).text,
      fixesByFileName[fileName].map(fix => ({ fix }))
    );
    if (fixResult.fixed) {
      fixedSourceTextByFileName[fileName] = maybeApplyPrettier(
        fixResult.output,
        fileName
      );
    }
  }

  return { numFixedExpects, fixedSourceTextByFileName };
}

module.exports = applyFixes;