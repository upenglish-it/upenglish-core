/**
 * Audio Preprocessing Pipeline for Pronunciation Evaluation
 * Uses Web Audio API (no external dependencies)
 * 
 * Pipeline: Decode → High-pass filter → Noise gate → Trim silence → Normalize → WAV
 */

/**
 * Safari-safe AudioBuffer creation.
 * Older Safari (< 14.1) doesn't support `new AudioBuffer(options)`.
 */
function createAudioBuffer(numberOfChannels, length, sampleRate) {
    try {
        return new AudioBuffer({ numberOfChannels, length, sampleRate });
    } catch (e) {
        // Fallback: use OfflineAudioContext to create a buffer
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const ctx = new OfflineCtx(numberOfChannels, length, sampleRate);
        return ctx.createBuffer(numberOfChannels, length, sampleRate);
    }
}

/**
 * Process an audio Blob through the cleanup pipeline.
 * @param {Blob} inputBlob - Raw audio blob from MediaRecorder
 * @returns {Promise<Blob>} - Cleaned audio blob (WAV format)
 */
export async function preprocessAudio(inputBlob) {
    try {
        const arrayBuffer = await inputBlob.arrayBuffer();

        // Construct context. Try Offline first, fallback to standard if needed 
        // (Safari has quirks with OfflineCtx decoding certain WebM blobs)
        const AudioCtxConstructor = window.AudioContext || window.webkitAudioContext;
        const OfflineCtxConstructor = window.OfflineAudioContext || window.webkitOfflineAudioContext;

        let audioCtx;
        try {
            audioCtx = new OfflineCtxConstructor(1, 44100, 44100);
        } catch (e) {
            audioCtx = new AudioCtxConstructor();
        }

        const decoded = await new Promise((resolve, reject) => {
            audioCtx.decodeAudioData(
                arrayBuffer.slice(0), // Pass a copy in case of retry
                (buffer) => resolve(buffer),
                (err) => reject(err || new Error("decodeAudioData failed silently"))
            );
        }).catch(async (err) => {
            console.warn('[audioPreprocess] Primary decode failed, retrying with standard AudioContext', err);
            // Safari Safari Safari... fallback to standard AudioContext
            const fallbackCtx = new AudioCtxConstructor();
            const fallbackDecoded = await new Promise((res, rej) => {
                fallbackCtx.decodeAudioData(
                    arrayBuffer.slice(0),
                    (buffer) => res(buffer),
                    (e) => rej(e)
                );
            });
            if (fallbackCtx.state !== 'closed') await fallbackCtx.close();
            return fallbackDecoded;
        });

        // Close primary context if it wasn't offline
        if (audioCtx.state && audioCtx.state !== 'closed' && !(audioCtx instanceof OfflineCtxConstructor)) {
            await audioCtx.close();
        }

        // Step 1: High-pass filter (remove frequencies below 100Hz)
        const filtered = await applyHighPassFilter(decoded, 100);

        // Step 2: Trim silence from start and end
        const trimmed = trimSilence(filtered, 0.01);

        // Step 3: Normalize volume to use full dynamic range
        const normalized = normalizeAudio(trimmed);

        // Encode to WAV blob (universally supported, lossless)
        const wavBlob = encodeWAV(normalized);
        console.log('[audioPreprocess] Success: pipeline completed');
        return wavBlob;
    } catch (err) {
        console.warn('[audioPreprocess] Pipeline failed, returning original blob:', err?.message || err);
        return inputBlob;
    }
}

/**
 * Apply a high-pass filter using OfflineAudioContext.
 * Removes low-frequency noise (hum, rumble) below cutoffHz.
 */
async function applyHighPassFilter(audioBuffer, cutoffHz = 100) {
    const { numberOfChannels, length, sampleRate } = audioBuffer;
    const OfflineCtxConstructor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxConstructor(numberOfChannels, length, sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = cutoffHz;
    highpass.Q.value = 0.7; // Gentle roll-off

    source.connect(highpass);
    highpass.connect(offlineCtx.destination);
    source.start(0);
    return new Promise((resolve, reject) => {
        offlineCtx.oncomplete = (e) => resolve(e.renderedBuffer);
        offlineCtx.onerror = (e) => reject(e);
        const p = offlineCtx.startRendering();
        if (p && typeof p.then === 'function') {
            p.then(resolve).catch(reject);
        }
    });
}

/**
 * Simple noise gate: suppress samples below a threshold to reduce background noise.
 * Uses a smooth fade (attack/release) to avoid harsh clicks/pops.
 * Only suppresses continuous low-level noise; speech transients are preserved.
 */
function applyNoiseGate(audioBuffer, threshold = 0.015) {
    const numChannels = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    const sr = audioBuffer.sampleRate;
    const result = createAudioBuffer(numChannels, len, sr);

    // Attack/release time in samples (5ms)
    const fadeSamples = Math.floor(sr * 0.005);

    for (let ch = 0; ch < numChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = result.getChannelData(ch);
        let gateGain = 0; // 0 = gate closed (muted), 1 = gate open

        for (let i = 0; i < len; i++) {
            const abs = Math.abs(src[i]);
            if (abs > threshold) {
                // Open gate quickly (attack)
                gateGain = Math.min(1, gateGain + 1 / fadeSamples);
            } else {
                // Close gate slowly (release)
                gateGain = Math.max(0, gateGain - 1 / fadeSamples);
            }
            dst[i] = src[i] * gateGain;
        }
    }

    return result;
}

/**
 * Trim silence from the start and end of an AudioBuffer.
 * @param {AudioBuffer} audioBuffer
 * @param {number} threshold - Amplitude threshold (0-1) below which is "silence"
 * @returns {AudioBuffer}
 */
function trimSilence(audioBuffer, threshold = 0.01) {
    const data = audioBuffer.getChannelData(0); // Use first channel for detection
    const len = data.length;

    // Find first sample above threshold
    let start = 0;
    for (let i = 0; i < len; i++) {
        if (Math.abs(data[i]) > threshold) {
            start = Math.max(0, i - Math.floor(audioBuffer.sampleRate * 0.15)); // Keep 150ms before speech
            break;
        }
    }

    // Find last sample above threshold
    let end = len - 1;
    for (let i = len - 1; i >= 0; i--) {
        if (Math.abs(data[i]) > threshold) {
            end = Math.min(len - 1, i + Math.floor(audioBuffer.sampleRate * 0.3)); // Keep 300ms after speech (preserve ending consonants)
            break;
        }
    }

    // Safety: if trimmed too aggressively, return original
    const trimmedLength = end - start + 1;
    if (trimmedLength < audioBuffer.sampleRate * 0.1) { // Less than 100ms
        return audioBuffer;
    }

    // Create new buffer with trimmed data
    const numChannels = audioBuffer.numberOfChannels;
    const trimmedBuffer = createAudioBuffer(numChannels, trimmedLength, audioBuffer.sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
        const sourceData = audioBuffer.getChannelData(ch);
        const destData = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < trimmedLength; i++) {
            destData[i] = sourceData[start + i];
        }
    }

    return trimmedBuffer;
}

