const { DesktopDuplication } = require('windows-desktop-duplication');
import { writeFileSync } from 'fs';
import { PNG } from 'pngjs';

/**
 * Применяет экспозицию, sRGB гамма-коррекцию и альфа-композитинг на чёрном фоне.
 * @param {number} c - Линейное значение цвета (HDR), обычно в диапазоне [0, ~10+]
 * @param {number} exposure - Масштаб яркости, например 0.4
 * @returns {number} sRGB-значение [0..255]
 */
function toneMapChannel(c: number, exposure: number): number {
    // Применим экспозицию
    let mapped = c * exposure;

    // Обрезаем до 1.0
    mapped = Math.min(1.0, Math.max(0.0, mapped));

    // sRGB gamma correction (точная формула)
    if (mapped <= 0.0031308) {
        mapped = 12.92 * mapped;
    } else {
        mapped = 1.055 * Math.pow(mapped, 1 / 2.4) - 0.055;
    }

    return Math.round(mapped * 255);
}

function getPNG(floatBuf: Float32Array, width: number, height: number): Buffer {
    const png = new PNG({ width, height, colorType: 6, bitDepth: 8 });
    const exposure = 0.33; // как в GIMP при 40% прозрачности

    for (let i = 0; i < width * height * 4; i += 4) {
        const r = toneMapChannel(floatBuf[i + 0], exposure);
        const g = toneMapChannel(floatBuf[i + 1], exposure);
        const b = toneMapChannel(floatBuf[i + 2], exposure);
        const a = Math.round(Math.min(1, Math.max(0, floatBuf[i + 3])) * 255); // прозрачность можно сохранить или игнорировать

        png.data[i + 0] = r;
        png.data[i + 1] = g;
        png.data[i + 2] = b;
        png.data[i + 3] = a;
    }

    const buffer = PNG.sync.write(png);
    writeFileSync("test1234.png", buffer);

    return buffer;
}

export function getFrame(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        console.log('screenshoting...');
        let dd = new DesktopDuplication(0);

        try {
            dd.initialize();

            dd.getFrameAsync().then(frame => {
                console.log("Got frame!");
                console.log(`Width: ${frame.width} Height: ${frame.height}`);

                const floatBuf = new Float32Array(
                    frame.data.buffer,
                    frame.data.byteOffset,
                    frame.width * frame.height * 4
                );
                resolve(getPNG(floatBuf, frame.width, frame.height));
            })
        } catch (err: any) {
            console.log("An error occured:", err.message);
            reject(err);
        }
    })
}