type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(
  level: Level,
  message: string,
  fields: Record<string, unknown>,
): void {
  console[level === 'debug' ? 'log' : level](
    JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...fields,
    }),
  );
}

export const log = {
  debug: (message: string, fields: Record<string, unknown> = {}) =>
    emit('debug', message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) =>
    emit('info', message, fields),
  warn: (message: string, fields: Record<string, unknown> = {}) =>
    emit('warn', message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) =>
    emit('error', message, fields),
};
