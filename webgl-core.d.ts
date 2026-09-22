// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export { GlRenderer, type GlRendererOptions, type GlWorldLike, type GlFrameOptions } from './webgl/renderer.js';
export { GlContext, type GlOptions } from './webgl/context.js';
export { GlQuadBatch, buildQuadVertGLSL, buildQuadFragGLSL } from './webgl/quadbatch.js';
export { GlTriBatch, buildTriVertGLSL, buildTriFragGLSL } from './webgl/tribatch.js';
export { GlMsdfRenderer, buildMsdfVertGLSL, buildMsdfFragGLSL } from './webgl/msdf.js';
export { GlFxBatch, buildFxVertGLSL, buildFxFragGLSL } from './webgl/fxbatch.js';
export { GlGridBatch, buildGridVertGLSL, buildGridFragGLSL } from './webgl/gridbatch.js';
export { GlVectorLayer, buildLineVertGLSL, buildLineFragGLSL, buildFillVertGLSL, buildFillFragGLSL } from './webgl/vector.js';
export { GlGlowPass, buildGlowStampVertGLSL, buildGlowStampFragGLSL, buildFullscreenVertGLSL, buildGlowBlurFragGLSL, buildGlowCompositeFragGLSL, } from './webgl/glowpass.js';
export { GlPostChain, buildEffectGLSL, GLSL_EFFECT_SNIPPETS, POST_VS_GLSL } from './webgl/post.js';
export { GlBackdropChain, buildBackdropGLSL, GLSL_BACKDROP_SNIPPETS, BG_BLIT_FS_GLSL } from './webgl/backdrop.js';
export { GlLights2d, buildLightVertGLSL, buildLightFragGLSL, buildAmbientVertGLSL, buildAmbientFragGLSL, } from './webgl/lights2d.js';
export { compileProgram, textureFromSource, instanceVec4Attribs, InstanceBuffer, GLSL_HEADER, GLSL_FRAG_HEADER } from './webgl/shaders.js';
