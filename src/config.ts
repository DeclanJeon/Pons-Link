import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional()
);

const optionalBooleanString = z.enum(['true', 'false']).optional();

const envSchema = z.object({
  VITE_SIGNALING_SERVER_URL: z.string().url({ message: "Invalid signaling server URL in .env file" }),
  VITE_GOOGLE_CLIENT_ID: z.string().min(1, { message: 'Missing Google Client ID in .env file' }),
  VITE_API_URL: optionalUrl,
  VITE_PERSONAL_LINK_API_URL: optionalUrl,
  VITE_SPEECH_TOKEN_API_URL: optionalUrl,
  VITE_GA_MEASUREMENT_ID: z.string().optional(),
  VITE_ENABLE_ANALYTICS: optionalBooleanString,
  VITE_ENABLE_EMAIL_API: optionalBooleanString,
  VITE_GIPHY_API_KEY: z.string().optional(),
});

let ENV_VARS: z.infer<typeof envSchema>;
let ENV_ERROR: z.ZodError | null = null;

try {
  // 앱 시작 시 환경 변수를 파싱하고 유효성을 검사합니다.
  ENV_VARS = envSchema.parse(import.meta.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    // 유효성 검사 실패 시 에러를 저장합니다.
    // 이 에러는 App.tsx에서 앱을 렌더링하기 전에 확인됩니다.
    ENV_ERROR = error;
    console.error("❌ Invalid environment variables:", error.flatten().fieldErrors);
  } else {
    // 예기치 않은 다른 에러 처리
    console.error("❌ An unexpected error occurred while parsing environment variables:", error);
    ENV_ERROR = new z.ZodError([]); // 기본 에러 객체 생성
  }
}

export const ENV = ENV_VARS as z.infer<typeof envSchema>;
export const EnvError = ENV_ERROR;
