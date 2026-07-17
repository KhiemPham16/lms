import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AttemptStatus, JudgeStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '~/prisma/prisma.service';
import { Judge0Service } from './judge0.service';

@Processor('code-grading')
export class CodeGradingProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly judge0: Judge0Service
    ) {
        super();
    }

    async process(job: Job<{ answerId: number }>) {
        const answer = await this.prisma.attemptAnswer.findUnique({
            where: { id: job.data.answerId },
            include: { question: { include: { testCases: { orderBy: { sortOrder: 'asc' } } } } }
        });
        if (!answer?.sourceCode || !answer.languageId) return;
        await this.prisma.attemptAnswer.update({
            where: { id: answer.id },
            data: { judgeStatus: JudgeStatus.PROCESSING }
        });
        let accepted = 0;
        let message = '';
        try {
            for (const testCase of answer.question.testCases) {
                const result = await this.judge0.execute(
                    answer.languageId,
                    answer.sourceCode,
                    testCase.input ?? undefined,
                    testCase.expectedOutput
                );
                if (result.status?.id === 13) throw new Error(result.message ?? 'Judge0 gặp lỗi nội bộ');
                if (result.status?.id === 3) accepted += 1;
                else
                    message =
                        result.compile_output ??
                        result.stderr ??
                        result.message ??
                        result.status?.description ??
                        'Sai kết quả';
            }
        } catch (error) {
            if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
                await this.prisma.attemptAnswer.update({
                    where: { id: answer.id },
                    data: {
                        judgeStatus: JudgeStatus.ERROR,
                        judgeMessage: error instanceof Error ? error.message : 'Máy chấm mã gặp lỗi'
                    }
                });
                await this.finalizeAttempt(answer.attemptId);
            }
            throw error;
        }
        const total = answer.question.testCases.length;
        const points = total ? (Number(answer.question.points) * accepted) / total : 0;
        await this.prisma.attemptAnswer.update({
            where: { id: answer.id },
            data: {
                awardedPoints: points,
                judgeStatus: accepted === total ? JudgeStatus.ACCEPTED : JudgeStatus.WRONG_ANSWER,
                judgeMessage: message || null
            }
        });
        await this.finalizeAttempt(answer.attemptId);
    }

    private async finalizeAttempt(attemptId: number) {
        const attempt = await this.prisma.assessmentAttempt.findUnique({
            where: { id: attemptId },
            include: { answers: { include: { question: true } } }
        });
        if (!attempt) return;
        const judging = attempt.answers.some(
            (item) => item.judgeStatus === JudgeStatus.QUEUED || item.judgeStatus === JudgeStatus.PROCESSING
        );
        if (judging) return;
        const manual = attempt.answers.some(
            (item) =>
                (item.question.type === QuestionType.ESSAY || item.question.type === QuestionType.HTML_CSS) &&
                item.awardedPoints === null
        );
        const score = attempt.answers.reduce((sum, item) => sum + Number(item.awardedPoints ?? 0), 0);
        await this.prisma.assessmentAttempt.update({
            where: { id: attemptId },
            data: {
                score,
                status: manual ? AttemptStatus.PENDING_GRADING : AttemptStatus.GRADED,
                gradedAt: manual ? null : new Date()
            }
        });
    }
}
