/** Shader compilation with readable error reporting and cached uniform lookups. */

export const FULLSCREEN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export class Program {
  readonly handle: WebGLProgram;
  private uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(private readonly gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    if (!prog) throw new Error('createProgram failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program link failed: ${log}`);
    }
    this.handle = prog;
  }

  use(): void { this.gl.useProgram(this.handle); }

  loc(name: string): WebGLUniformLocation | null {
    let l = this.uniforms.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.handle, name);
      this.uniforms.set(name, l);
    }
    return l;
  }

  f(name: string, v: number): void { this.gl.uniform1f(this.loc(name), v); }
  i(name: string, v: number): void { this.gl.uniform1i(this.loc(name), v); }
  v2(name: string, x: number, y: number): void { this.gl.uniform2f(this.loc(name), x, y); }
  v3(name: string, x: number, y: number, z: number): void { this.gl.uniform3f(this.loc(name), x, y, z); }
  v4(name: string, x: number, y: number, z: number, w: number): void { this.gl.uniform4f(this.loc(name), x, y, z, w); }
  tex(name: string, unit: number, texture: WebGLTexture | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.loc(name), unit);
  }

  dispose(): void { this.gl.deleteProgram(this.handle); }
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? '';
    gl.deleteShader(sh);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    const numbered = source.split('\n').map((l, i) => `${String(i + 1).padStart(3)}: ${l}`).join('\n');
    throw new Error(`${kind} shader compile failed:\n${log}\n${numbered}`);
  }
  return sh;
}
