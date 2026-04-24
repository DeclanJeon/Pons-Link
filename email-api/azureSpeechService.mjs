const DEFAULT_REGION = 'eastus';
const DEFAULT_ENDPOINT = 'https://eastus.api.cognitive.microsoft.com';
const TOKEN_PATH = '/sts/v1.0/issueToken';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const buildAzureSpeechConfig = (env = process.env) => {
  const key = typeof env.AZURE_SPEECH_KEY === 'string' ? env.AZURE_SPEECH_KEY.trim() : '';
  const region = (typeof env.AZURE_SPEECH_REGION === 'string' && env.AZURE_SPEECH_REGION.trim())
    ? env.AZURE_SPEECH_REGION.trim()
    : DEFAULT_REGION;
  const endpoint = trimTrailingSlash(
    (typeof env.AZURE_SPEECH_ENDPOINT === 'string' && env.AZURE_SPEECH_ENDPOINT.trim())
      ? env.AZURE_SPEECH_ENDPOINT.trim()
      : `https://${region}.api.cognitive.microsoft.com`,
  );

  return {
    configured: Boolean(key),
    region,
    endpoint,
    tokenUrl: `${endpoint}${TOKEN_PATH}`,
  };
};

export const fetchAzureSpeechToken = async ({ env = process.env, fetchImpl = fetch } = {}) => {
  const config = buildAzureSpeechConfig(env);
  const key = typeof env.AZURE_SPEECH_KEY === 'string' ? env.AZURE_SPEECH_KEY.trim() : '';

  if (!config.configured || !key) {
    return {
      ok: false,
      error: 'Azure Speech is not configured',
      region: config.region,
      endpoint: config.endpoint,
    };
  }

  const response = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': '0',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Azure Speech token request failed with ${response.status}`,
      region: config.region,
      endpoint: config.endpoint,
    };
  }

  const token = (await response.text()).trim();
  return {
    ok: true,
    token,
    region: config.region,
    endpoint: config.endpoint,
    expiresInSeconds: 600,
  };
};
