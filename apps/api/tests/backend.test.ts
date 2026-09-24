import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const testRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-test-'));
process.env.FORMA_DATA_DIR = path.join(testRoot, 'data');
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/index.ts');
const { generateFiles, previewSync, applySync, validateWorkspacePath } = await import(
  '../src/exporter.ts'
);
const { validateProject } = await import('../src/validate.ts');
const { bindWorkspace } = await import('../src/workspaces.ts');
const tokens = {
  primary: '#8b5cf6',
  background: '#f5f5fa',
  surface: '#ffffff',
  text: '#202132',
  muted: '#777a8c',
  border: '#e8e8ef',
  radius: 12,
  fontFamily: 'Inter, sans-serif',
  spacing: 8,
};
/**
 * 创建隔离的样例数据与运行环境，让行为检查不依赖用户工作空间。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 样例环境及清理所需信息。
 */
const fixture = (id) => ({
  id,
  name: 'Example',
  description: '',
  category: 'SaaS',
  status: 'draft',
  themeId: 'violet',
  tokens: { ...tokens },
  pages: [
    {
      id: 'page-home',
      name: 'Home',
      width: 1200,
      height: 900,
      nodes: [
        {
          id: 'card',
          name: 'Card',
          type: 'frame',
          x: 100,
          y: 100,
          width: 300,
          height: 200,
          fill: '#ffffff',
          tokenBindings: { fill: 'surface', radius: 'radius' },
        },
        {
          id: 'title',
          parentId: 'card',
          name: 'Title',
          type: 'text',
          x: 124,
          y: 124,
          width: 250,
          height: 30,
          text: 'Hello <script>alert(1)</script>',
          tokenBindings: { color: 'text' },
        },
      ],
    },
  ],
  components: [],
  revision: 0,
  updatedAt: new Date().toISOString(),
  cover: 'blank',
});
const server = createApp().listen(0, '127.0.0.1');
await new Promise(
  /** 把 backend.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
  (resolve) => server.once('listening', resolve),
);
const base = `http://127.0.0.1:${server.address().port}`;
/**
 * 统一请求 API 并转换失败响应，使调用方只处理业务数据。
 *
 * @param route - 要请求的接口路径。
 * @param method - HTTP 请求方法。
 * @param body - 请求正文或文档内容。
 * @param headers - 发给供应商的额外请求头，可能包含私密认证值。
 * @returns 解析后的 API 响应。
 */
async function api(route, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}/api${route}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
after(
  /**
   * 组织当前场景的准备或清理步骤。
   * @returns 完成当前检查或生命周期操作。
   */
  async () => {
    await new Promise(
      /** 把 backend.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
      (resolve) => server.close(resolve),
    );
    const resolved = path.resolve(testRoot);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('forma-test-'));
    await rm(resolved, { recursive: true, force: true });
  },
);

/**
 * 验证export synchronization detects manual changes without overwriting user code。
 * @returns 完成当前检查或生命周期操作。
 */
test('export synchronization detects manual changes without overwriting user code', async () => {
  const workspace = path.join(testRoot, 'workspace');
  await mkdir(workspace);
  await writeFile(path.join(workspace, 'application.tsx'), 'business logic');
  const project = {
    ...fixture('export-test'),
    workspace: { kind: 'local', path: workspace },
    revision: 3,
  };
  assert.deepEqual(generateFiles(project), generateFiles(project));
  assert.ok(
    (await previewSync(project)).files.every(
      /** 检查 file 的状态等于“added”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.status === 'added',
    ),
  );
  await applySync(project);
  assert.ok(
    (await previewSync(project)).files.every(
      /** 检查 file 的状态等于“unchanged”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.status === 'unchanged',
    ),
  );
  project.tokens.primary = '#123456';
  project.revision = 4;
  assert.equal(
    (await previewSync(project)).files.find(
      /** 判断 backend.test 中的条目是否符合查找条件。 @param file - 需要读取、写入或导入的文件。 @returns 该条目是否符合条件。 */
      (file) => file.path.endsWith('tokens.css'),
    ).status,
    'modified',
  );
  await applySync(project);
  await writeFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'manual custom styles');
  project.tokens.primary = '#abcdef';
  assert.deepEqual((await previewSync(project)).conflicts, ['forma-generated/tokens.css']);
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => applySync(project),
    /本地修改/,
  );
  assert.equal(
    await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8'),
    'manual custom styles',
  );
  assert.equal(await readFile(path.join(workspace, 'application.tsx'), 'utf8'), 'business logic');
});

/**
 * 验证workspace and export paths reject relative paths, foreign files and symlink escapes。
 * @returns 完成当前检查或生命周期操作。
 */
test('workspace and export paths reject relative paths, foreign files and symlink escapes', async () => {
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => validateWorkspacePath('../outside'),
    /绝对/,
  );
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => validateWorkspacePath(path.join(testRoot, 'missing')),
    /不存在/,
  );
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () =>
      bindWorkspace(fixture('clone'), { kind: 'github', repo: 'https://github.com/x/y;whoami' }),
    /URL/,
  );
  const workspace = path.join(testRoot, 'foreign');
  await mkdir(path.join(workspace, 'forma-generated'), { recursive: true });
  await writeFile(path.join(workspace, 'forma-generated', 'index.tsx'), 'unmanaged implementation');
  const project = { ...fixture('foreign'), workspace: { kind: 'local', path: workspace } };
  assert.deepEqual((await previewSync(project)).conflicts, ['forma-generated/index.tsx']);
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => applySync(project),
    /本地修改/,
  );
  const linked = path.join(testRoot, 'linked');
  const outside = path.join(testRoot, 'outside');
  await mkdir(linked);
  await mkdir(outside);
  await symlink(
    outside,
    path.join(linked, 'forma-generated'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => previewSync({ ...project, workspace: { kind: 'local', path: linked } }),
    /符号链接/,
  );
});

