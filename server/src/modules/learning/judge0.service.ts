import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const SUPPORTED_JUDGE_LANGUAGES = [50, 51, 54, 62, 63, 71] as const;

type JudgeResult = {
    stdout?: string;
    stderr?: string;
    compile_output?: string;
    message?: string;
    status?: { id: number; description: string };
};

@Injectable()
export class Judge0Service {
    constructor(private readonly config: ConfigService) {}

    async execute(languageId: number, sourceCode: string, stdin?: string, expectedOutput?: string) {
        const baseUrl = this.config.get<string>('judge0.baseUrl')!;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.get<number>('judge0.timeoutMs') ?? 30000);
        try {
            const response = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
                method: 'POST',
                headers: this.headers(),
                signal: controller.signal,
                body: JSON.stringify({
                    language_id: languageId,
                    source_code: sourceCode,
                    stdin,
                    expected_output: expectedOutput
                })
            });
            if (!response.ok) throw new BadGatewayException(`Judge0 trả về mã lỗi ${response.status}`);
            return (await response.json()) as JudgeResult;
        } catch (error) {
            if (error instanceof BadGatewayException) throw error;
            throw new BadGatewayException('Không thể kết nối máy chấm mã Judge0');
        } finally {
            clearTimeout(timeout);
        }
    }

    private headers() {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const clientId = this.config.get<string>('judge0.cloudflareClientId');
        const clientSecret = this.config.get<string>('judge0.cloudflareClientSecret');
        if (clientId && clientSecret) {
            headers['CF-Access-Client-Id'] = clientId;
            headers['CF-Access-Client-Secret'] = clientSecret;
        }
        return headers;
    }
}