/**
 * Soft-limit ending sounds that are disproportionately loud due to mobile AGC.
 * Compares the amplitude of the last 30% of audio to the average of the first 70%.
 * If ending samples are much louder, gently reduce them to be proportional.
 * This preserves ending consonants but prevents them from dominating the signal.
 */
function softLimitEndings(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    const splitPoint = Math.floor(len * 0.7); // First 70% = main speech, last 30% = potential ending

    // Calculate RMS of the main speech portion (first 70%)
    const mainData = audioBuffer.getChannelData(0);
    let sumSquares = 0;
    for (let i = 0; i < splitPoint; i++) {
        sumSquares += mainData[i] * mainData[i];
    }
    const mainRMS = Math.sqrt(sumSquares / splitPoint);

    // If main speech is very quiet, skip limiting
    if (mainRMS < 0.005) return audioBuffer;

    // Find peak in ending portion
    let endingPeak = 0;
    for (let i = splitPoint; i < len; i++) {
        const abs = Math.abs(mainData[i]);
        if (abs > endingPeak) endingPeak = abs;
    }

    // If ending is not disproportionately loud (< 2x main RMS), skip
    const threshold = mainRMS * 2.5;
    if (endingPeak <= threshold) return audioBuffer;

    // Apply soft limiting: reduce ending samples that exceed threshold
    const ratio = threshold / endingPeak; // Reduction ratio
    const result = createAudioBuffer(numChannels, len, audioBuffer.sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = result.getChannelData(ch);

        // Copy main speech portion unchanged
        for (let i = 0; i < splitPoint; i++) {
            dst[i] = src[i];
        }

        // Apply gradual soft-limit to ending portion
        const fadeLen = Math.min(Math.floor(audioBuffer.sampleRate * 0.03), len - splitPoint); // 30ms fade-in for limiter
        for (let i = splitPoint; i < len; i++) {
            const fadeProgress = Math.min(1, (i - splitPoint) / fadeLen); // 0→1 over fade zone
            const limitGain = 1 - fadeProgress * (1 - ratio); // Gradually apply reduction
            dst[i] = src[i] * limitGain;
        }
    }

    return result;
}

/**
 * Normalize audio to use full dynamic range.
 * Finds the peak amplitude and scales all samples so peak = 0.95.
 * @param {AudioBuffer} audioBuffer
 * @returns {AudioBuffer}
 */
function normalizeAudio(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;

    // Find peak amplitude across all channels
    let peak = 0;
    for (let ch = 0; ch < numChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
        }
    }

    // If already silent or near-max, skip
    if (peak < 0.001 || peak > 0.9) return audioBuffer;

    const gain = 0.95 / peak;

    // Create normalized buffer
    const normalized = createAudioBuffer(numChannels, audioBuffer.length, audioBuffer.sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
        const sourceData = audioBuffer.getChannelData(ch);
        const destData = normalized.getChannelData(ch);
        for (let i = 0; i < sourceData.length; i++) {
            destData[i] = Math.max(-1, Math.min(1, sourceData[i] * gain));
        }
    }

    return normalized;
}

/**
 * Encode an AudioBuffer to a WAV Blob.
 * WAV is lossless and universally supported by AI models.
 */
function encodeWAV(audioBuffer) {
    const numChannels = 1; // Force mono for speech
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    // Mix down to mono if needed
    const monoData = new Float32Array(audioBuffer.length);
    if (audioBuffer.numberOfChannels === 1) {
        monoData.set(audioBuffer.getChannelData(0));
    } else {
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.getChannelData(1);
        for (let i = 0; i < audioBuffer.length; i++) {
            monoData[i] = (ch0[i] + ch1[i]) / 2;
        }
    }

    const dataLength = monoData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < monoData.length; i++, offset += 2) {
        const sample = Math.max(-1, Math.min(1, monoData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
