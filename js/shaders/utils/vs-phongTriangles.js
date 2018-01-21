const vsPhongTriangles = `#version 300 es

precision highp float;
precision highp sampler2D;

uniform mat4 uCameraMatrix;
uniform mat4 uPMatrix;
uniform highp sampler2D uTT;

out vec2 uv;

void main(void) {

    int tSize = textureSize(uTT, 0).x;
    float textureSize = float(tSize);
    uv = vec2(float(gl_VertexID % tSize) + 0.5, (floor(float(gl_VertexID) / textureSize)) + 0.5) / textureSize;
    gl_Position = uPMatrix * uCameraMatrix * vec4(texture(uTT, uv).rgb, 1.0);
    
}

`;

export {vsPhongTriangles}