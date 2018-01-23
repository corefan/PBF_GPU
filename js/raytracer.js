import {gl}                     from './utils/webGL2.js';
import * as webGL2              from './utils/webGL2.js';
import * as PBF                 from './pbf.js';
import * as Mesher              from './mesher.js';
import * as Programs            from './shaders.js';
import {Camera}                 from './utils/camera.js';


//=======================================================================================================
// Variables & Constants
//=======================================================================================================

//Set the canvas
let canvas = document.querySelector("#canvas3D");
canvas.height = 1000;
canvas.width = canvas.height * 2.5;
canvas.style.width = String(canvas.width) + "px";
canvas.style.height = String(canvas.height) + "px";
webGL2.setContext(canvas);

//Initiate the shaders programs
Programs.init();

let camera = new Camera(canvas);
let cameraDistance = 2.5;
let FOV = 30;

//For the Positionn Based Fluids
let updateSimulation = true;
let deltaTime = 0.01;
let constrainsIterations = 4;
let pbfResolution = 128;
let voxelTextureSize = 2048;
let particlesTextureSize = 1000;
let particlesPosition = [];
let particlesVelocity = []
let currentFrame = 0;

//Change these values to change marching cubes resolution (128/2048/1024 or 256/4096/2048)
let resolution = 128;
let expandedTextureSize = 2048;
let compressedTextureSize = 1024;
let compactTextureSize = 1500;
let compressedBuckets = 8;
let expandedBuckets = 16;
let particleSize = 2;
let blurSteps = 5;
let range = 0.31;
let maxCells = 3.5;
let fastNormals = false;

//For the raytracer
let lowResolutionTextureSize = 256;
let lowGridPartitions = 32;
let lowSideBuckets = 8;
let sceneSize = 1024;       //Requires to be a power of two for mip mapping
let floorTextureSize = 2048;
let floorScale = 5;
let causticsSize = 2048;
let totalPhotons = causticsSize * causticsSize;
let causticSteps = 0;

let lockCamera = false;
let refraction = 1.4;
let maxIterations = 600.;
let refractions = 7;
let reflections = 3;
let maxStepsPerBounce = 600;
let screenResolution = 4;
let absorptionColor = [46, 46, 46];
let dispersion = 0.01;
let energyDecay = 0;
let distanceAbsorptionScale = 6;
let blurShadowsRadius = 30;

let kS = 0.;
let kD = 0.;
let kA = 0.;
let shinny = 60;

let lightAlpha = 36;
let lightBeta = 0;
let lightIntensity = 2.5;
let lightDistance = 3;
let backgroundColor = 0.65;

let photonTextureSize = 3;
let photonSize = 2;
let photonEnergy = 0.2;
let reflectionPhotons = 0.;
let photonsToEmit = 1;
let photonSteps = 1;
let radianceRadius = 3.6;
let radiancePower = 0.19;

let rtCaustics = false;
let calculateShadows = true;
let calculateCaustics = true;
let shadowIntensity = 1;

let killRay = 0.02;
let disableAcceleration = false;
let lightColor = [255, 255, 255];
let materialColor = [255, 255, 255];

let radius = pbfResolution * 0.45;
//Generate the position and velocity
for (let i = 0; i < pbfResolution; i++) {
    for (let j = 0; j < pbfResolution; j++) {
        for (let k = 0; k < pbfResolution; k++) {

            //Condition for the particle position and existence
            let x = i - pbfResolution * 0.5;
            let y = j - pbfResolution * 0.5;
            let z = k - pbfResolution * 0.5;

            if (x * x + y * y + z * z < radius * radius && k < pbfResolution * 0.4) {
                particlesPosition.push(i, j, k, 1);
                particlesVelocity.push(0, 0, 0, 0); //Velocity is zero for all the particles.
            }
        }
    }
}

//With this there're 4M vsPhotons
let arrayRays = [];
for (let i = 0; i < totalPhotons; i++) arrayRays.push(Math.random(), Math.random(), Math.random(), i);


