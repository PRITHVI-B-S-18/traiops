export const getAppBaseUrl = () => {
  const envValue = import.meta?.env?.VITE_APP_BASE_URL;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
};

export const buildAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl();
  if (!path) return baseUrl;
  return `${baseUrl}/${path.replace(/^\//, '')}`;
};

