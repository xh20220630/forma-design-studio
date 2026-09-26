import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { getStandaloneRendererSource } from '@forma/renderer/source';

test('standalone renderer compiles with React and embeds all public renderer and design exports', () => {
  const source = getStandaloneRendererSource();
  const file = fileURLToPath(new URL('./standalone-renderer.tsx', import.meta.url));
  const rendererEntry = fileURLToPath(new URL('../../src/index.ts', import.meta.url));
  const designEntry = fileURLToPath(new URL('../../../schema/src/design.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    types: ['react'],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(name) === file
      ? ts.createSourceFile(file, source, languageVersion, true, ts.ScriptKind.TSX)
      : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([file, rendererEntry, designEntry], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    [],
  );
  const checker = program.getTypeChecker();
  const exportedNames = (name: string) =>
    checker
      .getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(name)!)!)
      .map((symbol) => symbol.name);
  assert.deepEqual(
    exportedNames(file).sort(),
    [...exportedNames(rendererEntry), ...exportedNames(designEntry)].sort(),
  );
  const imports = program.getSourceFile(file)!.statements.filter(ts.isImportDeclaration);
  assert.ok(imports.every((item) => (item.moduleSpecifier as ts.StringLiteral).text === 'react'));
});