/**
 * 验证graph validation rejects cycles and invalid token references。
 * @returns 完成当前检查或生命周期操作。
 */
test('graph validation rejects cycles and invalid token references', () => {
  const project = fixture('graph');
  project.pages[0].nodes[0].parentId = 'title';
  assert.throws(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => validateProject(project),
    /循环/,
  );
  delete project.pages[0].nodes[0].parentId;
  project.pages[0].nodes[0].tokenBindings.fill = 'unknown';
  assert.throws(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => validateProject(project),
    /绑定/,
  );
});

/**
 * 验证extended scene fields persist with validation for shapes, modes, comments and snapshots。
 * @returns 完成当前检查或生命周期操作。
 */
test('extended scene fields persist with validation for shapes, modes, comments and snapshots', async () => {
  const project = fixture('extended-scene');
  project.pages[0].nodes.push({
    id: 'star',
    name: 'Star',
    type: 'star',
    x: 500,
    y: 60,
    width: 100,
    height: 100,
    polygonSides: 5,
    starRatio: 0.4,
    rotation: 24,
    flipX: true,
    stroke: '#333',
    strokeWidth: 2,
    strokeDash: 'dashed',
    gradient: { type: 'linear', from: '#f00', to: '#00f', angle: 35 },
    shadow: { x: 2, y: 3, blur: 8, spread: 0, color: '#0005' },
    prototype: {
      action: 'navigate',
      target: 'page-home',
      trigger: 'hover',
      animation: 'dissolve',
      duration: 250,
    },
  });
  project.themeModes = { dark: { ...tokens, background: '#111111' } };
  project.activeMode = 'dark';
  project.variableCollections = [
    {
      id: 'colors',
      name: 'Colors',
      modes: ['light', 'dark'],
      variables: [
        {
          id: 'accent',
          name: 'Accent',
          type: 'color',
          values: { light: '#ff0000', dark: '#00ff00' },
        },
      ],
    },
  ];
  project.activeVariableModes = { colors: 'dark' };
  project.pages[0].nodes[0].variableBindings = {
    fill: { collectionId: 'colors', variableId: 'accent' },
  };
  project.comments = [
    {
      id: 'comment',
      pageId: 'page-home',
      x: 80,
      y: 60,
      text: 'Review here',
      author: 'Designer',
      createdAt: new Date().toISOString(),
      resolved: false,
    },
  ];
  project.snapshots = [
    {
      id: 'snapshot',
      name: 'First version',
      createdAt: new Date().toISOString(),
      pages: structuredClone(project.pages),
      components: [],
      tokens: { ...tokens },
      variableCollections: structuredClone(project.variableCollections),
      activeVariableModes: { ...project.activeVariableModes },
      themeModes: structuredClone(project.themeModes),
      activeMode: project.activeMode,
    },
  ];
  const saved = await api('/projects/extended-scene', 'PUT', project);
  assert.equal(saved.status, 200);
  const loaded = (await api('/projects/extended-scene')).body;
  for (const key of [
    'themeModes',
    'activeMode',
    'variableCollections',
    'activeVariableModes',
    'comments',
    'snapshots',
  ])
    assert.deepEqual(loaded[key], project[key]);
  assert.deepEqual(loaded.pages, project.pages);
  for (const [property, value] of [
    ['path', 'M0 0 <script>alert(1)</script>'],
    ['gradient', { type: 'linear', from: 'url(javascript:alert(1))', to: '#000', angle: 0 }],
    ['prototype', { action: 'url', target: 'javascript:alert(1)' }],
    ['strokeWidth', -5],
    ['visible', 'false'],
  ]) {
    const invalid = structuredClone(project);
    invalid.pages[0].nodes[0][property] = value;
    assert.throws(
      /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => validateProject(invalid),
    );
  }
  const invalid = structuredClone(project);
  invalid.pages[0].nodes[0].variableBindings.fill.variableId = 'missing';
  assert.throws(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => validateProject(invalid),
    /变量绑定/,
  );
  const legacy = structuredClone(project);
  for (const key of ['themeModes', 'activeMode', 'variableCollections', 'activeVariableModes'])
    delete legacy.snapshots[0][key];
  assert.equal(validateProject(legacy), legacy);
});

