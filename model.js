'use strict';

function Model(name) {
    this.name = name;
    this.vertexBuffer = gl.createBuffer();   // позиції вершин
    this.normalBuffer = gl.createBuffer();   // нормалі вершин
    this.indexBuffer  = gl.createBuffer();   // індекси трикутників
    this.indexCount = 0;

    // параметри поверхні
    const R = 1.0, a = 0.12, n = 10;

    function surfacePoint(u, v) {
        const r = R + a * Math.cos(n * v);
        return [
            r * Math.sin(u) * Math.cos(v),
            r * Math.sin(u) * Math.sin(v),
            r * Math.cos(u)
        ];
    }

    // допоміжні векторні функції
    const sub   = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const dot   = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const len   = (p) => Math.sqrt(dot(p, p));
    const cross = (p, q) => [
        p[1] * q[2] - p[2] * q[1],
        p[2] * q[0] - p[0] * q[2],
        p[0] * q[1] - p[1] * q[0]
    ];

    // кут при вершині p між ребрами p->q і p->r
    function cornerAngle(p, q, r) {
        const e1 = sub(q, p), e2 = sub(r, p);
        const l1 = len(e1), l2 = len(e2);
        if (l1 < 1e-9 || l2 < 1e-9) return 0;
        const c = Math.min(1, Math.max(-1, dot(e1, e2) / (l1 * l2)));
        return Math.acos(c);
    }

    // будує сітку з uN x vN комірок і заливає буфери
    this.BuildGeometry = function (uN, vN) {
        const pos = [], norms = [], indices = [];
        const stride = vN + 1;

        // 1. вершини
        for (let i = 0; i <= uN; i++) {
            const u = (i / uN) * Math.PI;
            for (let j = 0; j <= vN; j++) {
                const v = (j / vN) * 2 * Math.PI;
                pos.push(surfacePoint(u, v));
                norms.push([0, 0, 0]);
            }
        }

        // 2. додає внесок грані в нормалі її трьох вершин (вага = кут)
        function addTriangle(i0, i1, i2) {
            const p0 = pos[i0], p1 = pos[i1], p2 = pos[i2];
            const fn = cross(sub(p1, p0), sub(p2, p0));
            const fl = len(fn);
            if (fl < 1e-9) return;                 // виродкова грань (біля полюсів)
            const nrm = [fn[0] / fl, fn[1] / fl, fn[2] / fl];
            const corners = [[i0, p0, p1, p2], [i1, p1, p2, p0], [i2, p2, p0, p1]];
            for (const [idx, p, q, r] of corners) {
                const w = cornerAngle(p, q, r);
                norms[idx][0] += nrm[0] * w;
                norms[idx][1] += nrm[1] * w;
                norms[idx][2] += nrm[2] * w;
            }
        }

        // 3. трикутники та індекси
        for (let i = 0; i < uN; i++) {
            for (let j = 0; j < vN; j++) {
                const a0 = i * stride + j;
                const b0 = a0 + 1;
                const c0 = a0 + stride;
                const d0 = c0 + 1;
                indices.push(a0, c0, b0,  b0, c0, d0);
                addTriangle(a0, c0, b0);
                addTriangle(b0, c0, d0);
            }
        }

        // 4. шов (j = 0 та j = vN це одна й та сама лінія): об'єднуємо нормалі
        for (let i = 0; i <= uN; i++) {
            const i0 = i * stride, i1 = i0 + vN;
            for (let k = 0; k < 3; k++) {
                const s = norms[i0][k] + norms[i1][k];
                norms[i0][k] = s;
                norms[i1][k] = s;
            }
        }

        // 5. полюси (u = 0 та u = PI): усі вершини рядка це одна точка
        for (const row of [0, uN]) {
            const s = [0, 0, 0];
            for (let j = 0; j <= vN; j++)
                for (let k = 0; k < 3; k++) s[k] += norms[row * stride + j][k];
            for (let j = 0; j <= vN; j++)
                for (let k = 0; k < 3; k++) norms[row * stride + j][k] = s[k];
        }

        // 6. нормалізація і запис у плоскі масиви
        const posFlat = [], normFlat = [];
        for (let m = 0; m < pos.length; m++) {
            const l = len(norms[m]) || 1;
            posFlat.push(...pos[m]);
            normFlat.push(norms[m][0] / l, norms[m][1] / l, norms[m][2] / l);
        }

        // 7. завантаження в GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(posFlat), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normFlat), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        this.indexCount = indices.length;
    };

    this.Draw = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}