//=======================================================================================================
// Textures and framebuffers
//=======================================================================================================


//Textures
let tHelper = webGL2.createTexture2D(expandedTextureSize, expandedTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT);
let tVoxelsLow = webGL2.createTexture2D(lowResolutionTextureSize, lowResolutionTextureSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT);
let tScreenPositions = webGL2.createTexture2D(sceneSize, sceneSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT);
let tScreenNormals = webGL2.createTexture2D(sceneSize, sceneSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT);
let tFloorLines = webGL2.createTexture2D(floorTextureSize, floorTextureSize, gl.RGBA8, gl.RGBA, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, gl.UNSIGNED_BYTE, null, gl.REPEAT);
let tShadows = webGL2.createTexture2D(sceneSize, sceneSize, gl.RGBA16F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.HALF_FLOAT);
let tShadows2 = webGL2.createTexture2D(sceneSize, sceneSize, gl.RGBA16F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.HALF_FLOAT);
let tRaysRandom = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA32F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.FLOAT, new Float32Array(arrayRays));
let tPhotons1 = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA16F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.HALF_FLOAT,);
let tPhotons2 = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA16F, gl.RGBA, gl.NEAREST, gl.NEAREST, gl.HALF_FLOAT);
let tCaustics = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA16F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.HALF_FLOAT);
let tRadiance = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA16F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.HALF_FLOAT);
let tRadiance2 = webGL2.createTexture2D(causticsSize, causticsSize, gl.RGBA16F, gl.RGBA, gl.LINEAR, gl.LINEAR, gl.HALF_FLOAT);


//Framebuffers
let fbHelper = webGL2.createDrawFramebuffer(tHelper, true);
let fbVoxelsLow = webGL2.createDrawFramebuffer(tVoxelsLow);
let fbDeferred = webGL2.createDrawFramebuffer([tScreenPositions, tScreenNormals], true);
let fbFloorLines = webGL2.createDrawFramebuffer(tFloorLines);
let fbShadowsData = webGL2.createDrawFramebuffer([tShadows, tShadows2]);
let fbShadows = webGL2.createDrawFramebuffer(tShadows);
let fbShadows2 = webGL2.createDrawFramebuffer(tShadows2);
let fbPhotons = webGL2.createDrawFramebuffer([tPhotons1, tPhotons2]);
let fbCaustics = webGL2.createDrawFramebuffer(tCaustics);
let fbRadiance = webGL2.createDrawFramebuffer(tRadiance);
let fbRadiance2 = webGL2.createDrawFramebuffer(tRadiance2);


arrayRays = null;

//=======================================================================================================
// Simulation and Rendering (Position based fluids. marching cubes and raytracing)
//=======================================================================================================

//Floor lines texture
gl.useProgram(Programs.floorProgram);
gl.uniform1f(Programs.floorProgram.backgroundColor, 1);
gl.bindFramebuffer(gl.FRAMEBUFFER, fbFloorLines);
gl.viewport(0, 0, floorTextureSize, floorTextureSize);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
gl.bindTexture(gl.TEXTURE_2D, tFloorLines);
gl.generateMipmap(gl.TEXTURE_2D);
gl.bindTexture(gl.TEXTURE_2D, null);

//Initiate the position based fluids solver
PBF.init(particlesPosition, particlesVelocity, pbfResolution, voxelTextureSize, particlesTextureSize);
particlesPosition = null;
particlesVelocity = null;

//Initiate the mesher generator
Mesher.init(resolution, expandedTextureSize, compressedTextureSize, compactTextureSize, compressedBuckets, expandedBuckets);