/**
 * 验证safe SVG resources are portable and executable SVG is rejected。
 * @returns 完成当前检查或生命周期操作。
 */
test('safe SVG resources are portable and executable SVG is rejected', async () => {
  const project = fixture('svg');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L24 24" stroke="#000"/></svg>';
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  project.pages[0].nodes.push({
    id: 'svg',
    name: 'SVG icon',
    type: 'image',
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    src,
  });
  assert.equal(validateProject(project).pages[0].nodes.at(-1).src, src);
  assert.equal(
    JSON.parse(
      generateFiles(project).find(
        /** 检查 file 的路径等于“design.json”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (file) => file.path === 'design.json',
      ).content,
    ).pages[0].nodes.at(-1).src,
    src,
  );
  for (const payload of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><image href="https://external.example/test.png"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///private">]><svg>&x;</svg>',
  ]) {
    project.pages[0].nodes.at(-1).src =
      `data:image/svg+xml;base64,${Buffer.from(payload).toString('base64')}`;
    assert.throws(
      /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => validateProject(project),
      /SVG/,
    );
  }
});

/**
 * 验证shared renderer exports vector visuals, theme modes, variable bindings and instance overrides。
 * @returns 完成当前检查或生命周期操作。
 */
test('shared renderer exports vector visuals, theme modes, variable bindings and instance overrides', async () => {
  const project = fixture('extended-render');
  project.themeModes = { dark: { ...tokens, background: '#101010', text: '#eeeeee' } };
  project.activeMode = 'dark';
  project.variableCollections = [
    {
      id: 'colors',
      name: 'Colors',
      modes: ['night'],
      variables: [{ id: 'accent', name: 'Accent', type: 'color', values: { night: '#00aaff' } }],
    },
  ];
  project.activeVariableModes = { colors: 'night' };
  project.pages[0].nodes.push({
    id: 'ellipse',
    name: 'Ellipse',
    type: 'ellipse',
    x: 0,
    y: 0,
    width: 50,
    height: 40,
    stroke: '#ff0000',
    strokeWidth: 2,
    gradient: { type: 'radial', from: '#fff', to: '#000', angle: 0 },
    shadow: { x: 2, y: 3, blur: 8, spread: 4, color: '#0005', inset: true },
  });
  project.pages[0].nodes.push({
    id: 'star',
    name: 'Star',
    type: 'star',
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    polygonSides: 5,
  });
  project.pages[0].nodes.push({
    id: 'path',
    name: 'Path',
    type: 'path',
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    path: 'M0 0 L40 40',
    stroke: '#000',
    strokeWidth: 2,
  });
  project.pages[0].nodes[0].variableBindings = {
    fill: { collectionId: 'colors', variableId: 'accent' },
  };
  project.components = [
    {
      id: 'component',
      name: 'Component',
      width: 80,
      height: 30,
      nodes: [
        {
          id: 'label',
          name: 'Label',
          type: 'button',
          x: 0,
          y: 0,
          width: 80,
          height: 30,
          text: 'Original',
          tokenBindings: { fill: 'primary' },
        },
      ],
    },
  ];
  project.pages[0].nodes.push({
    id: 'instance',
    name: 'Instance',
    type: 'component',
    componentId: 'component',
    x: 0,
    y: 0,
    width: 80,
    height: 30,
    overrides: { label: { text: 'Override', fill: '#fedcba' } },
  });
  const files = generateFiles(project);
  const require = createRequire(import.meta.url);
  assert.match(
    files.find(
      /** 检查 file 的路径等于“tokens.css”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.path === 'tokens.css',
    ).content,
    /--forma-background: #101010/,
  );
  const source = files
    .find(
      /** 检查 file 的路径等于“index.tsx”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.path === 'index.tsx',
    )
    .content.replace(
      "import React from 'react';",
      `import React from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)};`,
    )
    .replace(
      "import design from './design.json';",
      `const design = ${
        files.find(
          /** 检查 file 的路径等于“design.json”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (file) => file.path === 'design.json',
        ).content
      };`,
    )
    .replace("import './tokens.css';", '');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtime = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
  const html = renderToStaticMarkup(React.createElement(runtime.FormaPage));
  assert.match(html, /background:#101010/);
  assert.match(html, /background:#00aaff/);
  assert.match(html, /<ellipse/);
  assert.match(html, /<polygon/);
  assert.match(html, /d="M0 0 L40 40"/);
  assert.match(html, /<radialGradient/);
  assert.match(html, /Override/);
  assert.match(html, /background:#fedcba/);
  assert.ok(!html.includes('Original'));
  assert.match(html, /<feMorphology[^>]*operator="erode"[^>]*radius="4"/);
  assert.match(html, /<feComposite[^>]*result="inner"/);
  const ancestor = {
    id: 'parent',
    name: 'Parent',
    type: 'group',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 90,
  };
  const child = {
    id: 'child',
    parentId: 'parent',
    name: 'Child',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
  };
  const matrix = runtime
    .getNodeStyle(child, tokens, [ancestor, child])
    .transform.slice(7, -1)
    .split(',')
    .map(Number);
  assert.ok(Math.abs(matrix[4] - 80) < 0.000001 && Math.abs(matrix[5]) < 0.000001);
  assert.equal(
    runtime.getNodeStyle(child, tokens, [{ ...ancestor, visible: false }, child]).display,
    'none',
  );
  assert.equal(
    runtime.getNodeStyle({ ...child, x: 90 }, tokens, [
      { ...ancestor, rotation: 0, clipContent: true },
      child,
    ]).clipPath,
    'inset(0px 10px 0px 0px)',
  );
  const modeProject = {
    ...project,
    variableCollections: [
      {
        id: 'flags',
        name: 'Flags',
        modes: ['default'],
        variables: [
          { id: 'shown', name: 'Shown', type: 'boolean', values: { default: false } },
          { id: 'alpha', name: 'Alpha', type: 'number', values: { default: 0 } },
          { id: 'label', name: 'Label', type: 'string', values: { default: '' } },
        ],
      },
    ],
  };
  const boundNode = {
    ...child,
    variableBindings: {
      visible: { collectionId: 'flags', variableId: 'shown' },
      opacity: { collectionId: 'flags', variableId: 'alpha' },
      text: { collectionId: 'flags', variableId: 'label' },
    },
  };
  assert.deepEqual(
    [
      runtime.resolveNode(boundNode, modeProject).visible,
      runtime.resolveNode(boundNode, modeProject).opacity,
      runtime.resolveNode(boundNode, modeProject).text,
    ],
    [false, 0, ''],
  );
  assert.equal(runtime.getNodeStyle(boundNode, tokens, [], modeProject).display, 'none');
  assert.equal(
    runtime.getNodeStyle({ ...child, fontFamily: 'Georgia, serif' }, tokens, [], modeProject)
      .fontFamily,
    'Georgia, serif',
  );
  assert.equal(runtime.getNodeStyle(child, tokens, [], modeProject).fontFamily, tokens.fontFamily);
  const prototypeParent = { ...ancestor, prototype: { action: 'back' } };
  let activated;
  const childView = runtime.NodeView({
    node: child,
    project,
    nodes: [prototypeParent, child],
    /**
     * 响应点击事件，将控件操作传回所属界面。
     *
     * @param node - 当前处理的设计节点。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onClick: (node) => {
      activated = node.id;
    },
  });
  childView.props.onClick({
    /**
     * 在模拟事件中提供停止冒泡入口，使场景可按真实交互调用。
     * @returns 无返回值。
     */
    stopPropagation() {},
  });
  assert.equal(activated, prototypeParent.id);
  const ownAction = { ...child, prototype: { action: 'navigate', target: 'page-home' } };
  runtime
    .NodeView({
      node: ownAction,
      project,
      nodes: [prototypeParent, ownAction],
      /**
       * 响应点击事件，将控件操作传回所属界面。
       *
       * @param node - 当前处理的设计节点。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      onClick: (node) => {
        activated = node.id;
      },
    })
    .props.onClick({
      /**
       * 在模拟事件中提供停止冒泡入口，使场景可按真实交互调用。
       * @returns 无返回值。
       */
      stopPropagation() {},
    });
  assert.equal(activated, ownAction.id);
});

/**
 * 验证exported React entry point typechecks as a standalone consuming project。
 * @returns 完成当前检查或生命周期操作。
 */
test('exported React entry point typechecks as a standalone consuming project', async () => {
  const directory = path.join(testRoot, 'consumer');
  await mkdir(directory);
  for (const file of generateFiles(fixture('consumer')))
    await writeFile(path.join(directory, file.path), file.content);
  await symlink(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    path.join(directory, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const program = ts.createProgram([path.join(directory, 'index.tsx')], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map(
      /** 转换 backend.test 中的集合条目，供后续处理或展示。 @param item - 当前遍历的条目。 @returns 当前条目转换后的结果。 */
      (item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'),
    ),
    [],
  );
});

/**
 * 验证export renderer preserves absolute stacking, ancestor state and actual component instances。
 * @returns 完成当前检查或生命周期操作。
 */
test('export renderer preserves absolute stacking, ancestor state and actual component instances', async () => {
  const project = fixture('render');
  project.pages[0].nodes[0].opacity = 0.5;
  project.pages[0].nodes[1].opacity = 0.4;
  project.components = [
    {
      id: 'component-button',
      name: 'Button',
      width: 100,
      height: 40,
      nodes: [
        {
          id: 'master-button',
          name: 'Master',
          type: 'button',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          text: 'Master content',
        },
      ],
    },
  ];
  project.pages[0].nodes.push({
    id: 'instance',
    name: 'Instance',
    type: 'component',
    componentId: 'component-button',
    x: 500,
    y: 100,
    width: 200,
    height: 80,
  });
  project.pages[0].nodes.push({
    id: 'ordinary',
    name: 'Ordinary',
    type: 'button',
    componentId: 'component-button',
    x: 500,
    y: 300,
    width: 100,
    height: 40,
    text: 'Own text',
  });
  project.pages[0].nodes.push({
    id: 'hidden',
    name: 'Hidden',
    type: 'frame',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: false,
  });
  project.pages[0].nodes.push({
    id: 'hidden-child',
    parentId: 'hidden',
    name: 'Hidden child',
    type: 'text',
    x: 10,
    y: 10,
    width: 80,
    height: 20,
    text: 'Must stay hidden',
  });
  const files = generateFiles(project);
  const require = createRequire(import.meta.url);
  const source = files
    .find(
      /** 检查 file 的路径等于“index.tsx”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.path === 'index.tsx',
    )
    .content.replace(
      "import React from 'react';",
      `import React from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)};`,
    )
    .replace(
      "import design from './design.json';",
      `const design = ${
        files.find(
          /** 检查 file 的路径等于“design.json”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (file) => file.path === 'design.json',
        ).content
      };`,
    )
    .replace("import './tokens.css';", '');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtime = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
  const html = renderToStaticMarkup(React.createElement(runtime.FormaPage));
  assert.ok(html.indexOf('data-forma-node="card"') < html.indexOf('data-forma-node="title"'));
  assert.match(html, /left:124px;top:124px/);
  assert.match(html, /opacity:0.2/);
  assert.ok(!html.includes('Must stay hidden'));
  assert.equal((html.match(/Master content/g) || []).length, 1);
  assert.ok(html.includes('Own text') && html.includes('scale(2,2)'));
  assert.ok(html.includes('font-weight:550') && html.includes('line-height:1.45'));
  assert.ok(html.includes('&lt;script&gt;'));
});

/**
 * 验证local bitmap export embeds portable assets and rejects missing or traversal paths。
 * @returns 完成当前检查或生命周期操作。
 */
test('local bitmap export embeds portable assets and rejects missing or traversal paths', async () => {
  const assetDirectory = path.join(testRoot, 'data', 'assets');
  await mkdir(assetDirectory, { recursive: true });
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
    'base64',
  );
  await writeFile(path.join(assetDirectory, 'portable.png'), bytes);
  const project = fixture('portable');
  const image = {
    id: 'image',
    name: 'Image',
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: '/api/assets/portable.png',
  };
  project.pages[0].nodes.push(image);
  project.components = [
    { id: 'photo', name: 'Photo', width: 100, height: 100, nodes: [{ ...image }] },
  ];
  const exported = JSON.parse(
    generateFiles(project).find(
      /** 检查 file 的路径等于“design.json”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (file) => file.path === 'design.json',
    ).content,
  );
  const expected = `data:image/png;base64,${bytes.toString('base64')}`;
  assert.equal(exported.pages[0].nodes.at(-1).src, expected);
  assert.equal(exported.components[0].nodes[0].src, expected);
  assert.equal(project.pages[0].nodes.at(-1).src, '/api/assets/portable.png');
  image.src = '/api/assets/missing.png';
  assert.throws(
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => generateFiles(project),
    /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param error - 当前操作的失败信息，供界面反馈或重试判断。 @returns 条件是否成立的布尔值。 */
    (error) => error.status === 409 && /不存在/.test(error.message),
  );
  for (const source of [
    '/api/assets/../settings.json',
    '/api/assets/../secret.png',
    '/api/assets/%2e%2e/secret.png',
    '/api/assets/folder/image.png',
    '/api/assets/portable.png?raw=1',
    '/api/assets/..\\secret.png',
  ]) {
    image.src = source;
    assert.throws(
      /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => validateProject(project),
      /本地图片地址/,
    );
    assert.throws(
      /** 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => generateFiles(project),
      /本地图片地址/,
    );
  }
});

/**
 * 验证API persistence, revision concurrency, approval gate and origin protection。
 * @returns 完成当前检查或生命周期操作。
 */
test('API persistence, revision concurrency, approval gate and origin protection', async () => {
  const created = await api('/projects/api-project', 'PUT', fixture('api-project'));
  assert.equal(created.status, 200);
  assert.equal(created.body.revision, 1);
  const stale = await api('/projects/api-project', 'PUT', fixture('api-project'));
  assert.equal(stale.status, 409);
  const forged = await api('/projects/api-project', 'PUT', {
    ...created.body,
    generation: { imageUrl: 'https://example.com/picture.png', approved: true },
  });
  assert.equal(forged.status, 200);
  assert.equal(forged.body.generation, undefined);
  assert.equal((await api('/generate/design', 'POST', { projectId: 'api-project' })).status, 409);
  assert.equal((await api('/generate/approve', 'POST', { projectId: 'api-project' })).status, 409);
  assert.equal(
    (await api('/state', 'GET', undefined, { Origin: 'https://attacker.example' })).status,
    403,
  );
  assert.equal((await api('/state')).body.projects[0].id, 'api-project');
  const stored = JSON.parse(await readFile(path.join(testRoot, 'data', 'projects.json'), 'utf8'));
  assert.equal(stored.projects[0].revision, 2);
  const concurrent = await Promise.all([
    api('/projects/api-project', 'PUT', { ...forged.body, name: 'Change A' }),
    api('/projects/api-project', 'PUT', { ...forged.body, name: 'Change B' }),
  ]);
  assert.deepEqual(
    concurrent
      .map(
        /** 提取当前结果的状态，供后续计算或展示使用。 @param result - 上一步操作得到的结果。 @returns 当前结果的状态。 */
        (result) => result.status,
      )
      .sort(),
    [200, 409],
  );
  const invalidBody = await fetch(`${base}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '[]',
  });
  assert.equal(invalidBody.status, 400);
});

/**
 * 验证provider image approval to vision graph and safe automatic synchronization。
 * @returns 完成当前检查或生命周期操作。
 */
test('provider image approval to vision graph and safe automatic synchronization', async () => {
  const calls = [];
  const provider = http
    .createServer(
      /**
       * 执行 backend.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
       *
       * @param req - 当前 HTTP 请求。
       * @param res - 当前 HTTP 响应对象。
       * @returns 当前步骤的处理结果。
       */
      async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        calls.push({ route: req.url, input });
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/v1/images/generations')
          return res.end(
            JSON.stringify({
              data: [
                {
                  b64_json:
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
                },
              ],
            }),
          );
        const output = Array.isArray(input.messages[1].content)
          ? { pages: fixture('provider').pages, components: [], assets: [] }
          : { name: 'Violet', description: 'Test theme', tokens };
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
      },
    )
    .listen(0, '127.0.0.1');
  await new Promise(
    /** 把 backend.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
    (resolve) => provider.once('listening', resolve),
  );
  try {
    const settings = await api('/settings', 'POST', {
      apiKey: 'test-secret-never-returned',
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      textModel: 'test-vision',
      imageModel: 'test-image',
    });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.configured, true);
    assert.equal(JSON.stringify(settings.body).includes('test-secret'), false);
    let project = (await api('/projects/provider', 'PUT', fixture('provider'))).body;
    const image = await api('/generate/image', 'POST', {
      projectId: project.id,
      prompt: 'Create a dashboard',
    });
    assert.equal(image.status, 200);
    assert.equal(image.body.project.generation.approved, false);
    assert.equal((await api('/generate/design', 'POST', { projectId: project.id })).status, 409);
    assert.equal((await api('/generate/approve', 'POST', { projectId: project.id })).status, 200);
    assert.equal(
      (
        await api('/generate/design', 'POST', {
          projectId: project.id,
          prompt: 'A totally different layout',
        })
      ).status,
      409,
    );
    project = (await api(`/projects/${project.id}`)).body;
    project.tokens.primary = '#987654';
    project = (await api(`/projects/${project.id}`, 'PUT', project)).body;
    assert.equal(project.generation.approved, false);
    assert.equal((await api('/generate/approve', 'POST', { projectId: project.id })).status, 409);
    await api('/generate/image', 'POST', { projectId: project.id, prompt: 'Create a dashboard' });
    await api('/generate/approve', 'POST', { projectId: project.id });
    project = (await api(`/projects/${project.id}`)).body;
    project.components = [
      {
        id: 'new-component',
        name: 'New',
        width: 100,
        height: 40,
        nodes: [],
        description: '',
        category: 'test',
      },
    ];
    project = (await api(`/projects/${project.id}`, 'PUT', project)).body;
    assert.equal(project.generation.approved, false);
    assert.equal((await api('/generate/approve', 'POST', { projectId: project.id })).status, 409);
    await api('/generate/image', 'POST', { projectId: project.id, prompt: 'Create a dashboard' });
    await api('/generate/approve', 'POST', { projectId: project.id });
    const design = await api('/generate/design', 'POST', { projectId: project.id });
    assert.equal(design.status, 200);
    project = design.body.project;
    assert.equal(design.body.pages[0].nodes.length, 2);
    assert.ok(calls[0].input.prompt.includes('#8b5cf6'));
    assert.ok(
      calls
        .find(
          /** 检查 call 的route等于“/v1/chat/completions”，供集合筛选或定位使用。 @param call - 等待执行的操作函数。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (call) => call.route === '/v1/chat/completions',
        )
        .input.messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'),
    );
    assert.equal(
      (await api('/generate/theme', 'POST', { prompt: 'violet dashboard' })).body.tokens.primary,
      tokens.primary,
    );
    const workspace = path.join(testRoot, 'auto-sync');
    await mkdir(workspace);
    const bound = await api('/workspace/bind', 'POST', {
      projectId: project.id,
      kind: 'local',
      path: workspace,
    });
    project = bound.body.project;
    assert.equal(
      (await api('/sync/apply', 'POST', { projectId: project.id, revision: project.revision - 1 }))
        .status,
      409,
    );
    const applied = await api('/sync/apply', 'POST', { projectId: project.id });
    assert.equal(applied.status, 200);
    project = applied.body.project;
    assert.equal(project.lastSyncedRevision, project.revision);
    project.workspace.autoSync = true;
    project.tokens.primary = '#010203';
    const saved = await api(`/projects/${project.id}`, 'PUT', project);
    project = saved.body;
    assert.equal(project.lastSyncedRevision, project.revision);
    assert.ok(
      (await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8')).includes(
        '#010203',
      ),
    );
    await writeFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'user changed this');
    project.tokens.primary = '#040506';
    const conflict = await api(`/projects/${project.id}`, 'PUT', project);
    assert.equal(conflict.status, 200);
    assert.ok(conflict.body.syncWarning.includes('本地修改'));
    assert.equal(
      await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8'),
      'user changed this',
    );
    const exported = await api(`/projects/${project.id}/export`);
    assert.equal(exported.body.files.length, 5);
  } finally {
    await new Promise(
      /** 把 backend.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
      (resolve) => provider.close(resolve),
    );
  }
});
