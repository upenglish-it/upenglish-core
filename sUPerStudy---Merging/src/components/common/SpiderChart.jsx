import React, { useRef, useEffect } from 'react';

/**
 * SpiderChart (Radar Chart) — pure Canvas-based, no external libs.
 *
 * Props:
 *   - data: array of { label, value (0-10) }
 *   - size: chart area size in px (default 300). The actual canvas will be wider/taller to fit labels.
 *   - color: fill color (default '#6366f1')
 *   - showLabels: whether to show axis labels (default true)
 *   - compareData: optional array of { label, value } for overlay comparison
 *   - compareColor: overlay color (default '#94a3b8')
 */
export default function SpiderChart({
    data = [],
    size = 300,
    color = '#6366f1',
    showLabels = true,
    compareData = null,
    compareColor = '#94a3b8',
}) {
    const canvasRef = useRef(null);

    // Add padding around the chart for labels
    const hPad = Math.round(size * 0.32); // horizontal padding for left/right labels
    const vPad = Math.round(size * 0.18); // vertical padding for top/bottom labels
    const canvasW = size + hPad * 2;
    const canvasH = size + vPad * 2;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasW * dpr;
        canvas.height = canvasH * dpr;
        canvas.style.width = `${canvasW}px`;
        canvas.style.height = `${canvasH}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Center of chart (shifted by padding)
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const maxRadius = size * 0.34;
        const n = data.length;
        const angleStep = (2 * Math.PI) / n;
        const startAngle = -Math.PI / 2; // Start from top

        // Draw background grid circles
        const levels = 5;
        for (let i = 1; i <= levels; i++) {
            const r = (maxRadius / levels) * i;
            ctx.beginPath();
            for (let j = 0; j < n; j++) {
                const angle = startAngle + j * angleStep;
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = i === levels ? '#cbd5e1' : '#e2e8f0';
            ctx.lineWidth = i === levels ? 1.5 : 0.8;
            ctx.stroke();

            // Level number label (right side)
            if (showLabels) {
                const levelVal = (10 / levels) * i;
                ctx.fillStyle = '#94a3b8';
                ctx.font = `${Math.max(9, size * 0.03)}px -apple-system, BlinkMacSystemFont, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(levelVal.toFixed(0), cx + r + 4, cy - 2);
            }
        }

        // Draw axis lines
        for (let i = 0; i < n; i++) {
            const angle = startAngle + i * angleStep;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + maxRadius * Math.cos(angle), cy + maxRadius * Math.sin(angle));
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw comparison data first (behind)
        if (compareData && compareData.length === n) {
            drawDataPolygon(ctx, compareData, cx, cy, maxRadius, n, angleStep, startAngle, compareColor, 0.12, 1.5);
        }

        // Draw main data polygon
        drawDataPolygon(ctx, data, cx, cy, maxRadius, n, angleStep, startAngle, color, 0.2, 2.5);

        // Draw data points
        for (let i = 0; i < n; i++) {
            const val = Math.max(0, Math.min(10, data[i].value || 0));
            const r = (val / 10) * maxRadius;
            const angle = startAngle + i * angleStep;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw labels
        if (showLabels) {
            const labelFontSize = Math.max(11, size * 0.038);
            ctx.fillStyle = '#334155';
            ctx.font = `600 ${labelFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

            for (let i = 0; i < n; i++) {
                const angle = startAngle + i * angleStep;
                const labelRadius = maxRadius + (size * 0.06);
                let x = cx + labelRadius * Math.cos(angle);
                let y = cy + labelRadius * Math.sin(angle);

                // Adjust text alignment based on position
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                let textAlign;
                if (Math.abs(cos) < 0.1) {
                    textAlign = 'center';
                } else if (cos > 0) {
                    textAlign = 'left';
                } else {
                    textAlign = 'right';
                }
                ctx.textAlign = textAlign;

                if (Math.abs(sin) < 0.1) {
                    ctx.textBaseline = 'middle';
                } else if (sin > 0) {
                    ctx.textBaseline = 'top';
                } else {
                    ctx.textBaseline = 'bottom';
                }

                // Wrap label text if too long
                const maxLabelWidth = hPad * 0.9;
                const label = data[i].label;
                const labelLines = [];
                if (ctx.measureText(label).width > maxLabelWidth) {
                    const words = label.split(/\s+/);
                    let currentLine = '';
                    for (const word of words) {
                        const testLine = currentLine ? `${currentLine} ${word}` : word;
                        if (ctx.measureText(testLine).width > maxLabelWidth && currentLine) {
                            labelLines.push(currentLine);
                            currentLine = word;
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine) labelLines.push(currentLine);
                } else {
                    labelLines.push(label);
                }

                const lineHeight = labelFontSize + 4;

                // Adjust y for multi-line labels at top
                let labelStartY = y;
                if (sin < -0.1 && labelLines.length > 1) {
                    labelStartY = y - (labelLines.length - 1) * lineHeight;
                }

                ctx.font = `600 ${labelFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
                ctx.fillStyle = '#334155';
                for (let li = 0; li < labelLines.length; li++) {
                    ctx.fillText(labelLines[li], x, labelStartY + li * lineHeight);
                }

                // Draw value below label
                ctx.save();
                ctx.fillStyle = color;
                ctx.font = `700 ${labelFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
                const valY = labelStartY + labelLines.length * lineHeight;
                ctx.fillText((data[i].value || 0).toFixed(1), x, valY);
                ctx.restore();
            }
        }
    }, [data, size, color, showLabels, compareData, compareColor, canvasW, canvasH, hPad, vPad]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: canvasW,
                height: canvasH,
                display: 'block',
                margin: '0 auto',
                maxWidth: '100%',
            }}
        />
    );
}

function drawDataPolygon(ctx, data, cx, cy, maxRadius, n, angleStep, startAngle, color, fillAlpha, lineWidth) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const val = Math.max(0, Math.min(10, data[i].value || 0));
        const r = (val / 10) * maxRadius;
        const angle = startAngle + i * angleStep;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Fill
    ctx.fillStyle = hexToRgba(color, fillAlpha);
    ctx.fill();

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
