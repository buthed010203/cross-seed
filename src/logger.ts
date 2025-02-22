import { join } from "path";
import winston from "winston";
import { appDir, createAppDir } from "./configuration.js";
import { getRuntimeConfig } from "./runtimeConfig.js";
import DailyRotateFile from "winston-daily-rotate-file";

export enum Label {
	QBITTORRENT = "qbittorrent",
	RTORRENT = "rtorrent",
	TRANSMISSION = "transmission",
	DECIDE = "decide",
	PREFILTER = "prefilter",
	CONFIGDUMP = "configdump",
	TORZNAB = "torznab",
	SERVER = "server",
	STARTUP = "startup",
	SCHEDULER = "scheduler",
	SEARCH = "search",
	RSS = "rss",
	PERF = "perf",
	REVERSE_LOOKUP = "reverselookup",
}

export let logger: winston.Logger;

const redactionMsg = "[REDACTED]";

function redactUrlPassword(message, urlStr) {
	let url;
	try {
		url = new URL(urlStr);
		if (url.password) {
			const urlDecodedPassword = decodeURIComponent(url.password);
			const urlEncodedPassword = encodeURIComponent(url.password);
			message = message.split(url.password).join(redactionMsg);
			message = message.split(urlDecodedPassword).join(redactionMsg);
			message = message.split(urlEncodedPassword).join(redactionMsg);
		}
	} catch (e) {
		// do nothing
	}
	return message;
}

function redactMessage(message: string | unknown) {
	if (typeof message !== "string") {
		return message;
	}
	const runtimeConfig = getRuntimeConfig();
	let ret = message;

	// redact torznab api keys
	ret = ret.replace(/apikey=[a-zA-Z0-9]+/g, `apikey=${redactionMsg}`);
	ret = ret.replace(
		/\/notification\/crossSeed\/\w+/g,
		`/notification/crossSeed/${redactionMsg}`
	);
	for (const [key, urlStr] of Object.entries(runtimeConfig)) {
		if (key.endsWith("Url") && urlStr) {
			ret = redactUrlPassword(ret, urlStr);
		}
	}
	return ret;
}

const logOnceCache: string[] = [];
export function logOnce(cacheKey: string, cb: () => void) {
	if (!logOnceCache.includes(cacheKey)) {
		logOnceCache.push(cacheKey);
		cb();
	}
}

export function initializeLogger(): void {
	createAppDir();
	logger = winston.createLogger({
		level: "info",
		format: winston.format.combine(
			winston.format.timestamp({
				format: "YYYY-MM-DD HH:mm:ss",
			}),
			winston.format.errors({ stack: true }),
			winston.format.splat(),
			winston.format.colorize(),
			winston.format.printf(({ level, message, label, timestamp }) => {
				return `${timestamp} ${level}: ${
					label ? `[${label}] ` : ""
				}${redactMessage(message)}`;
			})
		),
		transports: [
			new DailyRotateFile({
				filename: "error.%DATE%.log",
				createSymlink: true,
				symlinkName: "error.current.log",
				dirname: join(appDir(), "logs"),
				maxFiles: "14d",
				level: "error",
			}),
			new DailyRotateFile({
				filename: "info.%DATE%.log",
				createSymlink: true,
				symlinkName: "info.current.log",
				dirname: join(appDir(), "logs"),
				maxFiles: "14d",
			}),
			new DailyRotateFile({
				filename: "verbose.%DATE%.log",
				createSymlink: true,
				symlinkName: "verbose.current.log",
				dirname: join(appDir(), "logs"),
				maxFiles: "14d",
				level: "silly",
			}),
			new winston.transports.Console({
				level: getRuntimeConfig().verbose ? "silly" : "info",
				format: winston.format.combine(
					winston.format.errors({ stack: true }),
					winston.format.splat(),
					winston.format.colorize(),
					winston.format.printf(({ level, message, label }) => {
						return `${level}: ${
							label ? `[${label}] ` : ""
						}${redactMessage(message)}`;
					})
				),
			}),
		],
	});
}
