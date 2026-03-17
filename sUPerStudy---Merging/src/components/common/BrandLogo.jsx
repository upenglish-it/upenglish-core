import logo from '../../assets/logo.png';

export default function BrandLogo({ size = '1.5rem', className = '', style = {} }) {
    return (
        <span className={`brand-logo ${className}`} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.05em',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            ...style
        }}>
            s
            <img
                src={logo}
                alt="UP"
                style={{
                    height: '0.9em',
                    width: 'auto',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    margin: '0 0.05em',
                    WebkitTextFillColor: 'initial'
                }}
            />
            erStudy
        </span>
    );
}