//Function used to render the particles in a framebuffer.
let renderParticles = (_x, _u, _width, _height, buffer, cleanBuffer = true) => {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer);
    gl.viewport(_x, _u, _width, _height);
    gl.useProgram(Programs.renderParticles);
    webGL2.bindTexture(Programs.renderParticles.positionTexture, PBF.positionTexture, 0);
    gl.uniform1f(Programs.renderParticles.scale, pbfResolution);
    gl.uniformMatrix4fv(Programs.renderParticles.cameraMatrix, false, camera.cameraTransformMatrix);
    gl.uniformMatrix4fv(Programs.renderParticles.perspectiveMatrix, false, camera.perspectiveMatrix);
    if (cleanBuffer) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.POINTS, 0, PBF.totalParticles);
    gl.disable(gl.DEPTH_TEST);
}

//Function used to check the textures
let checkTexture = (texture, _x, _u, _width, _height, buffer, cleanBuffer = true, forceAlpha = false) => {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer);
    gl.viewport(_x, _u, _width, _height);
    gl.useProgram(Programs.texture);
    webGL2.bindTexture(Programs.texture.texture, texture, 0);
    gl.uniform1i(Programs.texture.forceAlpha, forceAlpha);
    if (cleanBuffer) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

//Function used to evaluate the fsRadiance
let evaluateRadiance = () => {
    
    //Caustics fsRadiance
    gl.useProgram(Programs.radianceProgram);
    gl.uniform1f(Programs.radianceProgram.radius, radianceRadius);
    gl.uniform1f(Programs.radianceProgram.radiancePower, radiancePower);
    gl.viewport(0, 0, causticsSize, causticsSize);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbRadiance);
    gl.clear(gl.COLOR_BUFFER_BIT);
    webGL2.bindTexture(Programs.radianceProgram.photonTexture, tCaustics, 0);
    gl.uniform2f(Programs.radianceProgram.axis, 0, 1 / causticsSize);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbRadiance2);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(Programs.radianceProgram.axis, 1 / causticsSize, 0);
    webGL2.bindTexture(Programs.radianceProgram.photonTexture, tRadiance, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
}

gl.cullFace(gl.FRONT);
gl.blendEquation(gl.FUNC_ADD);
gl.blendFunc(gl.ONE, gl.ONE);

