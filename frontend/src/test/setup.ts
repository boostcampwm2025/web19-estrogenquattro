// React 컴포넌트 테스트용 setup (src/**/*.test.tsx 파일에서 사용)
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
