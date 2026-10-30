'use strict';

// Constructor
function Model(name) {
    this.name = name;
    this.uCurves = [];   // набір U-кривих (v = const)
    this.vCurves = [];   // набір V-кривих (u = const)

    // параметри поверхні
    const R = 1.0;       // радіус
    const a = 0.12;      // амплітуда гофри
    const n = 10;        // кількість хвиль

    // скільки кривих у кожному наборі
    const uCurvesCount = 40;
    const vCurvesCount = 40;
    // скільки точок на кожній кривій
    const pointsPerCurve = 100;

    // параметричне рівняння поверхні
    function surfacePoint(u, v) {
        const r = R + a * Math.cos(n * v);
        return [
            r * Math.sin(u) * Math.cos(v),
            r * Math.sin(u) * Math.sin(v),
            r * Math.cos(u)
        ];
    }

    // створює WebGL-буфер з масиву координат однієї кривої
    function makeCurve(vertices) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        return { buffer: buffer, count: vertices.length / 3 };
    }

    // будує всі криві
    this.BuildGeometry = function () {
        // U-криві: u змінюється від 0 до PI, v фіксоване
        for (let j = 0; j <= vCurvesCount; j++) {
            const v = (j / vCurvesCount) * 2 * Math.PI;
            const verts = [];
            for (let i = 0; i <= pointsPerCurve; i++) {
                const u = (i / pointsPerCurve) * Math.PI;
                verts.push(...surfacePoint(u, v));
            }
            this.uCurves.push(makeCurve(verts));
        }
        // V-криві: v змінюється від 0 до 2*PI, u фіксоване
        for (let i = 0; i <= uCurvesCount; i++) {
            const u = (i / uCurvesCount) * Math.PI;
            const verts = [];
            for (let j = 0; j <= pointsPerCurve; j++) {
                const v = (j / pointsPerCurve) * 2 * Math.PI;
                verts.push(...surfacePoint(u, v));
            }
            this.vCurves.push(makeCurve(verts));
        }
    };

    // малює всі криві
    this.Draw = function () {
        const drawSet = (curves) => {
            for (const c of curves) {
                gl.bindBuffer(gl.ARRAY_BUFFER, c.buffer);
                gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(shProgram.iAttribVertex);
                gl.drawArrays(gl.LINE_STRIP, 0, c.count);
            }
        };
        drawSet(this.uCurves);
        drawSet(this.vCurves);
    };
}