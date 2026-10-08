import type { Matrix, Bounds } from './geometry.ts';
import { placeTile, tileExtent, type SceneTile } from './tiles.ts';

export interface TileCompositor {
  readonly kind: 'webgl2' | 'canvas2d';
  uploads: number;
  begin(): void;
  draw(tile: SceneTile, camera: Matrix, area?: Bounds): void;
  end(): void;
  release(tile: SceneTile): void;
  dispose(): void;
}

export class Canvas2DCompositor implements TileCompositor {
  readonly kind = 'canvas2d';
  uploads = 0;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas 2D');
    this.context = context;
  }

  begin() {
    this.context.resetTransform();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(tile: SceneTile, camera: Matrix, area?: Bounds) {
    const p = placeTile(tile, camera, area);
    this.context.drawImage(tile.canvas, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.width, p.height);
  }

  release(_tile: SceneTile) {}
  end() {}
  dispose() {}
}

const vertexSource = `#version 300 es
in vec2 position;
uniform vec2 viewport;
uniform vec4 destination;
uniform vec4 source;
out vec2 uv;
void main() {
  vec2 pixel = destination.xy + position * destination.zw;
  gl_Position = vec4(pixel / viewport * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
  uv = source.xy + position * source.zw;
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform sampler2D image;
in vec2 uv;
out vec4 color;
void main() { color = texture(image, uv); }`;

/** GPU 只合成已栅格化的二维块；纹理版本不变时不重新上传。 */
export class WebGL2Compositor implements TileCompositor {
  readonly kind = 'webgl2';
  uploads = 0;
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private viewport: WebGLUniformLocation | null;
  private destination: WebGLUniformLocation | null;
  private source: WebGLUniformLocation | null;
  private textures = new Map<SceneTile, { texture: WebGLTexture; version: number }>();
  private validation?: WebGLSync;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!program || !buffer || !vao) {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      throw new Error('WebGL2 allocation failed');
    }
    this.program = program;
    this.buffer = buffer;
    this.vao = vao;
    try {
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vertexSource],
        [gl.FRAGMENT_SHADER, fragmentSource],
      ] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('WebGL2 shader allocation failed');
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        const valid = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (valid) gl.attachShader(program, shader);
        gl.deleteShader(shader);
        if (!valid) throw new Error('WebGL2 shader compilation failed');
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('WebGL2 program link failed');
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.viewport = gl.getUniformLocation(program, 'viewport');
      this.destination = gl.getUniformLocation(program, 'destination');
      this.source = gl.getUniformLocation(program, 'source');
      gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  begin() {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('WebGL2 context lost');
    if (this.validation) {
      const status = gl.clientWaitSync(this.validation, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
        gl.deleteSync(this.validation);
        this.validation = undefined;
        if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL2 texture upload failed');
      }
    }
    this.uploads = 0;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(this.viewport, this.canvas.width, this.canvas.height);
  }

  draw(tile: SceneTile, camera: Matrix, area?: Bounds) {
    const gl = this.gl;
    let resource = this.textures.get(tile);
    if (!resource) {
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL2 texture allocation failed');
      resource = { texture, version: -1 };
      this.textures.set(tile, resource);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, resource.texture);
    if (resource.version !== tile.version) {
      // 跨域图片可能污染块画布；上传抛错时由引擎切换到 2D 合成。
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tile.canvas);
      resource.version = tile.version;
      this.uploads++;
    }
    const p = placeTile(tile, camera, area);
    gl.uniform4f(this.destination, p.x, p.y, p.width, p.height);
    gl.uniform4f(
      this.source,
      p.sx / tileExtent,
      p.sy / tileExtent,
      p.sw / tileExtent,
      p.sh / tileExtent,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  release(tile: SceneTile) {
    const resource = this.textures.get(tile);
    if (resource) this.gl.deleteTexture(resource.texture);
    this.textures.delete(tile);
  }

  end() {
    // 零超时轮询已提交批次，避免错误检查等待当前帧的纹理上传。
    if (this.uploads) {
      if (this.validation) this.gl.deleteSync(this.validation);
      this.validation = this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE, 0) ?? undefined;
    }
  }

  dispose() {
    if (this.validation) this.gl.deleteSync(this.validation);
    for (const tile of this.textures.keys()) this.release(tile);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}
