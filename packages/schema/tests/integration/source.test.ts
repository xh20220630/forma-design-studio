import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { getDesignTypeSource } from '@forma/schema/source';

test('standalone design contracts compile and retain every public design type', () => {
  const source = getDesignTypeSource();
  const file = fileURLToPath(new URL('./standalone-design.ts', import.meta.url));
  const entry = fileURLToPath(new URL('../../src/design.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(name) === file
      ? ts.createSourceFile(file, source, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([file, entry], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    [],
  );
  const checker = program.getTypeChecker();
  const exportedNames = (name: string) =>
    checker
      .getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(name)!)!)
      .map((symbol) => symbol.name)
      .sort();
  assert.deepEqual(exportedNames(file), exportedNames(entry));
  assert.equal(program.getSourceFile(file)!.statements.some(ts.isImportDeclaration), false);
});
