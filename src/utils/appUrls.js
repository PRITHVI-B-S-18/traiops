export const getAppBaseUrl = () => {
  const envValue = import.meta?.env?.VITE_APP_BASE_URL;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    // Never use localhost/loopback in outbound email links unless explicitly set via VITE_APP_BASE_URL
    const isLocalOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);
    if (!isLocalOrigin) return origin;
  }

  return 'https://trainer-scheduler-1812.web.app';
};

export const buildAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl();
  if (!path) return baseUrl;
  return `${baseUrl}/${path.replace(/^\//, '')}`;
};

