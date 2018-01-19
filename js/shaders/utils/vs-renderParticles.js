const vsParticles = `#version 300 es
uniform mat4 uCameraMatrix;
uniform mat4 uPMatrix;

uniform sampler2D uTexturePosition;
uniform sampler2D uTextureData;
uniform float uScale;
uniform vec3 uBucketData;
out vec4 colorData;

void main() {

    int tSize = textureSize(uTexturePosition, 0).x;
    float textureSize = float(tSize);
    vec2 index = vec2(float(gl_VertexID % tSize) + 0.5, (floor(float(gl_VertexID) / textureSize)) + 0.5) / textureSize;

    //Positions are in the [0, 128) range, the division normalizes to the space [0 - 1).
    vec3 position = texture(uTexturePosition, index).rgb / uScale;

    if(position.y < 0.) position = vec3(0.);

    colorData.rgb = texture(uTexturePosition, index).rgb / uScale;

    colorData.a = .2;

    gl_Position = uPMatrix * uCameraMatrix * vec4(position, 1.);

    gl_PointSize = 4.;
}
`;

export {vsParticles}
