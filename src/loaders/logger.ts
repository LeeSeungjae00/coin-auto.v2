// loaders/logger.js
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import process from 'process';
const { combine, timestamp, label, printf, colorize } = winston.format;

//루트경로
const logDir = `${process.cwd()}/logs`;

//레벨
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};
//색상
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};
winston.addColors(colors); // 색상 적용

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'http';
};

//로그 포맷
const logFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  label({ label: 'Server Logs' }),
  printf((info) => {
    if (info.stack) {
      return `${info.timestamp} ${info.level}: ${info.message} \n Error Stack: ${info.stack}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  })
);

// 콘솔에 찍힐 때는 색깔을 구변해서 로깅해주자.
const consoleOpts = {
  handleExceptions: true,
  level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' })
  ),
};

const transports = [
  new winston.transports.Console(consoleOpts),

  new winstonDaily({
    level: 'info', // info 레벨 로그를 저장할 파일 설정
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    filename: `%DATE%.log`, // %DATE% = 위에서 설정한 datePattern 이 들어감
    dirname: logDir,
    maxFiles: 30, // 30일치 로그 파일 저장
  }),
  new winstonDaily({
    level: 'error', // error 레벨 로그를 저장할 파일 설정
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    filename: `%DATE%.error.log`,
    dirname: logDir + '/error', // error.log 파일은 /logs/error 하위에 저장
    maxFiles: 30,
  }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports,
});

export default logger;
