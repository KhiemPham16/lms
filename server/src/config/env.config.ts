const bcryptRounds = parseInt(process.env.AUTH_BCRYPT_ROUNDS || '10', 10);

export default () => ({
    app: {
        host: process.env.HOST || '0.0.0.0',
        port: Number(process.env.PORT) || 3500,
        appName: process.env.APP_NAME || 'LMS DevChill',
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: (process.env.FRONTEND_URL || '').replace(/\/$/, '')
    },

    auth: {
        bcryptRounds: Number.isFinite(bcryptRounds) && bcryptRounds > 0 ? bcryptRounds : 10,
        accessTokenExpires: process.env.AUTH_ACCESS_TOKEN_EXPIRES || '15m',
        refreshTokenExpires: process.env.AUTH_REFRESH_TOKEN_EXPIRES || '7d',
        accessJwtSecret: process.env.AUTH_ACCESS_JWT || '',
        refreshJwtSecret: process.env.AUTH_REFRESH_JWT || ''
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true'
    },

    mail: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.MAIL_FROM || ''
    },

    judge0: {
        baseUrl: (process.env.JUDGE0_URL || 'https://judge0.devchill.id.vn').replace(/\/$/, ''),
        cloudflareClientId: process.env.JUDGE0_CF_ACCESS_CLIENT_ID || '',
        cloudflareClientSecret: process.env.JUDGE0_CF_ACCESS_CLIENT_SECRET || '',
        timeoutMs: Number(process.env.JUDGE0_TIMEOUT_MS) || 30000
    },
    media: {
        root: process.env.MEDIA_ROOT || 'storage/media',
        webpQuality: Number(process.env.MEDIA_WEBP_QUALITY) || 82
    }
});
