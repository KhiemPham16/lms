import { Injectable } from '@nestjs/common';

@Injectable()
export class AppHealthService {
    private apiCount = 0;

    setApiCount(apiCount: number) {
        this.apiCount = apiCount;
    }

    getApiCount() {
        return this.apiCount;
    }
}
