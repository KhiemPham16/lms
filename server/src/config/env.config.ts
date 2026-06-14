const bcryptRounds = parseInt(process.env.AUTH_BCRYPT_ROUNDS || '10', 10);

export default () => ({
    app: {
        port: Number(process.env.PORT) || 3500,
        appName: process.env.APP_NAME || 'LMS DevChill',
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: (process.env.FRONTEND_URL || '').replace(/\/$/, '')
    },

    auth: {
        bcryptRounds: Number.isFinite(bcryptRounds) && bcryptRounds > 0 ? bcryptRounds : 10,
        verifyTokenExpires: process.env.AUTH_VERIFY_TOKEN_EXPIRES || '4h',
        accessTokenExpires: process.env.AUTH_ACCESS_TOKEN_EXPIRES || '15m',
        refreshTokenExpires: process.env.AUTH_REFRESH_TOKEN_EXPIRES || '7d',
        verifyJwtSecret: process.env.AUTH_VERIFY_JWT || '',
        accessJwtSecret: process.env.AUTH_ACCESS_JWT || '',
        refreshJwtSecret: process.env.AUTH_REFRESH_JWT || ''
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true',
        mailQueueName: process.env.MAIL_QUEUE_NAME || 'mail'
    },

    mail: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.MAIL_FROM || ''
    }
});
