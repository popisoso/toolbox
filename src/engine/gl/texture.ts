/** Texture helpers, including per-frame upload from a <video>. */

export function createTexture(gl: WebGL2RenderingContext, linear = true): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const f = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** Allocate an empty RGBA8 texture of the given size (for render targets). */
export function allocTexture(gl: WebGL2RenderingContext, tex: WebGLTexture, width: number, height: number): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Upload the current video frame. Returns false if the element has no data yet.
 * WebGL2 accepts HTMLVideoElement directly; on iOS this requires `playsinline`.
 */
export function uploadVideoFrame(gl: WebGL2RenderingContext, tex: WebGLTexture, video: HTMLVideoElement): boolean {
  if (video.readyState < 2 || video.videoWidth === 0) return false;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return true;
}
