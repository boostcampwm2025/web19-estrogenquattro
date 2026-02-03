process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
process.env.AXIOM_TOKEN = 'test-axiom-token';
process.env.AXIOM_DATASET = 'test-axiom-dataset';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('모든 의존성이 올바르게 해결된다', async () => {
    // Given & When: AppModule 컴파일
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Then: 모듈이 정상적으로 생성됨
    expect(module).toBeDefined();

    await module.close();
  });
});