let render = () => {

    requestAnimationFrame(render);

    camera.updateCamera(FOV, 1, cameraDistance);

    //Calculate the light position
    let lightPos = {x: 0, y: 0, z: 0};
    let lAlpha = lightAlpha * Math.PI / 180;
    let lBeta = lightBeta * Math.PI / 180;
    let r = lightDistance;
    let s = Math.sin(lAlpha);
    lightPos.x = r * s * Math.cos(lBeta) + 0.5;
    lightPos.y = r * Math.cos(lAlpha);
    lightPos.z = r * s * Math.sin(lBeta) + 0.5;

    let acceleration = {
        x: 0 * Math.sin(currentFrame * Math.PI / 180),
        y: -10,
        z: 0 * Math.cos(currentFrame * Math.PI / 180)
    }


    if (updateSimulation) {

        //Update the simulation
        PBF.updateFrame(acceleration, deltaTime, constrainsIterations);

        //Generate the mesh from the simulation particles
        Mesher.generateMesh(PBF.positionTexture, PBF.totalParticles, pbfResolution, particleSize, blurSteps, range, maxCells, fastNormals);

        currentFrame++;

    }

    //Ray tracing section

    let activeMCells = Math.ceil(maxCells * expandedTextureSize * expandedTextureSize / 100);


    //Generate the high resolution grid for the ray tracer
    gl.useProgram(Programs.highResGridProgram);
    webGL2.bindTexture(Programs.highResGridProgram.verticesTexture, Mesher.tVoxelsOffsets, 0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbHelper);
    gl.viewport(0, 0, expandedTextureSize, expandedTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.POINTS, 0, 15 * activeMCells);
    gl.disable(gl.DEPTH_TEST);


    //Generate the low resolution grid for the ray tracer
    gl.useProgram(Programs.lowResGridProgram);
    webGL2.bindTexture(Programs.lowResGridProgram.positionTexture, Mesher.tTriangles, 0);
    gl.uniform3f(Programs.lowResGridProgram.gridPartitioning, 1 / lowResolutionTextureSize, lowGridPartitions, lowSideBuckets);
    gl.viewport(0, 0, lowResolutionTextureSize, lowResolutionTextureSize);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbVoxelsLow);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, 15 * activeMCells);


    //Render the triangles to save positions and normals for screen space raytracing.
    gl.useProgram(Programs.deferredProgram);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbDeferred);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, sceneSize, sceneSize);
    webGL2.bindTexture(Programs.deferredProgram.textureTriangles, Mesher.tTriangles, 0);
    webGL2.bindTexture(Programs.deferredProgram.textureNormals, Mesher.tNormals, 1);
    gl.uniformMatrix4fv(Programs.deferredProgram.cameraMatrix, false, camera.cameraTransformMatrix);
    gl.uniformMatrix4fv(Programs.deferredProgram.perspectiveMatrix, false, camera.perspectiveMatrix);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, 15 * activeMCells);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);


    if (calculateShadows) {

        //Calculate the shadows for the floor
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbShadowsData);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, sceneSize, sceneSize);
        gl.useProgram(Programs.floorShadowsProgram);
        webGL2.bindTexture(Programs.floorShadowsProgram.textureTriangles, Mesher.tTriangles, 0);
        webGL2.bindTexture(Programs.floorShadowsProgram.textureNormals, Mesher.tNormals, 1);
        webGL2.bindTexture(Programs.floorShadowsProgram.potentialTexture, tHelper, 2);
        webGL2.bindTexture(Programs.floorShadowsProgram.lowResPotential, tVoxelsLow, 3);
        gl.uniform1i(Programs.floorShadowsProgram.iterations, maxIterations);
        gl.uniform1i(Programs.floorShadowsProgram.maxStepsPerBounce, maxStepsPerBounce);
        gl.uniform3f(Programs.floorShadowsProgram.texture3DData, expandedTextureSize, resolution, expandedBuckets);
        gl.uniform3f(Programs.floorShadowsProgram.voxelLowData, tVoxelsLow.size, lowGridPartitions, lowSideBuckets);
        gl.uniform4f(Programs.floorShadowsProgram.lightData, lightPos.x, lightPos.y, lightPos.z, lightIntensity);
        gl.uniform1f(Programs.floorShadowsProgram.scaler, floorScale);
        gl.uniform1f(Programs.floorShadowsProgram.size, sceneSize);
        gl.uniform1f(Programs.floorShadowsProgram.compactTextureSize, compactTextureSize);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


        //Evaluate the bounding box of the shadow for the fsCaustics
        let levels = Math.ceil(Math.log(sceneSize) / Math.log(2));
        gl.useProgram(Programs.shadowBoundingBoxProgram);
        for (let i = 0; i < levels; i++) {
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, Mesher.fbPyramid[levels - i - 1]);
            let size = Math.pow(2, levels - 1 - i);
            gl.viewport(0, 0, size, size);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform1f(Programs.shadowBoundingBoxProgram.size, Math.pow(2, i + 1) / sceneSize);
            webGL2.bindTexture(Programs.shadowBoundingBoxProgram.potentialTexture, i == 0 ? tShadows2 : Mesher.tLevels[levels - i], 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }


        //Blur for the shadows
        gl.useProgram(Programs.blurShadowProgram);
        gl.uniform1f(Programs.blurShadowProgram.radius, blurShadowsRadius);
        gl.viewport(0, 0, sceneSize, sceneSize);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbShadows2);
        webGL2.bindTexture(Programs.blurShadowProgram.shadowTexture, tShadows, 0);
        gl.uniform2f(Programs.blurShadowProgram.axis, 0, 1 / sceneSize);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbShadows);
        webGL2.bindTexture(Programs.blurShadowProgram.shadowTexture, tShadows2, 0);
        gl.uniform2f(Programs.blurShadowProgram.axis, 1 / sceneSize, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    }

    let photonHeight = Math.ceil(causticsSize * photonsToEmit / photonSteps);

    //Calculate the fsCaustics
    if (calculateCaustics) {

        if (causticSteps < photonSteps) {

            //Caustics photon map saved in a plane
            gl.useProgram(Programs.causticsProgram);
            webGL2.bindTexture(Programs.causticsProgram.boundingBoxTexture, Mesher.tLevels[0], 0);
            webGL2.bindTexture(Programs.causticsProgram.randomTexture, tRaysRandom, 1);
            webGL2.bindTexture(Programs.causticsProgram.textureTriangles, Mesher.tTriangles, 2);
            webGL2.bindTexture(Programs.causticsProgram.textureNormals, Mesher.tNormals, 3);
            webGL2.bindTexture(Programs.causticsProgram.potentialTexture, tHelper, 4);
            webGL2.bindTexture(Programs.causticsProgram.lowResPotential, tVoxelsLow, 5);
            gl.uniform3f(Programs.causticsProgram.lightPosition, lightPos.x, lightPos.y, lightPos.z);
            gl.uniform3f(Programs.causticsProgram.absorption, 1. - absorptionColor[0] / 255, 1. - absorptionColor[1] / 255, 1. - absorptionColor[2] / 255);
            gl.uniform3f(Programs.causticsProgram.texture3DData, expandedTextureSize, resolution, expandedBuckets);
            gl.uniform3f(Programs.causticsProgram.voxelLowData, lowResolutionTextureSize, lowGridPartitions, lowSideBuckets);
            gl.uniform3f(Programs.causticsProgram.lightColor, lightColor[0] / 255, lightColor[1] / 255, lightColor[2] / 255);
            gl.uniform1f(Programs.causticsProgram.reflectionPhotons, reflectionPhotons);
            gl.uniform1f(Programs.causticsProgram.scale, floorScale);
            gl.uniform1f(Programs.causticsProgram.photonEnergy, photonEnergy);
            gl.uniform1f(Programs.causticsProgram.refract, refraction);
            gl.uniform1f(Programs.causticsProgram.distanceAbsorptionScale, distanceAbsorptionScale);
            gl.uniform1i(Programs.causticsProgram.refractions, refractions);
            gl.uniform1i(Programs.causticsProgram.reflections, reflections);
            gl.uniform1i(Programs.causticsProgram.iterations, maxIterations);
            gl.uniform1i(Programs.causticsProgram.maxStepsPerBounce, maxStepsPerBounce);
            gl.uniform1f(Programs.causticsProgram.dispersion, dispersion);
            gl.uniform1f(Programs.causticsProgram.compactTextureSize, compactTextureSize);


            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbPhotons);
            if (causticSteps == 0) {
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            gl.viewport(0, 0, causticsSize, causticsSize);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(0, photonHeight * causticSteps, causticsSize, photonHeight);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.disable(gl.SCISSOR_TEST);
            causticSteps++;
        }

        else {

            // calculateCaustics = false;
            causticSteps = 0;

            //allocate the calculated vsPhotons on the fsCaustics texture
            gl.useProgram(Programs.photonsGatherProgram);
            gl.uniform1f(Programs.photonsGatherProgram.photonSize, photonSize);
            webGL2.bindTexture(Programs.photonsGatherProgram.positions, tPhotons1, 0);
            webGL2.bindTexture(Programs.photonsGatherProgram.colors, tPhotons2, 1);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbCaustics);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.viewport(0, 0, causticsSize, causticsSize);
            gl.enable(gl.BLEND);
            gl.drawArrays(gl.POINTS, 0, Math.floor(totalPhotons * photonsToEmit));
            gl.disable(gl.BLEND);

            evaluateRadiance();

        }
    }

    //Checking texture results
    checkTexture(tShadows2, 0, 500, 500, 500, null, true, true);
    checkTexture(tRadiance2, 500, 500, 500, 500, null, false, true);
    checkTexture(tScreenPositions, 0, 0, 500, 500, null, false, true);
    checkTexture(tScreenNormals, 500, 0, 500, 500, null, false, true);

};

document.body.addEventListener("keypress", () => {
    updateSimulation = !updateSimulation;
})

render();