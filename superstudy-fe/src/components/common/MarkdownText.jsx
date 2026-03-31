/**
 * MarkdownText  —  lightweight markdown renderer dành cho nhận xét AI.
 * Hỗ trợ: heading (#/##/###), **bold**, *italic*, `inline code`,
 *          ```code block```, - bullet list, 1. numbered list,
 *          > blockquote, \n xuống dòng thường.
 * Không cần thư viện ngoài.
 */
export default function MarkdownText({ children, className = '', style = {} }) {
    if (!children || typeof children !== 'string') return null;

    const lines = children.split('\n');
    const elements = [];
    let i = 0;
    let keyCounter = 0;
    const key = () => `md-${keyCounter++}`;

    /** Xử lý inline: **bold**, *italic*, `code` */
    function renderInline(text) {
        const parts = [];
        // Regex: code trước để tránh conflict với bold/italic
        const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
        let last = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > last) {
                parts.push(text.slice(last, match.index));
            }
            const token = match[0];
            if (token.startsWith('`')) {
                parts.push(
                    <code key={key()} style={{
                        fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.12)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.88em',
                        color: 'var(--color-secondary, #00cec9)',
                    }}>
                        {token.slice(1, -1)}
                    </code>
                );
            } else if (token.startsWith('**')) {
                parts.push(<strong key={key()}>{token.slice(2, -2)}</strong>);
            } else if (token.startsWith('*')) {
                parts.push(<em key={key()}>{token.slice(1, -1)}</em>);
            }
            last = match.index + token.length;
        }
        if (last < text.length) parts.push(text.slice(last));
        return parts;
    }

    while (i < lines.length) {
        const line = lines[i];

        // ─── Code block ```
        if (line.trimStart().startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push(
                <pre key={key()} style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    overflowX: 'auto',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    margin: '6px 0',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}>
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            i++; // skip closing ```
            continue;
        }

        // ─── Heading ### / ## / #
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const sizes = { 1: '1.25rem', 2: '1.1rem', 3: '1rem' };
            elements.push(
                <div key={key()} style={{
                    fontWeight: 700,
                    fontSize: sizes[level] || '1rem',
                    color: 'var(--color-primary-light, #a29bfe)',
                    marginTop: level === 1 ? '10px' : '6px',
                    marginBottom: '2px',
                    lineHeight: 1.4,
                }}>
                    {renderInline(headingMatch[2])}
                </div>
            );
            i++;
            continue;
        }

        // ─── Blockquote >
        if (line.startsWith('>')) {
            elements.push(
                <div key={key()} style={{
                    borderLeft: '3px solid var(--color-primary, #6c5ce7)',
                    paddingLeft: '10px',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    margin: '4px 0',
                }}>
                    {renderInline(line.replace(/^>\s?/, ''))}
                </div>
            );
            i++;
            continue;
        }

        // ─── Bullet list  -  /  *  (không phải bold)
        const bulletMatch = line.match(/^(\s*)([-*])\s+(.+)/);
        if (bulletMatch && !line.match(/^\*\*.+\*\*$/)) {
            const items = [];
            while (i < lines.length) {
                const bl = lines[i].match(/^(\s*)([-*])\s+(.+)/);
                if (!bl) break;
                items.push(<li key={key()} style={{ marginBottom: '3px' }}>{renderInline(bl[3])}</li>);
                i++;
            }
            elements.push(
                <ul key={key()} style={{
                    paddingLeft: '18px',
                    margin: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                }}>
                    {items}
                </ul>
            );
            continue;
        }

        // ─── Numbered list  1.  2.  ...
        const numberedMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
        if (numberedMatch) {
            const items = [];
            while (i < lines.length) {
                const nl = lines[i].match(/^(\s*)\d+\.\s+(.+)/);
                if (!nl) break;
                items.push(<li key={key()} style={{ marginBottom: '3px' }}>{renderInline(nl[2])}</li>);
                i++;
            }
            elements.push(
                <ol key={key()} style={{
                    paddingLeft: '20px',
                    margin: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                }}>
                    {items}
                </ol>
            );
            continue;
        }

        // ─── Dòng trống → khoảng cách nhỏ
        if (line.trim() === '') {
            elements.push(<div key={key()} style={{ height: '6px' }} />);
            i++;
            continue;
        }

        // ─── Paragraph thường
        elements.push(
            <div key={key()} style={{ lineHeight: 1.65 }}>
                {renderInline(line)}
            </div>
        );
        i++;
    }

    return (
        <span
            className={className}
            style={{
                display: 'inline-block',
                width: '100%',
                wordBreak: 'break-word',
                ...style,
            }}
        >
            {elements}
        </span>
    );
}
